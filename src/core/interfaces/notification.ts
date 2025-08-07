/**
 * Universal notification system interfaces
 * Platform-agnostic contracts for sending notifications across different messaging platforms
 */

import type { EventBusEvents } from './event-bus.js'

/**
 * Notification categories that users can control
 */
export enum NotificationCategory {
  AUCTION = 'auction',
  BALANCE = 'balance',
  SERVICE = 'service',
  SYSTEM = 'system'
}

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * Notification delivery status
 */
export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  BLOCKED = 'blocked',
  RETRY = 'retry'
}

/**
 * Base notification message interface
 */
export interface NotificationMessage {
  id: string
  recipientId: string
  category: NotificationCategory
  priority: NotificationPriority
  template: string
  params?: Record<string, unknown>
  metadata?: Record<string, unknown>
  scheduledAt?: Date
  expiresAt?: Date
}

/**
 * Notification delivery result
 */
export interface NotificationResult {
  messageId: string
  status: NotificationStatus
  deliveredAt?: Date
  error?: string
  retryCount?: number
  nextRetryAt?: Date
}

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  userId: string
  categories: {
    [K in NotificationCategory]?: boolean
  }
  quiet_hours?: {
    enabled: boolean
    start: string // HH:MM format
    end: string // HH:MM format
    timezone?: string
  }
  blockedUntil?: Date
}

/**
 * Batch notification options
 */
export interface BatchNotificationOptions {
  batchSize: number
  delayBetweenBatches: number
  priority?: NotificationPriority
  skipBlocked?: boolean
  respectQuietHours?: boolean
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableErrors?: string[]
}

/**
 * Notification template
 */
export interface NotificationTemplate {
  id: string
  name: string
  category: NotificationCategory
  content: {
    [locale: string]: {
      subject?: string
      body: string
      actions?: Array<{
        type: string
        label: string
        url?: string
        data?: Record<string, unknown>
      }>
    }
  }
  variables?: Array<{
    name: string
    type: 'string' | 'number' | 'boolean' | 'date'
    required: boolean
    format?: string
  }>
}

/**
 * Notification connector interface - low-level message delivery
 */
export interface INotificationConnector {
  /**
   * Send a single notification
   */
  send(message: NotificationMessage): Promise<NotificationResult>

  /**
   * Send notifications in batches
   */
  sendBatch(
    messages: NotificationMessage[],
    options: BatchNotificationOptions
  ): Promise<NotificationResult[]>

  /**
   * Check if recipient is reachable
   */
  isReachable(recipientId: string): Promise<boolean>

  /**
   * Get delivery status for a message
   */
  getStatus(messageId: string): Promise<NotificationResult | null>
}

/**
 * Notification service interface - high-level business logic
 */
export interface INotificationService {
  /**
   * Send notification using template
   */
  notify(
    recipientId: string,
    templateId: string,
    params?: Record<string, unknown>,
    options?: {
      priority?: NotificationPriority
      scheduledAt?: Date
      expiresAt?: Date
    }
  ): Promise<NotificationResult>

  /**
   * Send bulk notifications
   */
  notifyBulk(
    recipientIds: string[],
    templateId: string,
    params?: Record<string, unknown>,
    options?: BatchNotificationOptions
  ): Promise<NotificationResult[]>

  /**
   * Get user preferences
   */
  getUserPreferences(userId: string): Promise<NotificationPreferences>

  /**
   * Update user preferences
   */
  updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void>

  /**
   * Register notification template
   */
  registerTemplate(template: NotificationTemplate): Promise<void>

  /**
   * Get all templates
   */
  getTemplates(category?: NotificationCategory): Promise<NotificationTemplate[]>
}

/**
 * Events emitted by notification system
 */
export interface NotificationEvents extends EventBusEvents {
  'notification:sent': {
    messageId: string
    recipientId: string
    category: NotificationCategory
    templateId: string
  }
  'notification:failed': {
    messageId: string
    recipientId: string
    error: string
    willRetry: boolean
  }
  'notification:blocked': {
    recipientId: string
    reason: string
  }
  'notification:batch:started': {
    batchId: string
    totalMessages: number
  }
  'notification:batch:progress': {
    batchId: string
    processed: number
    total: number
    failed: number
  }
  'notification:batch:completed': {
    batchId: string
    sent: number
    failed: number
    duration: number
  }
}

/**
 * Platform-specific notification adapter
 */
export interface INotificationAdapter {
  /**
   * Format message for specific platform
   */
  formatMessage(
    template: NotificationTemplate,
    params: Record<string, unknown>,
    locale: string
  ): Promise<unknown>

  /**
   * Handle platform-specific delivery
   */
  deliver(recipientId: string, message: unknown): Promise<void>

  /**
   * Check platform-specific reachability
   */
  checkReachability(recipientId: string): Promise<boolean>

  /**
   * Handle platform-specific errors
   */
  isRetryableError(error: unknown): boolean

  /**
   * Get platform-specific user info
   */
  getUserInfo(recipientId: string): Promise<{
    locale?: string
    timezone?: string
    blocked?: boolean
  }>
}
