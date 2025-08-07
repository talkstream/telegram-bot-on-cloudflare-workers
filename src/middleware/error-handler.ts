import type { ErrorHandler } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

import { BotError, UnauthorizedError, ValidationError } from '../lib/errors'
import { logger } from '../lib/logger'

import { EventBus } from '@/core/events/event-bus'
import type { Env } from '@/types'

interface ErrorHandlerConfig {
  eventBus?: EventBus
  includeStackTrace?: boolean
}

export const errorHandler = (config: ErrorHandlerConfig = {}): ErrorHandler<{ Bindings: Env }> => {
  const { eventBus, includeStackTrace = false } = config

  return async (err, c) => {
    const requestId = c.req.header('x-request-id') || crypto.randomUUID()
    const env = c.env.ENVIRONMENT || 'production'

    // Emit error event if EventBus is available
    if (eventBus) {
      eventBus.emit(
        'http.error',
        {
          requestId,
          error: {
            message: err.message || String(err),
            name: err instanceof Error ? err.name : 'UnknownError',
            stack: includeStackTrace && err instanceof Error ? err.stack : undefined
          },
          path: c.req.path,
          method: c.req.method,
          statusCode:
            err instanceof ValidationError ? 400 : err instanceof UnauthorizedError ? 401 : 500
        },
        'error-handler'
      )
    }

    if (err instanceof ValidationError) {
      logger.warn(`Validation Error: ${err.message}`)
      return c.json(
        {
          error: err.message,
          requestId,
          timestamp: new Date().toISOString()
        },
        400 as ContentfulStatusCode
      )
    } else if (err instanceof UnauthorizedError) {
      logger.warn(`Unauthorized Access: ${err.message}`)
      return c.json(
        {
          error: err.message,
          requestId,
          timestamp: new Date().toISOString()
        },
        401 as ContentfulStatusCode
      )
    } else if (err instanceof BotError) {
      logger.error(`Bot Error: ${err.message}`, err)
      return c.json(
        {
          error: err.message,
          requestId,
          timestamp: new Date().toISOString()
        },
        500 as ContentfulStatusCode
      )
    } else if (err instanceof Error) {
      logger.error(`Unhandled Error: ${err.message}`, err)
      // Sentry should catch this via wrapSentry
      interface ErrorResponse {
        error: string
        message?: string
        requestId: string
        timestamp: string
        stack?: string
      }

      const response: ErrorResponse = {
        error: 'Internal Server Error',
        message: env === 'development' ? err.message : undefined,
        requestId,
        timestamp: new Date().toISOString()
      }

      if (env === 'development' && includeStackTrace) {
        response.stack = err.stack
      }

      return c.json(response, 500 as ContentfulStatusCode)
    } else {
      logger.error(`Unknown Error: ${err}`, err)
      return c.json(
        {
          error: 'Internal Server Error',
          requestId,
          timestamp: new Date().toISOString()
        },
        500 as ContentfulStatusCode
      )
    }
  }
}
