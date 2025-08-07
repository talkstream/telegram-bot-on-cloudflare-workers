/**
 * Tiered Caching System with TTL support
 *
 * Provides multi-layer caching with automatic promotion/demotion
 * and configurable TTL per tier for optimal performance.
 */

import type { ICloudPlatformConnector } from '@/core/interfaces/cloud-platform'
import { logger } from '@/lib/logger'

export interface CacheTier {
  /**
   * Tier name (e.g., 'memory', 'kv', 'storage')
   */
  name: string

  /**
   * Maximum items in this tier
   */
  maxSize: number

  /**
   * Default TTL for items in this tier (ms)
   */
  defaultTTL: number

  /**
   * Weight for scoring (higher = preferred)
   */
  weight: number
}

export interface CacheItem<T> {
  value: T
  key: string
  tier: string
  accessCount: number
  lastAccessed: number
  createdAt: number
  expiresAt: number
  size?: number
}

export interface CacheStats {
  hits: number
  misses: number
  evictions: number
  promotions: number
  demotions: number
  tierStats: Record<
    string,
    {
      items: number
      hits: number
      misses: number
      evictions: number
    }
  >
}

export class TieredCache {
  private static instance: TieredCache | undefined
  private tiers: Map<string, Map<string, CacheItem<unknown>>> = new Map()
  private tierConfigs: Map<string, CacheTier> = new Map()
  private stats: CacheStats
  private platform?: ICloudPlatformConnector
  private accessCounter = 0

  constructor(platform?: ICloudPlatformConnector, tiers: CacheTier[] = []) {
    this.platform = platform

    // Default tiers if none provided
    if (tiers.length === 0) {
      tiers = [
        { name: 'memory', maxSize: 100, defaultTTL: 60000, weight: 10 }, // 1 minute
        { name: 'kv', maxSize: 1000, defaultTTL: 300000, weight: 5 }, // 5 minutes
        { name: 'storage', maxSize: 10000, defaultTTL: 3600000, weight: 1 } // 1 hour
      ]
    }

    // Initialize tiers
    for (const tier of tiers) {
      this.tiers.set(tier.name, new Map())
      this.tierConfigs.set(tier.name, tier)
    }

    // Initialize stats
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      promotions: 0,
      demotions: 0,
      tierStats: {}
    }

    for (const tier of tiers) {
      this.stats.tierStats[tier.name] = {
        items: 0,
        hits: 0,
        misses: 0,
        evictions: 0
      }
    }

    // Start cleanup task
    this.startCleanupTask()
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const now = Date.now()

    // Check each tier in order of weight
    const sortedTiers = Array.from(this.tierConfigs.values()).sort((a, b) => b.weight - a.weight)

    for (const tierConfig of sortedTiers) {
      const tier = this.tiers.get(tierConfig.name)
      if (!tier) continue

      const item = tier.get(key) as CacheItem<T> | undefined

      if (item) {
        // Check if expired
        if (item.expiresAt < now) {
          tier.delete(key)
          const tierStat = this.stats.tierStats[tierConfig.name]
          if (tierStat) {
            tierStat.items--
          }
          continue
        }

        // Update access metadata
        item.accessCount++
        item.lastAccessed = now + this.accessCounter++

        // Update stats
        this.stats.hits++
        const tierStat = this.stats.tierStats[tierConfig.name]
        if (tierStat) {
          tierStat.hits++
        }

        // Consider promotion if frequently accessed
        if (item.accessCount > 5 && tierConfig.weight < 10) {
          await this.promote(item)
        }

        logger.debug('Cache hit', {
          key,
          tier: tierConfig.name,
          accessCount: item.accessCount
        })

        return item.value
      }
    }

    // Try to load from KV
    const kvValue = await this.loadFromKV<T>(key)
    if (kvValue) {
      this.stats.hits++
      return kvValue
    }

    this.stats.misses++
    return null
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string,
    value: T,
    options: {
      tier?: string
      ttl?: number
      size?: number
    } = {}
  ): Promise<void> {
    const tierName = options.tier || 'memory'
    const tierConfig = this.tierConfigs.get(tierName)

    if (!tierConfig) {
      throw new Error(`Unknown cache tier: ${tierName}`)
    }

    const tierCache = this.tiers.get(tierName)
    if (!tierCache) return

    const now = Date.now()
    const ttl = options.ttl || tierConfig.defaultTTL

    // Check if key already exists (update case)
    const existingItem = tierCache.get(key)
    if (existingItem) {
      // Update existing item
      existingItem.value = value as unknown
      existingItem.lastAccessed = now
      existingItem.expiresAt = now + ttl
      return
    }

    // Check if we need to evict BEFORE adding new item
    if (tierCache.size >= tierConfig.maxSize) {
      await this.evictLRU(tierName)
    }

    const item: CacheItem<T> = {
      value,
      key,
      tier: tierName,
      accessCount: 0,
      lastAccessed: now + this.accessCounter++,
      createdAt: now,
      expiresAt: now + ttl,
      size: options.size
    }

    tierCache.set(key, item as CacheItem<unknown>)

    // Update stats - items count should match actual Map size
    if (this.stats.tierStats[tierName]) {
      this.stats.tierStats[tierName].items = tierCache.size
    }

    // Also persist to KV if tier is memory
    if (tierName === 'memory') {
      await this.persistToKV(key, item)
    }

    logger.debug('Cache set', { key, tier: tierName, ttl })
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    for (const [tierName, tier] of this.tiers) {
      if (tier.has(key)) {
        tier.delete(key)
        if (this.stats.tierStats[tierName]) {
          this.stats.tierStats[tierName].items = tier.size
        }
      }
    }

    // Also delete from KV
    try {
      const kv = this.platform?.getKeyValueStore('cache')
      if (kv) {
        await kv.delete(key)
      }
    } catch (error) {
      logger.warn('Failed to delete from KV', { key, error })
    }
  }

  /**
   * Clear entire cache or specific tier
   */
  async clear(tierName?: string): Promise<void> {
    if (tierName) {
      const tier = this.tiers.get(tierName)
      if (tier) {
        // Clear all keys from this tier
        tier.clear()
        if (this.stats.tierStats[tierName]) {
          this.stats.tierStats[tierName].items = 0
        }

        // Also clear from KV if it's memory tier
        if (tierName === 'memory') {
          try {
            const kv = this.platform?.getKeyValueStore('cache')
            if (kv) {
              // Get all keys and delete them
              let cursor: string | undefined
              do {
                const list = await kv.list({ cursor, limit: 100 })
                for (const key of list.keys) {
                  await kv.delete(key.name)
                }
                cursor = list.cursor
              } while (cursor)
            }
          } catch (error) {
            logger.warn('Failed to clear KV cache', { error })
          }
        }
      }
    } else {
      // Clear all tiers
      for (const [name, tier] of this.tiers) {
        tier.clear()
        if (this.stats.tierStats[name]) {
          this.stats.tierStats[name].items = 0
        }
      }

      // Also clear KV
      try {
        const kv = this.platform?.getKeyValueStore('cache')
        if (kv) {
          // Get all keys and delete them
          let cursor: string | undefined
          do {
            const list = await kv.list({ cursor, limit: 100 })
            for (const key of list.keys) {
              await kv.delete(key.name)
            }
            cursor = list.cursor
          } while (cursor)
        }
      } catch (error) {
        logger.warn('Failed to clear KV cache', { error })
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Get cache size info
   */
  getSize(): { tier: string; items: number; maxSize: number }[] {
    return Array.from(this.tierConfigs.entries()).map(([name, config]) => ({
      tier: name,
      items: this.tiers.get(name)?.size || 0,
      maxSize: config.maxSize
    }))
  }

  /**
   * Get singleton instance
   */
  static getInstance(platform?: ICloudPlatformConnector): TieredCache {
    if (!TieredCache.instance) {
      TieredCache.instance = new TieredCache(platform)
    }
    return TieredCache.instance
  }

  /**
   * Promote item to higher tier
   */
  private async promote<T>(item: CacheItem<T>): Promise<void> {
    const currentTierConfig = this.tierConfigs.get(item.tier)
    if (!currentTierConfig) return

    // Find next higher tier
    const higherTier = Array.from(this.tierConfigs.values())
      .filter(t => t.weight > currentTierConfig.weight)
      .sort((a, b) => a.weight - b.weight)[0]

    if (!higherTier) return

    // Move to higher tier
    const currentTier = this.tiers.get(item.tier)
    const targetTier = this.tiers.get(higherTier.name)

    if (currentTier && targetTier) {
      currentTier.delete(item.key)
      const prevTier = currentTierConfig?.name || item.tier
      if (this.stats.tierStats[prevTier]) {
        this.stats.tierStats[prevTier].items = currentTier.size
      }

      item.tier = higherTier.name
      targetTier.set(item.key, item as CacheItem<unknown>)
      const higherTierStat = this.stats.tierStats[higherTier.name]
      if (higherTierStat) {
        higherTierStat.items = targetTier.size
      }

      this.stats.promotions++

      logger.debug('Cache item promoted', {
        key: item.key,
        from: currentTierConfig.name,
        to: higherTier.name
      })
    }
  }

  /**
   * Evict least recently used item
   */
  private async evictLRU(tierName: string): Promise<void> {
    const tier = this.tiers.get(tierName)
    if (!tier || tier.size === 0) return

    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, item] of tier) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      const item = tier.get(oldestKey)
      let demoted = false

      // Try to demote to a lower tier instead of evict
      const tierConfig = this.tierConfigs.get(tierName)
      if (tierConfig) {
        const lowerTier = await this.findLowerTier(tierName)
        if (lowerTier && item) {
          const lowerTierCache = this.tiers.get(lowerTier)
          if (lowerTierCache) {
            // Check if lower tier has space
            const lowerTierConfig = this.tierConfigs.get(lowerTier)
            if (lowerTierConfig && lowerTierCache.size >= lowerTierConfig.maxSize) {
              // Lower tier is full, need to evict from there first
              await this.evictLRU(lowerTier)
            }

            item.tier = lowerTier
            lowerTierCache.set(oldestKey, item)
            this.stats.demotions++
            if (this.stats.tierStats[lowerTier]) {
              this.stats.tierStats[lowerTier].items = lowerTierCache.size
            }
            demoted = true
          }
        }
      }

      // Remove from current tier
      tier.delete(oldestKey)
      if (this.stats.tierStats[tierName]) {
        // Sync items count with actual tier size
        this.stats.tierStats[tierName].items = tier.size
        if (!demoted) {
          this.stats.tierStats[tierName].evictions++
        }
      }

      // Only count as eviction if not demoted
      if (!demoted) {
        this.stats.evictions++
      }

      // Also delete from KV if it's in memory tier and not demoted
      if (!demoted && (tierName === 'memory' || tierName === 'hot' || tierName === 'tiny')) {
        try {
          const kv = this.platform?.getKeyValueStore('cache')
          if (kv) {
            await kv.delete(oldestKey)
          }
        } catch (error) {
          logger.warn('Failed to delete from KV during eviction', { key: oldestKey, error })
        }
      }

      logger.debug('Cache item evicted', {
        key: oldestKey,
        tier: tierName,
        demoted
      })
    }
  }

  /**
   * Find lower tier for demotion
   */
  private async findLowerTier(currentTier: string): Promise<string | null> {
    const currentConfig = this.tierConfigs.get(currentTier)
    if (!currentConfig) return null

    const lowerTier = Array.from(this.tierConfigs.values())
      .filter(t => t.weight < currentConfig.weight)
      .sort((a, b) => b.weight - a.weight)[0]

    if (!lowerTier) return null

    const tierCache = this.tiers.get(lowerTier.name)
    if (!tierCache || tierCache.size >= lowerTier.maxSize) {
      return null
    }

    return lowerTier.name
  }

  /**
   * Load value from KV storage
   */
  private async loadFromKV<T>(key: string): Promise<T | null> {
    try {
      const kv = this.platform?.getKeyValueStore('cache')
      if (!kv) return null

      const jsonData = await kv.get<string>(key)
      if (!jsonData) return null
      const data = JSON.parse(jsonData) as CacheItem<T>
      if (!data) return null

      // Check if expired
      if (data.expiresAt < Date.now()) {
        await kv.delete(key)
        return null
      }

      // Add to memory cache
      const memoryTier = this.tiers.get('memory')
      if (memoryTier) {
        data.tier = 'memory'
        memoryTier.set(key, data as CacheItem<unknown>)
        if (this.stats.tierStats.memory) {
          this.stats.tierStats.memory.items++
        }
      }

      return data.value
    } catch (error) {
      logger.error('Failed to load from KV', { key, error })
      return null
    }
  }

  /**
   * Persist value to KV storage
   */
  private async persistToKV<T>(key: string, item: CacheItem<T>): Promise<void> {
    try {
      const kv = this.platform?.getKeyValueStore('cache')
      if (!kv) return

      const ttlSeconds = Math.floor((item.expiresAt - Date.now()) / 1000)
      if (ttlSeconds > 0) {
        await kv.put(key, JSON.stringify(item), {
          expirationTtl: ttlSeconds
        })
      }
    } catch (error) {
      logger.warn('Failed to persist to KV', { key, error })
    }
  }

  /**
   * Start periodic cleanup task
   */
  private startCleanupTask(): void {
    setInterval(() => {
      this.cleanupExpired().catch(error => {
        logger.error('Cache cleanup failed', { error })
      })
    }, 60000) // Every minute
  }

  /**
   * Clean up expired items
   */
  private async cleanupExpired(): Promise<void> {
    const now = Date.now()
    let cleaned = 0

    for (const [tierName, tier] of this.tiers) {
      const toDelete: string[] = []

      for (const [key, item] of tier) {
        if (item.expiresAt < now) {
          toDelete.push(key)
        }
      }

      for (const key of toDelete) {
        tier.delete(key)
        if (this.stats.tierStats[tierName]) {
          this.stats.tierStats[tierName].items--
        }
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.debug('Cache cleanup completed', { cleaned })
    }
  }
}
