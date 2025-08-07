/**
 * Tests for Tiered Cache System
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CacheTier } from '../tiered-cache'
import { TieredCache } from '../tiered-cache'

import type { ICloudPlatformConnector } from '@/core/interfaces/cloud-platform'
import type {
  ICacheStore,
  IDatabaseStore,
  IKeyValueStore,
  IObjectStore,
  IQueueStore
} from '@/core/interfaces/storage'

// Mock KV store
class MockKeyValueStore implements IKeyValueStore {
  private store = new Map<string, { value: string; expiresAt?: number }>()

  async get<T = string>(key: string): Promise<T | null> {
    const item = this.store.get(key)
    if (!item) return null

    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.store.delete(key)
      return null
    }

    return item.value as T
  }

  async getWithMetadata<T = string>(
    key: string
  ): Promise<{ value: T | null; metadata: Record<string, unknown> | null }> {
    const value = await this.get<T>(key)
    return { value, metadata: null }
  }

  async put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: { expirationTtl?: number; metadata?: Record<string, unknown> }
  ): Promise<void> {
    const expiresAt = options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : undefined

    this.store.set(key, {
      value: typeof value === 'string' ? value : JSON.stringify(value),
      expiresAt
    })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string; metadata?: Record<string, unknown> }>
    list_complete: boolean
    cursor?: string
  }> {
    const allKeys = Array.from(this.store.keys())
    const filtered = options?.prefix ? allKeys.filter(k => k.startsWith(options.prefix)) : allKeys

    // Simple cursor implementation for testing
    const startIndex = options?.cursor ? parseInt(options.cursor, 10) : 0
    const limit = options?.limit || filtered.length
    const endIndex = Math.min(startIndex + limit, filtered.length)
    const selectedKeys = filtered.slice(startIndex, endIndex)

    const keys = selectedKeys.map(name => ({ name }))
    const list_complete = endIndex >= filtered.length
    const cursor = list_complete ? undefined : endIndex.toString()

    return { keys, list_complete, cursor }
  }
}

// Mock cloud platform
class MockCloudPlatform implements ICloudPlatformConnector {
  readonly platform = 'mock'
  private kvStores = new Map<string, IKeyValueStore>()

  constructor() {
    this.kvStores.set('cache', new MockKeyValueStore())
  }

  getKeyValueStore(namespace: string): IKeyValueStore {
    return this.kvStores.get(namespace) || new MockKeyValueStore()
  }

  getDatabaseStore(): IDatabaseStore {
    throw new Error('Not implemented')
  }

  getObjectStore(): IObjectStore {
    throw new Error('Not implemented')
  }

  getCacheStore(): ICacheStore | null {
    return null
  }

  getQueueStore(): IQueueStore {
    throw new Error('Not implemented')
  }

  getResourceConstraints() {
    return {
      maxRequestDuration: 10,
      maxMemory: 128,
      maxCPUTime: 10,
      maxSubrequests: 50,
      hasEdgeCache: true,
      hasWebSockets: false,
      hasCron: true,
      hasQueues: false
    }
  }

  getEnv() {
    return {}
  }

  handleScheduled(): void {}

  handleQueue(): void {}

  handleEmail(): void {}
}

describe('TieredCache', () => {
  let cache: TieredCache
  let platform: ICloudPlatformConnector

  beforeEach(() => {
    vi.useFakeTimers()
    platform = new MockCloudPlatform()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('basic operations', () => {
    beforeEach(() => {
      cache = new TieredCache(platform)
    })

    it('should store and retrieve values', async () => {
      await cache.set('key1', 'value1')
      const value = await cache.get<string>('key1')
      expect(value).toBe('value1')
    })

    it('should return null for missing keys', async () => {
      const value = await cache.get('missing')
      expect(value).toBeNull()
    })

    it('should delete values', async () => {
      await cache.set('key1', 'value1')
      await cache.delete('key1')
      const value = await cache.get('key1')
      expect(value).toBeNull()
    })

    it('should clear cache', async () => {
      await cache.set('key1', 'value1')
      await cache.set('key2', 'value2')
      await cache.clear()

      const value1 = await cache.get('key1')
      const value2 = await cache.get('key2')

      expect(value1).toBeNull()
      expect(value2).toBeNull()
    })
  })

  describe('tier management', () => {
    beforeEach(() => {
      const tiers: CacheTier[] = [
        { name: 'hot', maxSize: 2, defaultTTL: 1000, weight: 10 },
        { name: 'warm', maxSize: 3, defaultTTL: 5000, weight: 5 },
        { name: 'cold', maxSize: 5, defaultTTL: 10000, weight: 1 }
      ]
      cache = new TieredCache(platform, tiers)
    })

    it('should respect tier configuration', async () => {
      await cache.set('key1', 'value1', { tier: 'hot' })
      await cache.set('key2', 'value2', { tier: 'warm' })
      await cache.set('key3', 'value3', { tier: 'cold' })

      const size = cache.getSize()

      expect(size.find(s => s.tier === 'hot')?.items).toBe(1)
      expect(size.find(s => s.tier === 'warm')?.items).toBe(1)
      expect(size.find(s => s.tier === 'cold')?.items).toBe(1)
    })

    it('should evict LRU when tier is full', async () => {
      // Create a cache with a smaller hot tier for testing
      const smallTiers: CacheTier[] = [{ name: 'hot', maxSize: 2, defaultTTL: 1000, weight: 10 }]
      const testCache = new TieredCache(platform, smallTiers)

      // Fill hot tier (max 2)
      await testCache.set('key1', 'value1', { tier: 'hot' })
      await testCache.set('key2', 'value2', { tier: 'hot' })

      // Check that hot tier is full
      let size = testCache.getSize()
      let hotTierSize = size.find(s => s.tier === 'hot')?.items
      expect(hotTierSize).toBe(2)

      // Access key2 to make it more recent
      await testCache.get('key2')

      // Add another, should evict key1
      await testCache.set('key3', 'value3', { tier: 'hot' })

      // Check that tier has correct size after eviction
      size = testCache.getSize()
      hotTierSize = size.find(s => s.tier === 'hot')?.items
      expect(hotTierSize).toBe(2)

      // Check stats
      const stats = testCache.getStats()
      expect(stats.evictions).toBeGreaterThan(0)

      // Verify key1 was evicted
      const value1 = await testCache.get('key1')
      expect(value1).toBeNull()

      // Verify key2 and key3 remain
      const value2 = await testCache.get('key2')
      const value3 = await testCache.get('key3')
      expect(value2).toBe('value2')
      expect(value3).toBe('value3')
    })

    it('should promote frequently accessed items', async () => {
      await cache.set('key1', 'value1', { tier: 'warm' })

      // Access multiple times to trigger promotion
      for (let i = 0; i < 6; i++) {
        await cache.get('key1')
      }

      // Item should be promoted to hot tier
      const stats = cache.getStats()
      expect(stats.promotions).toBeGreaterThan(0)
    })
  })

  describe('TTL handling', () => {
    beforeEach(() => {
      cache = new TieredCache(platform)
    })

    it('should expire items after TTL', async () => {
      await cache.set('key1', 'value1', { ttl: 1000 }) // 1 second

      // Advance time past TTL
      vi.advanceTimersByTime(1500)

      const value = await cache.get('key1')
      expect(value).toBeNull()
    })

    it('should use tier default TTL if not specified', async () => {
      await cache.set('key1', 'value1', { tier: 'memory' })

      // Default memory TTL is 60000ms (1 minute)
      vi.advanceTimersByTime(30000) // 30 seconds
      let value = await cache.get('key1')
      expect(value).toBe('value1') // Still valid

      vi.advanceTimersByTime(31000) // Total 61 seconds
      value = await cache.get('key1')
      expect(value).toBeNull() // Expired
    })

    it('should clean up expired items periodically', async () => {
      await cache.set('key1', 'value1', { ttl: 1000 })
      await cache.set('key2', 'value2', { ttl: 2000 })

      // Advance time to trigger cleanup
      vi.advanceTimersByTime(61000) // Cleanup runs every minute

      const value1 = await cache.get('key1')
      const value2 = await cache.get('key2')

      expect(value1).toBeNull()
      expect(value2).toBeNull()
    })
  })

  describe('statistics', () => {
    beforeEach(() => {
      cache = new TieredCache(platform)
    })

    it('should track hits and misses', async () => {
      await cache.set('key1', 'value1')

      await cache.get('key1') // Hit
      await cache.get('key2') // Miss
      await cache.get('key1') // Hit
      await cache.get('key3') // Miss

      const stats = cache.getStats()
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(2)
    })

    it('should track evictions', async () => {
      const tiers: CacheTier[] = [{ name: 'tiny', maxSize: 2, defaultTTL: 1000, weight: 10 }]
      const evictCache = new TieredCache(platform, tiers)

      await evictCache.set('key1', 'value1', { tier: 'tiny' })
      await evictCache.set('key2', 'value2', { tier: 'tiny' })

      // Access key2 to make it more recent
      await evictCache.get('key2')

      await evictCache.set('key3', 'value3', { tier: 'tiny' }) // Should evict key1

      const stats = evictCache.getStats()
      expect(stats.evictions).toBe(1)

      const size = evictCache.getSize()
      expect(size.find(s => s.tier === 'tiny')?.items).toBe(2)

      // Verify key1 was evicted
      const value1 = await evictCache.get('key1')
      expect(value1).toBeNull()
    })

    it('should track tier-specific stats', async () => {
      await cache.set('key1', 'value1', { tier: 'memory' })
      await cache.get('key1')
      await cache.get('missing')

      const stats = cache.getStats()
      expect(stats.tierStats.memory.items).toBe(1)
      expect(stats.tierStats.memory.hits).toBe(1)
    })
  })

  describe('KV persistence', () => {
    beforeEach(() => {
      cache = new TieredCache(platform)
    })

    it('should persist memory items to KV', async () => {
      await cache.set('key1', { data: 'test' }, { tier: 'memory' })

      // Create a new cache instance to simulate cold start
      const newCache = new TieredCache(platform)

      // Should load from KV
      const value = await newCache.get<{ data: string }>('key1')
      expect(value).toEqual({ data: 'test' })
    })

    it('should respect TTL in KV storage', async () => {
      await cache.set('key1', 'value1', { ttl: 1000 })

      // Clear memory cache
      await cache.clear('memory')

      // Advance time past TTL
      vi.advanceTimersByTime(1500)

      // Should not load expired item from KV
      const value = await cache.get('key1')
      expect(value).toBeNull()
    })
  })

  describe('error handling', () => {
    it('should handle invalid tier names', async () => {
      cache = new TieredCache(platform)

      await expect(cache.set('key1', 'value1', { tier: 'invalid' })).rejects.toThrow(
        'Unknown cache tier: invalid'
      )
    })

    it('should handle KV failures gracefully', async () => {
      const failingPlatform = {
        ...platform,
        getKeyValueStore: () => {
          throw new Error('KV unavailable')
        }
      } as ICloudPlatformConnector

      cache = new TieredCache(failingPlatform)

      // Should still work with memory cache
      await cache.set('key1', 'value1')
      const value = await cache.get('key1')
      expect(value).toBe('value1')
    })
  })
})
