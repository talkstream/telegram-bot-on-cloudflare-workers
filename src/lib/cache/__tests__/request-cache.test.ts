import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RequestCache, RequestCacheFactory } from '../request-cache'
// Cached decorator can be imported when decorators are configured
// import { Cached } from '../request-cache';

describe('RequestCache', () => {
  let cache: RequestCache

  beforeEach(() => {
    cache = new RequestCache()
  })

  describe('getOrCompute', () => {
    it('should compute value on first call', async () => {
      const compute = vi.fn().mockResolvedValue('computed value')

      const result = await cache.getOrCompute('key1', compute)

      expect(result).toBe('computed value')
      expect(compute).toHaveBeenCalledTimes(1)
    })

    it('should return cached value on second call', async () => {
      const compute = vi.fn().mockResolvedValue('computed value')

      const result1 = await cache.getOrCompute('key1', compute)
      const result2 = await cache.getOrCompute('key1', compute)

      expect(result1).toBe('computed value')
      expect(result2).toBe('computed value')
      expect(compute).toHaveBeenCalledTimes(1) // Only called once
    })

    it('should handle concurrent requests for same key', async () => {
      let resolveCompute: (value: string) => void
      const computePromise = new Promise<string>(resolve => {
        resolveCompute = resolve
      })

      const compute = vi.fn().mockReturnValue(computePromise)

      // Start two concurrent requests
      const promise1 = cache.getOrCompute('key1', compute)
      const promise2 = cache.getOrCompute('key1', compute)

      // Compute should only be called once
      expect(compute).toHaveBeenCalledTimes(1)

      // Resolve the computation
      resolveCompute?.('computed value')

      const [result1, result2] = await Promise.all([promise1, promise2])

      expect(result1).toBe('computed value')
      expect(result2).toBe('computed value')
      expect(compute).toHaveBeenCalledTimes(1)
    })

    it('should handle errors in computation', async () => {
      const error = new Error('Computation failed')
      const compute = vi.fn().mockRejectedValue(error)

      await expect(cache.getOrCompute('key1', compute)).rejects.toThrow('Computation failed')

      // Should not cache failed computations
      const compute2 = vi.fn().mockResolvedValue('success')
      const result = await cache.getOrCompute('key1', compute2)

      expect(result).toBe('success')
      expect(compute2).toHaveBeenCalledTimes(1)
    })

    it('should respect TTL when provided', async () => {
      const compute = vi.fn().mockResolvedValue('value')

      // Set with 100ms TTL
      await cache.getOrCompute('key1', compute, 100)

      // Should return cached value immediately
      const result1 = await cache.getOrCompute('key1', compute)
      expect(result1).toBe('value')
      expect(compute).toHaveBeenCalledTimes(1)

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150))

      // Should compute again after TTL
      const result2 = await cache.getOrCompute('key1', compute)
      expect(result2).toBe('value')
      expect(compute).toHaveBeenCalledTimes(2)
    })
  })

  describe('get/set/delete', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')
    })

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined()
    })

    it('should delete values', () => {
      cache.set('key1', 'value1')
      expect(cache.delete('key1')).toBe(true)
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.delete('key1')).toBe(false)
    })

    it('should clear all values', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      cache.clear()

      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBeUndefined()
    })
  })

  describe('namespacing', () => {
    it('should use namespace in keys', async () => {
      const namespacedCache = new RequestCache({ namespace: 'users' })
      const compute = vi.fn().mockResolvedValue('user data')

      await namespacedCache.getOrCompute('123', compute)

      // Different namespace should not share cache
      const otherCache = new RequestCache({ namespace: 'posts' })
      await otherCache.getOrCompute('123', compute)

      expect(compute).toHaveBeenCalledTimes(2)
    })
  })

  describe('statistics', () => {
    it('should track hits and misses', async () => {
      const compute = vi.fn().mockResolvedValue('value')

      // First call - miss
      await cache.getOrCompute('key1', compute)

      // Second call - hit
      await cache.getOrCompute('key1', compute)

      // Third call - hit
      await cache.getOrCompute('key1', compute)

      // Different key - miss
      await cache.getOrCompute('key2', compute)

      const stats = cache.getStats()
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(2)
      expect(stats.total).toBe(4)
      expect(stats.hitRate).toBe(0.5)
      expect(stats.size).toBe(2)
    })
  })
})

describe('RequestCacheFactory', () => {
  it('should create cache instances', () => {
    const cache = RequestCacheFactory.create()
    expect(cache).toBeInstanceOf(RequestCache)
  })

  it('should create namespaced caches', () => {
    const cache = RequestCacheFactory.createNamespaced('users')
    expect(cache).toBeInstanceOf(RequestCache)
  })
})

describe('Method caching pattern', () => {
  it('should cache method results using cache wrapper', async () => {
    const cache = new RequestCache()

    // Create a service with cached method pattern
    class TestService {
      private callCount = 0

      async getData(id: string): Promise<string> {
        // Simulate what @Cached decorator would do
        return cache.getOrCompute(`getData:${id}`, async () => {
          this.callCount++
          // Simulate expensive operation
          await new Promise(resolve => setTimeout(resolve, 10))
          return `data-${id}-${this.callCount}`
        })
      }

      getCallCount(): number {
        return this.callCount
      }
    }

    const service = new TestService()

    // First call - should compute
    const result1 = await service.getData('user1')
    expect(result1).toBe('data-user1-1')
    expect(service.getCallCount()).toBe(1)

    // Second call with same ID - should use cache
    const result2 = await service.getData('user1')
    expect(result2).toBe('data-user1-1') // Same result
    expect(service.getCallCount()).toBe(1) // No additional computation

    // Call with different ID - should compute
    const result3 = await service.getData('user2')
    expect(result3).toBe('data-user2-2')
    expect(service.getCallCount()).toBe(2)
  })
})

describe('Production Scenarios', () => {
  it('should handle database query deduplication', async () => {
    // Simulate a database service
    const dbQuery = vi
      .fn()
      .mockImplementation((_query: string) => Promise.resolve([{ id: 1, name: 'User 1' }]))

    const cache = new RequestCache()

    // Simulate multiple components requesting same data
    const getUserById = (id: string) =>
      cache.getOrCompute(`user:${id}`, () => dbQuery(`SELECT * FROM users WHERE id = ${id}`))

    // Multiple calls within same request
    const [user1, user2, user3] = await Promise.all([
      getUserById('123'),
      getUserById('123'),
      getUserById('123')
    ])

    expect(dbQuery).toHaveBeenCalledTimes(1)
    expect(user1).toEqual(user2)
    expect(user2).toEqual(user3)
  })

  it('should reduce response time significantly', async () => {
    const cache = new RequestCache()

    // Simulate slow database query
    const slowQuery = vi
      .fn()
      .mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('data'), 50)))

    const start = Date.now()

    // Without cache: 3 * 50ms = 150ms
    // With cache: 1 * 50ms = 50ms (67% reduction)
    await Promise.all([
      cache.getOrCompute('key', slowQuery),
      cache.getOrCompute('key', slowQuery),
      cache.getOrCompute('key', slowQuery)
    ])

    const duration = Date.now() - start

    expect(slowQuery).toHaveBeenCalledTimes(1)
    expect(duration).toBeLessThan(100) // Should be around 50ms, not 150ms
  })
})
