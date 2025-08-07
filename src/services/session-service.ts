import type { ResourceConstraints } from '@/core/interfaces/resource-constraints'
import { isConstrainedEnvironment } from '@/core/interfaces/resource-constraints'
import type { IKeyValueStore } from '@/core/interfaces/storage'
import { logger } from '@/lib/logger'
import { MultiLayerCache } from '@/lib/multi-layer-cache'

export interface UserSession {
  userId: number
  step: string
  data: Record<string, unknown>
  lastActivity?: number
  expiresAt?: number
}

export interface SessionOptions {
  ttl?: number // TTL in seconds
}

export class SessionService {
  private sessionsKv: IKeyValueStore
  private cache?: MultiLayerCache
  private constraints?: ResourceConstraints
  private defaultTTL: number
  private cleanupBatchSize: number

  constructor(
    sessionsKv: IKeyValueStore,
    constraints?: ResourceConstraints,
    cache?: MultiLayerCache
  ) {
    this.sessionsKv = sessionsKv
    this.constraints = constraints
    if (cache) {
      this.cache = cache
    }

    // Configure based on resource constraints
    if (constraints) {
      // In constrained environments, use shorter TTLs and smaller batches
      const isConstrained = isConstrainedEnvironment(constraints)
      this.defaultTTL = isConstrained ? 300 : 3600 // 5 minutes or 1 hour
      this.cleanupBatchSize = isConstrained ? 10 : 100
    } else {
      // Default values when no constraints provided
      this.defaultTTL = 3600
      this.cleanupBatchSize = 100
    }
  }

  async getSession(userId: number): Promise<UserSession | null> {
    const key = this.getSessionKey(userId)

    // Try cache first if available
    if (this.cache) {
      const cached = await this.cache.get<UserSession>(key)
      if (cached) {
        // Check if session is expired
        if (this.isSessionExpired(cached)) {
          await this.deleteSession(userId)
          return null
        }
        return cached
      }
    }

    // Fallback to KV
    const session = await this.sessionsKv.get<UserSession>(key)
    if (!session) return null

    // Check expiration
    if (this.isSessionExpired(session)) {
      await this.deleteSession(userId)
      return null
    }

    // Update cache if available
    if (this.cache) {
      await this.cache.set(key, session, {
        ttl: this.defaultTTL,
        tags: ['session']
      })
    }

    return session
  }

  async saveSession(session: UserSession, options?: SessionOptions): Promise<void> {
    const key = this.getSessionKey(session.userId)
    const ttl = options?.ttl || this.defaultTTL

    // Add session metadata
    const enrichedSession: UserSession = {
      ...session,
      lastActivity: Date.now(),
      expiresAt: Date.now() + ttl * 1000
    }

    // Save to KV with TTL
    await this.sessionsKv.put(key, JSON.stringify(enrichedSession), {
      expirationTtl: ttl
    })

    // Update cache if available
    if (this.cache) {
      const tags = ['session']
      // Mark as important in constrained environments
      if (this.constraints && isConstrainedEnvironment(this.constraints)) {
        tags.push('important')
      }
      await this.cache.set(key, enrichedSession, {
        ttl,
        tags
      })
    }

    logger.info('Session saved', {
      userId: session.userId,
      ttl,
      constrained: this.constraints ? isConstrainedEnvironment(this.constraints) : false
    })
  }

  async deleteSession(userId: number): Promise<void> {
    const key = this.getSessionKey(userId)

    // Delete from both cache and KV
    const deletePromises: Promise<void>[] = [this.sessionsKv.delete(key)]

    if (this.cache) {
      deletePromises.push(this.cache.delete(key))
    }

    await Promise.all(deletePromises)

    logger.info('Session deleted', { userId })
  }

  async touchSession(userId: number): Promise<void> {
    const session = await this.getSession(userId)
    if (session) {
      await this.saveSession({
        ...session,
        lastActivity: Date.now()
      })
    }
  }

  /**
   * Clean up expired sessions (for scheduled cleanup)
   */
  async cleanupExpiredSessions(limit?: number): Promise<number> {
    const batchSize = limit || this.cleanupBatchSize

    // Skip cleanup in heavily constrained environments to save operations
    if (this.constraints && isConstrainedEnvironment(this.constraints)) {
      logger.info('Session cleanup skipped in constrained environment')
      return 0
    }

    let cleaned = 0
    const sessions = await this.sessionsKv.list({ limit: batchSize })

    for (const key of sessions.keys) {
      try {
        const session = await this.sessionsKv.get<UserSession>(key.name)
        if (!session) continue

        if (this.isSessionExpired(session)) {
          await this.sessionsKv.delete(key.name)
          cleaned++
        }
      } catch (error) {
        logger.error('Error cleaning session', { key: key.name, error })
      }
    }

    logger.info('Sessions cleaned up', { cleaned, checked: sessions.keys.length })
    return cleaned
  }

  private getSessionKey(userId: number): string {
    return `session:${userId}`
  }

  private isSessionExpired(session: UserSession): boolean {
    if (!session.expiresAt) return false
    return session.expiresAt < Date.now()
  }
}
