/**
 * Monitoring Context Middleware
 *
 * Automatically sets user context and tracks request lifecycle
 */

import type { Context, Next } from 'hono'

import { FieldMapper } from '@/core/database/field-mapper'
import { EventBus } from '@/core/events/event-bus'
import { CommonEventType } from '@/core/events/types/common'
import type { IMonitoringConnector } from '@/core/interfaces/monitoring'

// Shared Telegram user field mapper
const telegramUserMapper = new FieldMapper<
  {
    username?: string
    first_name?: string
    last_name?: string
    language_code?: string
    is_premium?: boolean
  },
  {
    username?: string
    firstName?: string
    lastName?: string
    languageCode?: string
    isPremium?: boolean
  }
>([
  { dbField: 'username', domainField: 'username' },
  { dbField: 'first_name', domainField: 'firstName' },
  { dbField: 'last_name', domainField: 'lastName' },
  { dbField: 'language_code', domainField: 'languageCode' },
  { dbField: 'is_premium', domainField: 'isPremium' }
])

export interface MonitoringContextOptions {
  monitoring: IMonitoringConnector
  eventBus?: EventBus
  trackPerformance?: boolean
  trackErrors?: boolean
  getUserId?: (ctx: Context) => string | undefined | Promise<string | undefined>
  getUserContext?: (
    ctx: Context
  ) => Record<string, unknown> | undefined | Promise<Record<string, unknown> | undefined>
}

/**
 * Create monitoring context middleware
 */
export function createMonitoringContextMiddleware(options: MonitoringContextOptions) {
  const {
    monitoring,
    eventBus,
    trackPerformance = true,
    trackErrors = true,
    getUserId,
    getUserContext
  } = options

  return async (ctx: Context, next: Next) => {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()
    const method = ctx.req.method
    const path = ctx.req.path

    // Set request context
    ctx.set('requestId', requestId)
    ctx.set('monitoring', monitoring)

    // Track request start
    if (trackPerformance && eventBus) {
      eventBus.emit(
        CommonEventType.REQUEST_STARTED,
        {
          requestId,
          method,
          path,
          timestamp: startTime
        },
        'MonitoringMiddleware'
      )
    }

    // Set user context if available
    const userId = await Promise.resolve(getUserId?.(ctx))
    if (userId) {
      const userContext = await Promise.resolve(getUserContext?.(ctx))
      monitoring.setUserContext(userId, userContext)
    }

    // Track request in monitoring
    monitoring.trackEvent('http_request_started', {
      requestId,
      method,
      path,
      userId,
      timestamp: startTime
    })

    try {
      // Continue with request processing
      await next()

      const duration = Date.now() - startTime
      const status = ctx.res.status

      // Track request completion
      if (trackPerformance && eventBus) {
        eventBus.emit(
          CommonEventType.REQUEST_COMPLETED,
          {
            requestId,
            method,
            path,
            status,
            duration,
            timestamp: Date.now()
          },
          'MonitoringMiddleware'
        )
      }

      // Track metrics
      monitoring.trackMetric('http_request_duration', duration, {
        method,
        path,
        status: String(status)
      })

      monitoring.trackEvent('http_request_completed', {
        requestId,
        method,
        path,
        status,
        duration,
        userId,
        timestamp: Date.now()
      })

      // Track status codes
      if (status >= 400) {
        monitoring.trackEvent('http_error', {
          requestId,
          method,
          path,
          status,
          duration,
          userId,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      const duration = Date.now() - startTime

      // Track error
      if (trackErrors) {
        const errorObj = error instanceof Error ? error : new Error(String(error))

        monitoring.captureException(errorObj, {
          requestId,
          method,
          path,
          userId,
          duration,
          timestamp: Date.now()
        })

        if (eventBus) {
          eventBus.emit(
            CommonEventType.ERROR_OCCURRED,
            {
              requestId,
              error: errorObj,
              context: {
                method,
                path,
                userId,
                duration
              }
            },
            'MonitoringMiddleware'
          )
        }
      }

      // Re-throw the error
      throw error
    }
  }
}

/**
 * Telegram-specific monitoring context middleware
 */
export function createTelegramMonitoringMiddleware(
  monitoring: IMonitoringConnector,
  eventBus?: EventBus
) {
  return createMonitoringContextMiddleware({
    monitoring,
    eventBus,
    getUserId: async ctx => {
      // Extract Telegram user ID from context
      try {
        const body = await ctx.req.json()
        if (body && typeof body === 'object' && 'message' in body) {
          const message = (body as { message?: { from?: { id?: number | string } } }).message
          return message?.from?.id?.toString()
        }
      } catch {
        // Body not JSON or not available
      }
      return undefined
    },
    getUserContext: async ctx => {
      // Extract Telegram user context
      try {
        const body = await ctx.req.json()
        if (body && typeof body === 'object' && 'message' in body) {
          const message = (
            body as {
              message?: {
                from?: {
                  username?: string
                  first_name?: string
                  last_name?: string
                  language_code?: string
                  is_premium?: boolean
                }
              }
            }
          ).message
          const from = message?.from
          if (from) {
            // Use shared FieldMapper for snake_case to camelCase conversion
            return telegramUserMapper.toDomain(from)
          }
        }
      } catch {
        // Body not JSON or not available
      }
      return undefined
    }
  })
}

/**
 * Grammy middleware for monitoring context
 */
// Grammy context type - properly typed version
interface GrammyContext {
  updateType: string
  from?: {
    id?: number | string
    username?: string
    first_name?: string
    last_name?: string
    language_code?: string
    is_premium?: boolean
  }
  chat?: {
    id?: number | string
  }
  message?: {
    message_id?: number
    text?: string
  }
  monitoring?: IMonitoringConnector
  requestId?: string
}

export function createGrammyMonitoringMiddleware(
  monitoring: IMonitoringConnector,
  eventBus?: EventBus
) {
  return async (ctx: GrammyContext, next: () => Promise<void>) => {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()
    const updateType = ctx.updateType
    const userId = ctx.from?.id?.toString()

    // Set monitoring in context
    ctx.monitoring = monitoring
    ctx.requestId = requestId

    // Set user context with shared FieldMapper
    if (userId && ctx.from) {
      const userContext = telegramUserMapper.toDomain(ctx.from)
      monitoring.setUserContext(userId, userContext)
    }

    // Track update start
    monitoring.trackEvent('telegram_update_started', {
      requestId,
      updateType,
      userId,
      chatId: ctx.chat?.id,
      messageId: ctx.message?.message_id,
      timestamp: startTime
    })

    if (eventBus) {
      eventBus.emit(
        CommonEventType.REQUEST_STARTED,
        {
          requestId,
          type: 'telegram_update',
          updateType,
          userId
        },
        'GrammyMonitoring'
      )
    }

    try {
      await next()

      const duration = Date.now() - startTime

      // Track completion
      monitoring.trackMetric('telegram_update_duration', duration, {
        updateType,
        userId: userId || 'anonymous'
      })

      monitoring.trackEvent('telegram_update_completed', {
        requestId,
        updateType,
        userId,
        duration,
        timestamp: Date.now()
      })

      if (eventBus) {
        eventBus.emit(
          CommonEventType.REQUEST_COMPLETED,
          {
            requestId,
            type: 'telegram_update',
            updateType,
            userId,
            duration
          },
          'GrammyMonitoring'
        )
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorObj = error instanceof Error ? error : new Error(String(error))

      // Track error
      monitoring.captureException(errorObj, {
        requestId,
        updateType,
        userId,
        chatId: ctx.chat?.id,
        messageText: ctx.message?.text,
        duration,
        timestamp: Date.now()
      })

      if (eventBus) {
        eventBus.emit(
          CommonEventType.ERROR_OCCURRED,
          {
            requestId,
            error: errorObj,
            context: {
              type: 'telegram_update',
              updateType,
              userId,
              duration
            }
          },
          'GrammyMonitoring'
        )
      }

      throw error
    }
  }
}
