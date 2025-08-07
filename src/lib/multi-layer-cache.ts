/**
 * Multi-Layer Caching System
 *
 * Implements a hierarchical caching strategy:
 * 1. Memory Cache (in-request) - Fastest, limited by request lifetime
 * 2. KV Cache (cross-request) - Persistent across requests
 * 3. Cache API (edge caching) - For paid tier, CDN-like caching
 */

import type { KVNamespace } from '@cloudflare/workers-types'

import { logger } from './logger'

import { getTierConfig } from '@/config/cloudflare-tiers'
import type { Env } from '@/types'

export interface CacheOptions {
  ttl?: number
  tags?: string[]
  tier?: 'free' | 'paid'
}

interface CacheStats {
  hits: number
  misses: number
  layer: 'memory' | 'kv' | 'edge'
}

export class MultiLayerCache {
  private memoryCache: Map<string, { value: unknown; expires: number }>
  private kv: KVNamespace
  private cacheApi: Cache | null
  private stats: Map<string, CacheStats>
  private tier: 'free' | 'paid'
  private config: ReturnType<typeof getTierConfig>

  constructor(kv: KVNamespace, tier: 'free' | 'paid' = 'free') {
    this.memoryCache = new Map()
    this.kv = kv
    this.tier = tier
    this.config = getTierConfig(tier)
    this.stats = new Map()

    // Cache API is only available in paid tier
    this.cacheApi = tier === 'paid' && typeof caches !== 'undefined' ? caches.default : null
  }

  /**
   * Get value from cache, checking all layers
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now()

    // 1. Check memory cache first (fastest)
    const memoryValue = this.getFromMemory<T>(key)
    if (memoryValue !== null) {
      this.recordHit('memory')
      logger.info('Cache hit (memory)', { key, duration: Date.now() - startTime })
      return memoryValue
    }

    // 2. Check edge cache (if available)
    if (this.cacheApi && this.config.features.advancedCachingEnabled) {
      const edgeValue = await this.getFromEdge<T>(key)
      if (edgeValue !== null) {
        // Populate memory cache for subsequent requests in this execution
        this.setInMemory(key, edgeValue, 60) // 1 minute in memory
        this.recordHit('edge')
        logger.info('Cache hit (edge)', { key, duration: Date.now() - startTime })
        return edgeValue
      }
    }

    // 3. Check KV cache (slower but persistent)
    const kvValue = await this.getFromKV<T>(key)
    if (kvValue !== null) {
      // Populate higher-level caches
      this.setInMemory(key, kvValue, 60)
      if (this.cacheApi && this.config.features.advancedCachingEnabled) {
        await this.setInEdge(key, kvValue, 300) // 5 minutes in edge
      }
      this.recordHit('kv')
      logger.info('Cache hit (KV)', { key, duration: Date.now() - startTime })
      return kvValue
    }

    // Cache miss
    this.recordMiss()
    logger.info('Cache miss', { key, duration: Date.now() - startTime })
    return null
  }

  /**
   * Set value in cache, populating appropriate layers
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl || this.config.performance.cacheTTL.user

    // Always set in memory cache
    this.setInMemory(key, value, Math.min(ttl, 300)) // Max 5 minutes in memory

    // Set in edge cache if available
    if (this.cacheApi && this.config.features.advancedCachingEnabled && ttl > 60) {
      await this.setInEdge(key, value, ttl)
    }

    // Set in KV cache (be mindful of write limits on free tier)
    if (this.shouldWriteToKV(options)) {
      await this.setInKV(key, value, ttl)
    }
  }

  /**
   * Delete value from all cache layers
   */
  async delete(key: string): Promise<void> {
    // Remove from memory
    this.memoryCache.delete(key)

    // Remove from edge cache
    if (this.cacheApi) {
      try {
        await this.cacheApi.delete(this.buildCacheRequest(key))
      } catch (error) {
        logger.error('Error deleting from edge cache', { error, key })
      }
    }

    // Remove from KV
    try {
      await this.kv.delete(key)
    } catch (error) {
      logger.error('Error deleting from KV cache', { error, key })
    }
  }

  /**
   * Clear cache by prefix or tags
   */
  async clear(options: { prefix?: string; tags?: string[] } = {}): Promise<void> {
    const { prefix, tags } = options

    // Clear memory cache
    if (prefix) {
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(prefix)) {
          this.memoryCache.delete(key)
        }
      }
    } else {
      this.memoryCache.clear()
    }

    // Clear KV cache (be careful with list operations on free tier)
    if (prefix && this.tier === 'paid') {
      const keys = await this.kv.list({ prefix })
      const deletePromises = keys.keys.map(key => this.kv.delete(key.name))
      await Promise.all(deletePromises)
    }

    // Edge cache doesn't support bulk operations
    logger.info('Cache cleared', { prefix, tags })
  }

  /**
   * Get or set pattern for computed values
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Compute value
    const value = await factory()

    // Cache the result
    await this.set(key, value, options)

    return value
  }

  // Private methods for each cache layer

  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key)
    if (!entry) return null

    if (entry.expires > Date.now()) {
      return entry.value as T
    }

    // Expired
    this.memoryCache.delete(key)
    return null
  }

  private setInMemory<T>(key: string, value: T, ttlSeconds: number): void {
    const maxSize = this.config.optimization.inMemoryCacheSize

    // Implement simple LRU eviction if cache is full
    if (this.memoryCache.size >= maxSize) {
      const firstKey = this.memoryCache.keys().next().value
      if (firstKey) {
        this.memoryCache.delete(firstKey)
      }
    }

    this.memoryCache.set(key, {
      value,
      expires: Date.now() + ttlSeconds * 1000
    })
  }

  private async getFromKV<T>(key: string): Promise<T | null> {
    try {
      const value = await this.kv.get(key, 'json')
      return value as T | null
    } catch (error) {
      logger.error('Error reading from KV cache', { error, key })
      return null
    }
  }

  private async setInKV<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.kv.put(key, JSON.stringify(value), {
        expirationTtl: ttlSeconds
      })
    } catch (error) {
      logger.error('Error writing to KV cache', { error, key })
    }
  }

  private async getFromEdge<T>(key: string): Promise<T | null> {
    if (!this.cacheApi) return null

    try {
      const request = this.buildCacheRequest(key)
      const response = await this.cacheApi.match(request)

      if (response) {
        const data = await response.json()
        return data as T
      }
    } catch (error) {
      logger.error('Error reading from edge cache', { error, key })
    }

    return null
  }

  private async setInEdge<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!this.cacheApi) return

    try {
      const request = this.buildCacheRequest(key)
      const response = new Response(JSON.stringify(value), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${ttlSeconds}`
        }
      })

      await this.cacheApi.put(request, response)
    } catch (error) {
      logger.error('Error writing to edge cache', { error, key })
    }
  }

  private buildCacheRequest(key: string): Request {
    // Create a synthetic request for cache API
    return new Request(`https://cache.internal/${key}`, {
      method: 'GET'
    })
  }

  private shouldWriteToKV(options: CacheOptions): boolean {
    // On free tier, be selective about KV writes due to daily limits
    if (this.tier === 'free') {
      // Only cache important data that benefits from persistence
      return options.tags?.includes('important') || false
    }
    return true
  }

  private recordHit(layer: 'memory' | 'kv' | 'edge'): void {
    const key = `${layer}_hit`
    const stats = this.stats.get(key) || { hits: 0, misses: 0, layer }
    stats.hits++
    this.stats.set(key, stats)
  }

  private recordMiss(): void {
    const key = 'total_miss'
    const stats = this.stats.get(key) || { hits: 0, misses: 0, layer: 'memory' }
    stats.misses++
    this.stats.set(key, stats)
  }

  /**
   * Get cache statistics
   */
  getStats(): Record<string, CacheStats> {
    const result: Record<string, CacheStats> = {}
    this.stats.forEach((value, key) => {
      result[key] = value
    })
    return result
  }
}

/**
 * Factory function to create multi-layer cache
 */
export function createMultiLayerCache(env: Env): MultiLayerCache | null {
  if (!env.CACHE) {
    return null
  }
  return new MultiLayerCache(env.CACHE, env.TIER || 'free')
}
