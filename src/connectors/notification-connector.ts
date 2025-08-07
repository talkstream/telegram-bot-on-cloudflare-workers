/**
 * Base notification connector with retry logic and batch processing
 * Platform-agnostic implementation for reliable message delivery
 */

import * as Sentry from '@sentry/cloudflare'

import type { IEventBus } from '../core/interfaces/event-bus'
import type { ILogger } from '../core/interfaces/logger'
import type {
  BatchNotificationOptions,
  INotificationAdapter,
  INotificationConnector,
  NotificationMessage,
  NotificationResult,
  RetryConfig
} from '../core/interfaces/notification'
import { NotificationStatus } from '../core/interfaces/notification'
import type { IKeyValueStore } from '../core/interfaces/storage'

interface NotificationConnectorDeps {
  adapter: INotificationAdapter
  storage?: IKeyValueStore
  logger: ILogger
  eventBus: IEventBus
  retryConfig?: RetryConfig
}

export class NotificationConnector implements INotificationConnector {
  private adapter: INotificationAdapter
  private storage?: IKeyValueStore
  private logger: ILogger
  private eventBus: IEventBus
  private retryConfig: RetryConfig
  private activeRetries = new Map<string, NodeJS.Timeout>()

  constructor(deps: NotificationConnectorDeps) {
    this.adapter = deps.adapter
    this.storage = deps.storage
    this.logger = deps.logger
    this.eventBus = deps.eventBus
    this.retryConfig = deps.retryConfig || {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 60000,
      backoffMultiplier: 2
    }
  }

  async send(message: NotificationMessage): Promise<NotificationResult> {
    const span = Sentry.startInactiveSpan({
      op: 'notification.send',
      name: `Send ${message.category} notification`
    })

    try {
      // Check if recipient is reachable
      const reachable = await this.isReachable(message.recipientId)
      if (!reachable) {
        const result: NotificationResult = {
          messageId: message.id,
          status: NotificationStatus.BLOCKED,
          error: 'Recipient is not reachable'
        }

        this.eventBus.emit('notification:blocked', {
          recipientId: message.recipientId,
          reason: 'User blocked or unavailable'
        })

        return result
      }

      // Get user info for locale
      const userInfo = await this.adapter.getUserInfo(message.recipientId)
      const locale = userInfo.locale || 'en'

      // Format message using adapter
      const formattedMessage = await this.adapter.formatMessage(
        {
          id: message.template,
          name: message.template,
          category: message.category,
          content: {
            [locale]: {
              body: message.template
            }
          }
        },
        message.params || {},
        locale
      )

      // Deliver message
      await this.adapter.deliver(message.recipientId, formattedMessage)

      const result: NotificationResult = {
        messageId: message.id,
        status: NotificationStatus.SENT,
        deliveredAt: new Date()
      }

      // Store result if storage available
      if (this.storage) {
        await this.storage.put(
          `notification:${message.id}`,
          JSON.stringify(result),
          { expirationTtl: 86400 } // 24 hours
        )
      }

      this.eventBus.emit('notification:sent', {
        messageId: message.id,
        recipientId: message.recipientId,
        category: message.category,
        templateId: message.template
      })

      span.end()
      return result
    } catch (error) {
      span.setAttribute('error', true)
      span.end()

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isRetryable = this.adapter.isRetryableError(error)
      const retryCount = (message.metadata?.retryCount as number) || 0

      if (isRetryable && retryCount < this.retryConfig.maxAttempts) {
        return this.scheduleRetry(message, errorMessage)
      }

      const result: NotificationResult = {
        messageId: message.id,
        status: NotificationStatus.FAILED,
        error: errorMessage,
        retryCount: retryCount
      }

      this.eventBus.emit('notification:failed', {
        messageId: message.id,
        recipientId: message.recipientId,
        error: errorMessage,
        willRetry: false
      })

      Sentry.captureException(error, {
        tags: {
          component: 'notification-connector',
          messageId: message.id,
          category: message.category
        }
      })

      return result
    }
  }

  async sendBatch(
    messages: NotificationMessage[],
    options: BatchNotificationOptions
  ): Promise<NotificationResult[]> {
    const batchId = `batch-${Date.now()}`
    const results: NotificationResult[] = []
    let processed = 0
    let failed = 0

    this.eventBus.emit('notification:batch:started', {
      batchId,
      totalMessages: messages.length
    })

    // Process in batches
    for (let i = 0; i < messages.length; i += options.batchSize) {
      const batch = messages.slice(i, i + options.batchSize)

      // Send batch concurrently
      const batchResults = await Promise.all(
        batch.map(async message => {
          try {
            const result = await this.send(message)
            if (result.status === NotificationStatus.FAILED) {
              failed++
            }
            return result
          } catch (error) {
            failed++
            return {
              messageId: message.id,
              status: NotificationStatus.FAILED,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })
      )

      results.push(...batchResults)
      processed += batch.length

      this.eventBus.emit('notification:batch:progress', {
        batchId,
        processed,
        total: messages.length,
        failed
      })

      // Delay between batches
      if (i + options.batchSize < messages.length && options.delayBetweenBatches > 0) {
        await this.delay(options.delayBetweenBatches)
      }
    }

    this.eventBus.emit('notification:batch:completed', {
      batchId,
      sent: processed - failed,
      failed,
      duration: Date.now() - parseInt(batchId.split('-')[1] || '0')
    })

    return results
  }

  async isReachable(recipientId: string): Promise<boolean> {
    try {
      return await this.adapter.checkReachability(recipientId)
    } catch (error) {
      this.logger.error('Failed to check reachability', {
        recipientId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }

  async getStatus(messageId: string): Promise<NotificationResult | null> {
    if (!this.storage) {
      return null
    }

    try {
      const stored = await this.storage.get<string>(`notification:${messageId}`)
      if (!stored) {
        return null
      }

      return JSON.parse(stored) as NotificationResult
    } catch (error) {
      this.logger.error('Failed to get notification status', {
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  private async scheduleRetry(
    message: NotificationMessage,
    error: string
  ): Promise<NotificationResult> {
    const retryCount = ((message.metadata?.retryCount as number) || 0) + 1
    const delay = this.calculateRetryDelay(retryCount)

    const result: NotificationResult = {
      messageId: message.id,
      status: NotificationStatus.RETRY,
      error,
      retryCount,
      nextRetryAt: new Date(Date.now() + delay)
    }

    this.eventBus.emit('notification:failed', {
      messageId: message.id,
      recipientId: message.recipientId,
      error,
      willRetry: true
    })

    // Store retry info
    if (this.storage) {
      await this.storage.put(`notification:${message.id}`, JSON.stringify(result), {
        expirationTtl: 86400
      })
    }

    // Schedule retry
    const timeout = setTimeout(async () => {
      this.activeRetries.delete(message.id)

      const retryMessage = {
        ...message,
        metadata: {
          ...message.metadata,
          retryCount
        }
      }

      await this.send(retryMessage)
    }, delay)

    this.activeRetries.set(message.id, timeout)

    return result
  }

  private calculateRetryDelay(attempt: number): number {
    const delay = Math.min(
      this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
      this.retryConfig.maxDelay
    )

    // Add jitter (±10%)
    const jitter = delay * 0.1
    return Math.floor(delay + (Math.random() * 2 - 1) * jitter)
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async stop(): Promise<void> {
    // Cancel all active retries
    for (const [messageId, timeout] of this.activeRetries) {
      clearTimeout(timeout)
      this.logger.info('Cancelled retry for message', { messageId })
    }
    this.activeRetries.clear()
  }
}
