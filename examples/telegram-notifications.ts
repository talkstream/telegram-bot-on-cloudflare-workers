/**
 * Example: Telegram Notification System
 * Shows how to integrate the notification system with Telegram
 */

import { Bot } from 'grammy'
import { TelegramNotificationAdapter } from '../src/adapters/telegram/notification-adapter'
import { NotificationConnector } from '../src/connectors/notification-connector'
import { EventBus } from '../src/core/events/event-bus'
import { NotificationCategory } from '../src/core/interfaces/notification'
import { NotificationService } from '../src/core/services/notification-service'

// Example logger implementation
class ConsoleLogger {
  debug(message: string, meta?: unknown) {
    console.debug(`[DEBUG] ${message}`, meta)
  }

  info(message: string, meta?: unknown) {
    console.info(`[INFO] ${message}`, meta)
  }

  warn(message: string, meta?: unknown) {
    console.warn(`[WARN] ${message}`, meta)
  }

  error(message: string, meta?: unknown) {
    console.error(`[ERROR] ${message}`, meta)
  }
}

// Example KV store implementation
class MemoryKVStore {
  private store = new Map<string, string>()

  async get<T = string>(key: string): Promise<T | null> {
    const value = this.store.get(key)
    return value ? (JSON.parse(value) as T) : null
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }
}

// Initialize services
const bot = new Bot(process.env.BOT_TOKEN || '')
const logger = new ConsoleLogger()
const eventBus = new EventBus()
const kvStore = new MemoryKVStore()

// Create notification adapter
const adapter = new TelegramNotificationAdapter({
  bot,
  defaultLocale: 'en'
})

// Create notification connector
const connector = new NotificationConnector({
  adapter,
  storage: kvStore,
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

// Example usage
async function sendWelcomeNotification(userId: string) {
  await notificationService.send(
    userId,
    'welcome',
    {
      type: 'user_onboarding',
      data: {
        username: 'John Doe',
        registrationDate: new Date().toISOString()
      }
    },
    NotificationCategory.SYSTEM
  )
}

// Example batch notifications
async function sendMaintenanceNotifications(userIds: string[]) {
  await notificationService.sendBatch(
    userIds,
    'maintenance',
    {
      type: 'system_maintenance',
      data: {
        startTime: '2025-01-27 10:00 UTC',
        duration: '2 hours',
        affectedServices: ['API', 'Dashboard']
      }
    },
    {
      batchSize: 50,
      delayBetweenBatches: 1000
    }
  )
}

// Listen to notification events
eventBus.on('notification:sent', event => {
  console.log('Notification sent:', event)
})

eventBus.on('notification:failed', event => {
  console.error('Notification failed:', event)
})

eventBus.on('notification:batch:completed', event => {
  console.log('Batch completed:', event)
})

// Example with custom templates
const templates = {
  welcome: {
    en: {
      body: `Welcome {{username}}!
      
Thank you for joining our platform.
Registration date: {{registrationDate}}`,
      parseMode: 'HTML' as const,
      buttons: [
        [
          {
            text: 'Get Started',
            callbackData: 'start_tutorial'
          },
          {
            text: 'View Help',
            url: 'https://example.com/help'
          }
        ]
      ]
    }
  },
  maintenance: {
    en: {
      body: `<b>System Maintenance Notice</b>

We will be performing scheduled maintenance:
• Start: {{startTime}}
• Duration: {{duration}}
• Affected: {{affectedServices}}

We apologize for any inconvenience.`,
      parseMode: 'HTML' as const
    }
  }
}

export { notificationService, sendMaintenanceNotifications, sendWelcomeNotification, templates }
