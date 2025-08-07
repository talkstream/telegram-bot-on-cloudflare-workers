import type { MiddlewareFn } from 'grammy'

import { EventBus } from '@/core/events/event-bus'
import type { IRateLimiter, MiddlewareContext, RateLimitResult } from '@/core/middleware/interfaces'
import { logger } from '@/lib/logger'
import type { ExtendedGrammyContext } from '@/types/grammy-extensions'
import type { BotContext } from '@/types/telegram'

/**
 * Telegram-specific rate limiter implementation
 */
export class TelegramRateLimiter implements IRateLimiter {
  constructor(
    private kv: KVNamespace | undefined,
    private eventBus: EventBus,
    private windowMs: number = 60000,
    private maxRequests: number = 20
  ) {}

  async checkLimit(context: MiddlewareContext, key?: string): Promise<RateLimitResult> {
    const limitKey = key || `rate_limit:${context.platform}_${context.userId}`

    if (!this.kv) {
      // If no KV storage, allow all requests
      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: this.maxRequests,
        resetAt: new Date(Date.now() + this.windowMs)
      }
    }

    try {
      const rateLimitData = (await this.kv.get(limitKey, 'json')) as {
        count: number
        resetAt: number
      } | null

      const now = Date.now()
      let count = 0
      let resetAt = now + this.windowMs

      if (rateLimitData && rateLimitData.resetAt > now) {
        count = rateLimitData.count
        resetAt = rateLimitData.resetAt
      }

      const allowed = count < this.maxRequests
      const remaining = Math.max(0, this.maxRequests - count)

      if (!allowed) {
        this.eventBus.emit(
          'rate-limit.exceeded',
          {
            platform: context.platform,
            userId: context.userId,
            key: limitKey,
            count,
            limit: this.maxRequests,
            metadata: context.metadata
          },
          'telegram-rate-limiter'
        )
      }

      // Update count if allowed
      if (allowed) {
        count++
        await this.kv.put(limitKey, JSON.stringify({ count, resetAt }), {
          expirationTtl: Math.ceil(this.windowMs / 1000)
        })
      }

      return {
        allowed,
        limit: this.maxRequests,
        remaining: remaining - (allowed ? 1 : 0),
        resetAt: new Date(resetAt)
      }
    } catch (error) {
      logger.error('Telegram rate limiter error', { error, key: limitKey })
      // On error, allow the request
      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: this.maxRequests,
        resetAt: new Date(Date.now() + this.windowMs)
      }
    }
  }

  async resetLimit(key: string): Promise<void> {
    if (!this.kv) return

    try {
      await this.kv.delete(key)
      this.eventBus.emit('rate-limit.reset', { key }, 'telegram-rate-limiter')
    } catch (error) {
      logger.error('Failed to reset rate limit', { error, key })
    }
  }
}

/**
 * Create Grammy middleware for rate limiting
 */
export function createRateLimitMiddleware(
  rateLimiter: IRateLimiter,
  options?: {
    keyGenerator?: (ctx: BotContext) => string
    message?: string
    skipSuccessful?: boolean
  }
): MiddlewareFn<BotContext> {
  const {
    keyGenerator = (ctx: BotContext) => (ctx.from?.id ? `telegram_${ctx.from.id}` : 'unknown'),
    message = 'Too many requests, please try again later.',
    skipSuccessful = false
  } = options || {}

  return async (ctx: BotContext & ExtendedGrammyContext, next) => {
    const context: MiddlewareContext = {
      platform: 'telegram',
      userId: ctx.from?.id ? `telegram_${ctx.from.id}` : undefined,
      metadata: {
        chatId: ctx.chat?.id,
        messageId: ctx.message?.message_id,
        updateType: ctx.updateType
      }
    }

    const key = keyGenerator(ctx)
    const result = await rateLimiter.checkLimit(context, key)

    if (!result.allowed) {
      const resetIn = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)
      await ctx.reply(message, {
        reply_parameters: ctx.message ? { message_id: ctx.message.message_id } : undefined,
        parse_mode: 'HTML',
        disable_notification: true
      })

      logger.warn('Telegram rate limit exceeded', {
        userId: context.userId,
        key,
        resetIn
      })

      return // Stop processing
    }

    // Execute next middleware
    await next()

    // Check if we should update the count based on success
    if (!skipSuccessful && ctx.error) {
      // If there was an error and we're not skipping successful requests,
      // we might want to not count this request
      // This is application-specific logic
    }
  }
}

/**
 * Preset rate limit configurations
 */
export const telegramRateLimits = {
  strict: (kv: KVNamespace | undefined, eventBus: EventBus) =>
    new TelegramRateLimiter(kv, eventBus, 60000, 10),

  standard: (kv: KVNamespace | undefined, eventBus: EventBus) =>
    new TelegramRateLimiter(kv, eventBus, 60000, 30),

  relaxed: (kv: KVNamespace | undefined, eventBus: EventBus) =>
    new TelegramRateLimiter(kv, eventBus, 60000, 60),

  commands: (kv: KVNamespace | undefined, eventBus: EventBus) =>
    new TelegramRateLimiter(kv, eventBus, 300000, 50) // 5 minutes, 50 commands
}
