/**
 * Example integration of the notification system
 * Shows how to integrate with your Telegram bot
 */

import { Bot } from 'grammy'
import { TelegramNotificationAdapter } from '../../src/adapters/telegram/notification-adapter'
import { NotificationConnector } from '../../src/connectors/notification-connector'
import { NotificationService } from '../../src/core/services/notification-service'

import type { Env } from '../../src/core/interfaces/cloud'
import type { IEventBus } from '../../src/core/interfaces/event-bus'
import type { ILogger } from '../../src/core/interfaces/logger'
import type { NotificationTemplate } from '../../src/core/interfaces/notification'

// Example templates
const notificationTemplates: Record<string, NotificationTemplate> = {
  'user.welcome': {
    id: 'user.welcome',
    name: 'User Welcome',
    category: 'system',
    content: {
      en: {
        body: "👋 Welcome to {{botName}}!\n\nThank you for joining us. Here's what you can do:\n\n{{features}}\n\nNeed help? Use /help command.",
        parseMode: 'HTML',
        buttons: [
          [
            { text: '📚 View Commands', callbackData: 'show_commands' },
            { text: '⚙️ Settings', callbackData: 'show_settings' }
          ]
        ]
      }
    }
  },
  'transaction.success': {
    id: 'transaction.success',
    name: 'Transaction Success',
    category: 'transaction',
    content: {
      en: {
        body: '✅ <b>Transaction Successful</b>\n\nAmount: {{amount}} {{currency}}\nBalance: {{balance}} {{currency}}\n\nTransaction ID: <code>{{transactionId}}</code>',
        parseMode: 'HTML'
      }
    }
  },
  'service.expiring': {
    id: 'service.expiring',
    name: 'Service Expiring',
    category: 'service',
    content: {
      en: {
        body: '⏰ <b>Service Expiring Soon</b>\n\nYour {{serviceName}} subscription expires in {{daysLeft}} days.\n\nRenew now to avoid service interruption.',
        parseMode: 'HTML',
        buttons: [[{ text: '🔄 Renew Now', callbackData: 'renew_{{serviceId}}' }]]
      }
    }
  }
}

/**
 * Setup notification system
 */
export function setupNotificationSystem(
  bot: Bot,
  env: Env,
  logger: ILogger,
  eventBus: IEventBus
): NotificationService {
  // Create Telegram adapter
  const adapter = new TelegramNotificationAdapter({
    bot,
    defaultLocale: 'en'
  })

  // Create connector with retry logic
  const connector = new NotificationConnector({
    adapter,
    storage: env.KV, // Optional: for tracking notification status
    logger,
    eventBus,
    retryConfig: {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 60000,
      backoffMultiplier: 2
    }
  })

  // Create notification service
  const notificationService = new NotificationService({
    connector,
    logger,
    eventBus,
    defaultLocale: 'en'
  })

  // Setup event listeners
  setupEventListeners(eventBus, logger)

  return notificationService
}

/**
 * Setup event listeners for monitoring
 */
function setupEventListeners(eventBus: IEventBus, logger: ILogger): void {
  eventBus.on('notification:sent', data => {
    logger.info('Notification sent', data)
  })

  eventBus.on('notification:failed', data => {
    logger.error('Notification failed', data)
  })

  eventBus.on('notification:blocked', data => {
    logger.warn('User blocked notifications', data)
  })

  eventBus.on('notification:batch:completed', data => {
    logger.info('Batch notification completed', {
      batchId: data.batchId,
      sent: data.sent,
      failed: data.failed,
      duration: data.duration
    })
  })
}

/**
 * Example usage in your bot commands
 */
export async function handleUserJoin(
  userId: string,
  notificationService: NotificationService
): Promise<void> {
  // Send welcome notification
  await notificationService.send(
    userId,
    'user.welcome',
    {
      type: 'user_join',
      data: {
        botName: 'My Awesome Bot',
        features: '• Create tasks\n• Set reminders\n• Track progress'
      }
    },
    'system'
  )
}

export async function handleTransaction(
  userId: string,
  amount: number,
  balance: number,
  transactionId: string,
  notificationService: NotificationService
): Promise<void> {
  // Send transaction notification
  await notificationService.send(
    userId,
    'transaction.success',
    {
      type: 'transaction',
      data: {
        amount,
        balance,
        currency: 'USD',
        transactionId
      }
    },
    'transaction'
  )
}

export async function handleServiceExpiring(
  userIds: string[],
  serviceName: string,
  serviceId: string,
  daysLeft: number,
  notificationService: NotificationService
): Promise<void> {
  // Send batch notification to all affected users
  await notificationService.sendBatch(
    userIds,
    'service.expiring',
    {
      type: 'service_expiring',
      data: {
        serviceName,
        serviceId,
        daysLeft
      }
    },
    {
      batchSize: 50,
      delayBetweenBatches: 1000
    }
  )
}

/**
 * Example: System-wide announcement
 */
export async function sendAnnouncement(
  message: string,
  notificationService: NotificationService,
  userService: { getAllActiveUsers(): Promise<string[]> }
): Promise<void> {
  // Get all active users
  const userIds = await userService.getAllActiveUsers()

  // Send announcement to everyone
  await notificationService.sendBulk(userIds, `📢 <b>Announcement</b>\n\n${message}`, 'system')
}
