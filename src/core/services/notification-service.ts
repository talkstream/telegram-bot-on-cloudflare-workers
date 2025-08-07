/**
 * Universal notification service
 * Platform-agnostic implementation for sending notifications
 */

import type { IEventBus } from '../interfaces/event-bus'
import type { ILogger } from '../interfaces/logger'
import type {
  BatchNotificationOptions,
  INotificationConnector,
  NotificationMessage
} from '../interfaces/notification'
import { NotificationCategory, NotificationPriority } from '../interfaces/notification'
import type { IUserPreferenceService } from '../interfaces/user-preference'

export interface NotificationContext {
  type: string
  data: Record<string, unknown>
  locale?: string
}

export interface NotificationServiceDeps {
  connector: INotificationConnector
  userPreferenceService?: IUserPreferenceService
  logger: ILogger
  eventBus: IEventBus
  defaultLocale?: string
}

export interface INotificationService {
  send(
    recipientId: string,
    template: string,
    context: NotificationContext,
    category?: NotificationCategory
  ): Promise<void>

  sendBatch(
    recipientIds: string[],
    template: string,
    context: NotificationContext,
    options?: BatchNotificationOptions
  ): Promise<void>

  sendBulk(recipientIds: string[], message: string, category?: NotificationCategory): Promise<void>
}

export class NotificationService implements INotificationService {
  private connector: INotificationConnector
  private userPreferenceService?: IUserPreferenceService
  private logger: ILogger
  private eventBus: IEventBus
  private defaultLocale: string

  constructor(deps: NotificationServiceDeps) {
    this.connector = deps.connector
    this.userPreferenceService = deps.userPreferenceService
    this.logger = deps.logger
    this.eventBus = deps.eventBus
    this.defaultLocale = deps.defaultLocale || 'en'
  }

  async send(
    recipientId: string,
    template: string,
    context: NotificationContext,
    category: NotificationCategory = NotificationCategory.SYSTEM
  ): Promise<void> {
    try {
      // Check user preferences if service is available
      if (this.userPreferenceService) {
        const preferences = await this.userPreferenceService.getNotificationPreferences(recipientId)
        if (!preferences.categories[category]) {
          this.logger.debug('Notification blocked by user preference', {
            recipientId,
            category,
            template
          })
          return
        }
      }

      // Create notification message
      const message: NotificationMessage = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        recipientId,
        template,
        params: context.data,
        category,
        priority: this.getPriorityForCategory(category),
        metadata: {
          type: context.type,
          locale: context.locale || this.defaultLocale
        }
      }

      // Send via connector
      const result = await this.connector.send(message)

      // Emit event
      this.eventBus.emit('notification:processed', {
        recipientId,
        template,
        category,
        status: result.status
      })
    } catch (error) {
      this.logger.error('Failed to send notification', {
        recipientId,
        template,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      // Re-throw to let caller handle
      throw error
    }
  }

  async sendBatch(
    recipientIds: string[],
    template: string,
    context: NotificationContext,
    options: BatchNotificationOptions = { batchSize: 50, delayBetweenBatches: 1000 }
  ): Promise<void> {
    const messages: NotificationMessage[] = []
    const category = (context.data.category as NotificationCategory) || NotificationCategory.SYSTEM

    // Filter recipients based on preferences
    const allowedRecipients = await this.filterRecipientsByPreferences(recipientIds, category)

    // Create messages for allowed recipients
    for (const recipientId of allowedRecipients) {
      messages.push({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        recipientId,
        template,
        params: context.data,
        category,
        priority: this.getPriorityForCategory(category),
        metadata: {
          type: context.type,
          locale: context.locale || this.defaultLocale,
          batchId: `batch-${Date.now()}`
        }
      })
    }

    if (messages.length === 0) {
      this.logger.info('No recipients to notify after preference filtering', {
        originalCount: recipientIds.length,
        category
      })
      return
    }

    // Send batch via connector
    await this.connector.sendBatch(messages, options)
  }

  async sendBulk(
    recipientIds: string[],
    message: string,
    category: NotificationCategory = NotificationCategory.SYSTEM
  ): Promise<void> {
    await this.sendBatch(
      recipientIds,
      'bulk-message',
      {
        type: 'bulk',
        data: { message, category }
      },
      { batchSize: 100, delayBetweenBatches: 500 }
    )
  }

  private async filterRecipientsByPreferences(
    recipientIds: string[],
    category: NotificationCategory
  ): Promise<string[]> {
    if (!this.userPreferenceService) {
      return recipientIds
    }

    const allowed: string[] = []

    for (const recipientId of recipientIds) {
      try {
        const preferences = await this.userPreferenceService.getNotificationPreferences(recipientId)
        if (preferences.categories[category]) {
          allowed.push(recipientId)
        }
      } catch (error) {
        // If we can't get preferences, assume notifications are allowed
        this.logger.warn('Failed to get user preferences, allowing notification', {
          recipientId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        allowed.push(recipientId)
      }
    }

    return allowed
  }

  private getPriorityForCategory(category: NotificationCategory): NotificationPriority {
    switch (category) {
      case NotificationCategory.SYSTEM:
        return NotificationPriority.HIGH
      case NotificationCategory.BALANCE:
        return NotificationPriority.MEDIUM
      case NotificationCategory.SERVICE:
        return NotificationPriority.MEDIUM
      default:
        return NotificationPriority.LOW
    }
  }
}
