/**
 * User preference interfaces
 * For managing notification preferences
 */

import type { NotificationCategory } from './notification'

export interface NotificationPreferences {
  enabled: boolean
  categories: Record<NotificationCategory, boolean>
  quiet_hours?: {
    enabled: boolean
    start: string // HH:MM format
    end: string // HH:MM format
    timezone: string
  }
}

export interface IUserPreferenceService {
  getNotificationPreferences(userId: string): Promise<NotificationPreferences>
  updateNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void>
}
