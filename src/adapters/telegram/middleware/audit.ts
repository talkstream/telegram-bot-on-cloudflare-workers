import type { MiddlewareFn } from 'grammy'

import { EventBus } from '@/core/events/event-bus'
import type { AuditEvent, AuditPayload, IAuditMiddleware } from '@/core/middleware/interfaces'
import { logger } from '@/lib/logger'
import type { ExtendedGrammyContext } from '@/types/grammy-extensions'
import type { BotContext } from '@/types/telegram'

/**
 * Telegram-specific audit middleware implementation
 */
export class TelegramAuditMiddleware implements IAuditMiddleware {
  private auditEvents: AuditEvent[] = []

  constructor(
    private eventBus: EventBus,
    private storage?: KVNamespace,
    private maxMemoryEvents: number = 1000
  ) {
    // Listen for audit events from other parts of the system
    this.eventBus.on('audit.action', event => this.handleAuditEvent(event as AuditEvent))
    this.eventBus.on('audit.access', event => this.handleAuditEvent(event as AuditEvent))
    this.eventBus.on('audit.error', event => this.handleAuditEvent(event as AuditEvent))
  }

  private async handleAuditEvent(event: AuditEvent): Promise<void> {
    // Store in memory (limited)
    this.auditEvents.push(event)
    if (this.auditEvents.length > this.maxMemoryEvents) {
      this.auditEvents.shift()
    }

    // Store in KV if available
    if (this.storage) {
      try {
        const key = `audit:${event.timestamp}:${event.payload.userId || 'system'}`
        await this.storage.put(key, JSON.stringify(event), {
          expirationTtl: 30 * 24 * 60 * 60 // 30 days
        })
      } catch (error) {
        logger.error('Failed to store audit event', { error, event })
      }
    }
  }

  async log(payload: AuditPayload): Promise<void> {
    const event: AuditEvent = {
      type: 'audit.action',
      payload,
      source: 'telegram-audit',
      timestamp: Date.now()
    }

    this.eventBus.emit(event.type, event, event.source)
  }

  async getUserAuditTrail(userId: string, limit: number = 50): Promise<AuditEvent[]> {
    // First check memory
    const memoryEvents = this.auditEvents.filter(e => e.payload.userId === userId).slice(-limit)

    if (!this.storage || memoryEvents.length >= limit) {
      return memoryEvents
    }

    // Check storage for more events
    try {
      const prefix = `audit:`
      const list = await this.storage.list({ prefix })
      const events: AuditEvent[] = []

      for (const key of list.keys) {
        if (key.name.includes(userId)) {
          const data = (await this.storage.get(key.name, 'json')) as AuditEvent
          if (data && data.payload.userId === userId) {
            events.push(data)
          }
        }
        if (events.length >= limit) break
      }

      return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit)
    } catch (error) {
      logger.error('Failed to retrieve user audit trail', { error, userId })
      return memoryEvents
    }
  }

  async getResourceAuditTrail(resource: string, limit: number = 50): Promise<AuditEvent[]> {
    // First check memory
    const memoryEvents = this.auditEvents.filter(e => e.payload.resource === resource).slice(-limit)

    if (!this.storage || memoryEvents.length >= limit) {
      return memoryEvents
    }

    // Check storage for more events
    try {
      const prefix = `audit:`
      const list = await this.storage.list({ prefix })
      const events: AuditEvent[] = []

      for (const key of list.keys) {
        const data = (await this.storage.get(key.name, 'json')) as AuditEvent
        if (data && data.payload.resource === resource) {
          events.push(data)
        }
        if (events.length >= limit) break
      }

      return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit)
    } catch (error) {
      logger.error('Failed to retrieve resource audit trail', { error, resource })
      return memoryEvents
    }
  }
}

/**
 * Create Grammy middleware for audit logging
 */
export function createAuditMiddleware(
  auditMiddleware: IAuditMiddleware,
  options?: {
    logCommands?: boolean
    logErrors?: boolean
    logAccess?: boolean
  }
): MiddlewareFn<BotContext> {
  const { logCommands = true, logErrors = true, logAccess = false } = options || {}

  return async (ctx: BotContext & ExtendedGrammyContext, next) => {
    const startTime = Date.now()
    const userId = ctx.from?.id ? `telegram_${ctx.from.id}` : undefined

    // Log access if enabled
    if (logAccess && userId) {
      await auditMiddleware.log({
        action: 'access',
        userId,
        resource: ctx.updateType || 'unknown',
        result: 'success',
        metadata: {
          chatId: ctx.chat?.id,
          messageId: ctx.message?.message_id
        }
      })
    }

    try {
      await next()

      // Log command execution
      if (logCommands && ctx.command) {
        const duration = Date.now() - startTime
        await auditMiddleware.log({
          action: `command.${ctx.command.command}`,
          userId,
          resource: 'telegram_bot',
          result: 'success',
          metadata: {
            command: ctx.command.command,
            args: ctx.command.args,
            duration,
            chatId: ctx.chat?.id
          }
        })
      }
    } catch (error) {
      const duration = Date.now() - startTime

      // Log error
      if (logErrors) {
        await auditMiddleware.log({
          action: ctx.command ? `command.${ctx.command.command}` : 'message',
          userId,
          resource: 'telegram_bot',
          result: 'failure',
          metadata: {
            error:
              error instanceof Error
                ? {
                    message: error.message,
                    name: error.name,
                    stack: error.stack
                  }
                : String(error),
            duration,
            chatId: ctx.chat?.id
          }
        })
      }

      // Re-throw the error
      throw error
    }
  }
}

/**
 * Create audit logger for specific actions
 */
export function createTelegramAuditLogger(auditMiddleware: IAuditMiddleware) {
  return {
    logAdminAction: async (ctx: BotContext, action: string, target?: string) => {
      await auditMiddleware.log({
        action: `admin.${action}`,
        userId: ctx.from?.id ? `telegram_${ctx.from.id}` : undefined,
        resource: 'admin_panel',
        result: 'success',
        metadata: {
          target,
          chatId: ctx.chat?.id,
          fromUsername: ctx.from?.username
        }
      })
    },

    logSecurityEvent: async (ctx: BotContext, event: string, details?: Record<string, unknown>) => {
      await auditMiddleware.log({
        action: `security.${event}`,
        userId: ctx.from?.id ? `telegram_${ctx.from.id}` : undefined,
        resource: 'security',
        result: details?.blocked ? 'failure' : 'success',
        metadata: {
          ...details,
          chatId: ctx.chat?.id,
          fromUsername: ctx.from?.username
        }
      })
    },

    logPaymentEvent: async (ctx: BotContext, event: string, amount?: number, currency?: string) => {
      await auditMiddleware.log({
        action: `payment.${event}`,
        userId: ctx.from?.id ? `telegram_${ctx.from.id}` : undefined,
        resource: 'payment_system',
        result: 'success',
        metadata: {
          amount,
          currency,
          chatId: ctx.chat?.id,
          paymentId: ctx.update.pre_checkout_query?.id
        }
      })
    }
  }
}
