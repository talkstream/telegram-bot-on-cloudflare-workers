import type { MiddlewareHandler } from 'hono'

import { EventBus } from '@/core/events/event-bus'
import { logger } from '@/lib/logger'
import type { Env } from '@/types'

// Extend Hono context with our custom properties
declare module 'hono' {
  interface ContextVariableMap {
    dynamicConfig: Map<string, unknown>
  }
}

interface EventMiddlewareConfig {
  eventBus: EventBus
  source?: string
}

/**
 * Middleware that integrates HTTP requests with EventBus
 * Emits events for request lifecycle and errors
 */
export const eventMiddleware = (
  config: EventMiddlewareConfig
): MiddlewareHandler<{ Bindings: Env }> => {
  const { eventBus, source = 'http-server' } = config

  return async (c, next) => {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    // Emit request start event
    eventBus.emit(
      'http.request.start',
      {
        requestId,
        method: c.req.method,
        path: c.req.path,
        headers: Object.fromEntries(c.req.raw.headers.entries()),
        ip: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')
      },
      source
    )

    try {
      await next()

      const duration = Date.now() - startTime

      // Emit request complete event
      eventBus.emit(
        'http.request.complete',
        {
          requestId,
          status: c.res.status,
          duration,
          method: c.req.method,
          path: c.req.path
        },
        source
      )

      // Add request ID to response headers
      c.header('X-Request-ID', requestId)
    } catch (error) {
      const duration = Date.now() - startTime

      // Emit request error event
      eventBus.emit(
        'http.request.error',
        {
          requestId,
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                  name: error.name
                }
              : { message: String(error) },
          duration,
          method: c.req.method,
          path: c.req.path
        },
        source
      )

      // Re-throw to let error handler middleware deal with it
      throw error
    }
  }
}

/**
 * Middleware that listens to EventBus for dynamic behavior changes
 * For example: feature flags, rate limit updates, etc.
 */
export const eventListenerMiddleware = (
  eventBus: EventBus
): MiddlewareHandler<{ Bindings: Env }> => {
  // Store dynamic config that can be updated via events
  const dynamicConfig = new Map<string, unknown>()

  // Listen for config update events
  eventBus.on('config.update', event => {
    const { key, value } = event.payload as { key: string; value: unknown }
    dynamicConfig.set(key, value)
    logger.info('Dynamic config updated', { key, value })
  })

  return async (c, next) => {
    // Attach dynamic config to context for use in other middleware
    c.set('dynamicConfig', dynamicConfig)

    await next()
  }
}
