import type { Context, MiddlewareHandler } from 'hono'

import { EventBus } from '@/core/events/event-bus'
import { logger } from '@/lib/logger'
import type { Env } from '@/types'

interface RateLimitConfig {
  windowMs?: number
  maxRequests?: number
  keyGenerator?: (c: Context<{ Bindings: Env }>) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  message?: string
  eventBus?: EventBus
}

export const rateLimiter = (config: RateLimitConfig = {}): MiddlewareHandler<{ Bindings: Env }> => {
  const {
    windowMs = 60000, // 1 minute default
    maxRequests = 20, // 20 requests per minute default
    keyGenerator = c =>
      c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    message = 'Too many requests, please try again later.',
    eventBus
  } = config

  return async (c, next) => {
    const env = c.env as Env
    const key = `rate_limit:${keyGenerator(c)}`

    try {
      // Use KV storage for distributed rate limiting
      // Check if RATE_LIMIT is available
      if (!env.RATE_LIMIT) {
        // If no rate limit storage, allow request
        await next()
        return
      }

      const rateLimitData = (await env.RATE_LIMIT.get(key, 'json')) as {
        count: number
        resetAt: number
      } | null
      const now = Date.now()

      let count = 0
      let resetAt = now + windowMs

      if (rateLimitData && rateLimitData.resetAt > now) {
        count = rateLimitData.count
        resetAt = rateLimitData.resetAt
      } else {
        // Reset the window
        count = 0
      }

      if (count >= maxRequests) {
        const retryAfter = Math.ceil((resetAt - now) / 1000)

        logger.warn('Rate limit exceeded', {
          key,
          count,
          maxRequests,
          retryAfter
        })

        // Emit rate limit exceeded event
        if (eventBus) {
          eventBus.emit(
            'rate-limit.exceeded',
            {
              key,
              count,
              maxRequests,
              retryAfter,
              ip: keyGenerator(c),
              path: c.req.path,
              method: c.req.method
            },
            'rate-limiter'
          )
        }

        return c.text(message, 429, {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(resetAt).toISOString()
        })
      }

      // Execute the request
      await next()

      // Update count based on response status and configuration
      const shouldCount =
        (c.res.status < 400 && !skipSuccessfulRequests) ||
        (c.res.status >= 400 && !skipFailedRequests)

      if (shouldCount) {
        count++
        await env.RATE_LIMIT.put(key, JSON.stringify({ count, resetAt }), {
          expirationTtl: Math.ceil(windowMs / 1000)
        })
      }

      // Add rate limit headers
      c.header('X-RateLimit-Limit', maxRequests.toString())
      c.header('X-RateLimit-Remaining', Math.max(0, maxRequests - count).toString())
      c.header('X-RateLimit-Reset', new Date(resetAt).toISOString())
    } catch (error) {
      logger.error('Rate limiter error', { error, key })
      // On error, allow the request to proceed
      await next()
    }
    return
  }
}

// Preset configurations for different endpoints
export const strictRateLimit = rateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 10 // 10 requests per minute
})

export const relaxedRateLimit = rateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 60 // 60 requests per minute
})

export const apiRateLimit = rateLimiter({
  windowMs: 900000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
  skipSuccessfulRequests: false,
  skipFailedRequests: true
})
