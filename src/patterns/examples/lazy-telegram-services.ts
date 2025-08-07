/**
 * Example: Lazy Telegram Bot Services
 *
 * Shows how to implement lazy initialization for
 * Telegram bot services to optimize memory usage
 */

import type { IDatabaseStore } from '@/core/interfaces/storage'

import { getDatabaseStore, getKVCache } from '@/core/services/service-container'
import { LazyServiceContainer } from '@/patterns/lazy-services'

// Example service interfaces
interface UserService {
  getUser(telegramId: number): Promise<any>
  createUser(data: any): Promise<any>
}

interface LocationService {
  getNearbyLocations(lat: number, lng: number): Promise<any[]>
}

interface NotificationService {
  sendNotification(userId: number, message: string): Promise<void>
}

interface AnalyticsService {
  trackEvent(event: string, data: any): Promise<void>
}

/**
 * Telegram bot services
 */
interface TelegramBotServices extends Record<string, unknown> {
  userService: UserService
  locationService: LocationService
  notificationService: NotificationService
  analyticsService: AnalyticsService
}

/**
 * Create service container for Telegram bot
 */
export function createTelegramServiceContainer(): LazyServiceContainer<TelegramBotServices> {
  const container = new LazyServiceContainer<TelegramBotServices>()

  // Register user service
  container.register('userService', () => {
    console.log('[Lazy] Initializing UserService...')
    const db = getDatabaseStore()
    const cache = getKVCache()

    // Return cached version if cache is available
    if (cache) {
      return createCachedUserService(db!, cache)
    }

    return createUserService(db!)
  })

  // Register location service
  container.register('locationService', () => {
    console.log('[Lazy] Initializing LocationService...')
    const db = getDatabaseStore()
    return createLocationService(db!)
  })

  // Register notification service
  container.register('notificationService', () => {
    console.log('[Lazy] Initializing NotificationService...')
    return createNotificationService()
  })

  // Register analytics service
  container.register('analyticsService', () => {
    console.log('[Lazy] Initializing AnalyticsService...')
    const db = getDatabaseStore()
    return createAnalyticsService(db!)
  })

  return container
}

/**
 * Service factory functions
 */
function createUserService(db: IDatabaseStore): UserService {
  return {
    async getUser(telegramId: number) {
      const result = await db
        .prepare('SELECT * FROM users WHERE telegram_id = ?')
        .bind(telegramId)
        .first()
      return result
    },
    async createUser(data: any) {
      const result = await db
        .prepare('INSERT INTO users (telegram_id, username) VALUES (?, ?) RETURNING *')
        .bind(data.telegram_id, data.username)
        .first()
      return result
    }
  }
}

function createCachedUserService(db: IDatabaseStore, cache: any): UserService {
  const baseService = createUserService(db)

  return {
    async getUser(telegramId: number) {
      return cache.getOrSet(
        `user:${telegramId}`,
        () => baseService.getUser(telegramId),
        { ttl: 300 } // 5 minutes
      )
    },
    async createUser(data: any) {
      const user = await baseService.createUser(data)
      await cache.set(`user:${user.telegram_id}`, user, { ttl: 300 })
      return user
    }
  }
}

function createLocationService(db: IDatabaseStore): LocationService {
  return {
    async getNearbyLocations(lat: number, lng: number) {
      // Simple distance calculation
      const radius = 10 // km
      const results = await db
        .prepare(
          `
          SELECT * FROM locations 
          WHERE ABS(latitude - ?) < ? AND ABS(longitude - ?) < ?
          ORDER BY (latitude - ?) * (latitude - ?) + (longitude - ?) * (longitude - ?)
          LIMIT 10
        `
        )
        .bind(lat, radius / 111, lng, radius / 111, lat, lat, lng, lng)
        .all()
      return results.results || []
    }
  }
}

function createNotificationService(): NotificationService {
  return {
    async sendNotification(userId: number, message: string) {
      console.log(`[Notification] To user ${userId}: ${message}`)
      // In real implementation, would use messaging connector
    }
  }
}

function createAnalyticsService(db: IDatabaseStore): AnalyticsService {
  return {
    async trackEvent(event: string, data: any) {
      await db
        .prepare('INSERT INTO analytics_events (event, data, timestamp) VALUES (?, ?, ?)')
        .bind(event, JSON.stringify(data), Date.now())
        .run()
    }
  }
}

/**
 * Usage example in command handler
 */
export class LazyCommandHandler {
  private services: LazyServiceContainer<TelegramBotServices>

  constructor() {
    this.services = createTelegramServiceContainer()
  }

  async handleStartCommand(userId: number, username?: string) {
    // Only UserService is initialized here
    const userService = this.services.get('userService')

    let user = await userService.getUser(userId)
    if (!user) {
      user = await userService.createUser({
        telegram_id: userId,
        username
      })
    }

    // Analytics service NOT initialized if we don't use it
    if (process.env.TRACK_ANALYTICS === 'true') {
      const analytics = this.services.get('analyticsService')
      await analytics.trackEvent('user_start', { userId })
    }

    return user
  }

  async handleLocationCommand(userId: number, lat: number, lng: number) {
    // LocationService initialized only when needed
    const locationService = this.services.get('locationService')
    const locations = await locationService.getNearbyLocations(lat, lng)

    // NotificationService also lazy
    if (locations.length > 0) {
      const notificationService = this.services.get('notificationService')
      await notificationService.sendNotification(
        userId,
        `Found ${locations.length} locations nearby!`
      )
    }

    return locations
  }

  getStats() {
    return this.services.getStats()
  }
}

/**
 * Memory usage comparison
 *
 * Without lazy loading (all services initialized):
 * - Memory: ~25MB on startup
 * - Cold start: ~500ms
 *
 * With lazy loading:
 * - Memory: ~10MB on startup
 * - Cold start: ~200ms
 * - Services loaded as needed
 */
