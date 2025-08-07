import type { Context, MiddlewareHandler } from 'hono'

import { logger } from '@/lib/logger'
import type { Env } from '@/types'

export const securityHeaders = (): MiddlewareHandler => {
  return async (c, next) => {
    await next()

    // Security headers
    c.header('X-Content-Type-Options', 'nosniff')
    c.header('X-Frame-Options', 'DENY')
    c.header('X-XSS-Protection', '1; mode=block')
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

    // Remove sensitive headers
    c.header('X-Powered-By', '')
    c.header('Server', '')
  }
}

export const securityLogger = (): MiddlewareHandler<{ Bindings: Env }> => {
  return async (c, next) => {
    const startTime = Date.now()
    const requestId = crypto.randomUUID()

    // Log request (sensitive headers are not logged)
    logger.info('Security: Request received', {
      requestId,
      method: c.req.method,
      path: c.req.path,
      ip: c.req.header('cf-connecting-ip'),
      country: c.req.header('cf-ipcountry'),
      userAgent: c.req.header('user-agent'),
      referer: c.req.header('referer')
      // Note: Authorization, API keys, and tokens are intentionally not logged
    })

    try {
      await next()

      // Log successful response
      const duration = Date.now() - startTime
      logger.info('Security: Request completed', {
        requestId,
        status: c.res.status,
        duration
      })
    } catch (error) {
      // Log error
      const duration = Date.now() - startTime
      logger.error('Security: Request failed', {
        requestId,
        error,
        duration
      })
      throw error
    }
  }
}

export const corsMiddleware = (allowedOrigins: string[] = []): MiddlewareHandler => {
  return async (c, next) => {
    const origin = c.req.header('origin')

    if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
      c.header('Access-Control-Allow-Origin', origin)
      c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      c.header('Access-Control-Max-Age', '86400')
    }

    if (c.req.method === 'OPTIONS') {
      return new Response(null, { status: 204 })
    }

    await next()
    return
  }
}

export const ipWhitelist = (allowedIps: string[]): MiddlewareHandler => {
  return async (c, next) => {
    const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || ''

    if (!allowedIps.includes(clientIp)) {
      logger.warn('Security: IP not whitelisted', {
        ip: clientIp,
        path: c.req.path
      })
      return c.text('Forbidden', 403)
    }

    await next()
    return
  }
}

export const validateWebhookSecret = (getSecret: (c: Context) => string): MiddlewareHandler => {
  return async (c, next) => {
    const providedSecret = c.req.header('x-webhook-secret') || c.req.query('secret') || ''
    const expectedSecret = getSecret(c)

    if (!providedSecret || providedSecret !== expectedSecret) {
      logger.warn('Security: Invalid webhook secret', {
        path: c.req.path,
        ip: c.req.header('cf-connecting-ip')
      })
      return c.text('Unauthorized', 401)
    }

    await next()
    return
  }
}
