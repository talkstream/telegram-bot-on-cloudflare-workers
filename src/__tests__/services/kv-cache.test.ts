import type { KVNamespace } from '@cloudflare/workers-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockKV } from '../utils/mock-env'

import { KVCache } from '@/shared/utils/kv-cache'

describe('KVCache', () => {
  let mockKV: KVNamespace
  let cache: KVCache

  beforeEach(() => {
    vi.clearAllMocks()
    mockKV = createMockKV()
    cache = new KVCache(mockKV)
  })

  describe('get', () => {
    it('should return cached value', async () => {
      const testData = { foo: 'bar', count: 42 }
      await mockKV.put('test-key', JSON.stringify(testData))

      const result = await cache.get('test-key')
      expect(result).toEqual(testData)
    })

    it('should return null for missing key', async () => {
      const result = await cache.get('missing-key')
      expect(result).toBeNull()
    })

    it('should handle errors gracefully', async () => {
      mockKV.get.mockRejectedValue(new Error('KV error'))

      const result = await cache.get('test-key')
      expect(result).toBeNull()
    })
  })

  describe('set', () => {
    it('should store value in cache', async () => {
      const testData = { foo: 'bar' }
      await cache.set('test-key', testData)

      const stored = mockKV._storage.get('test-key')
      expect(JSON.parse(stored)).toEqual(testData)
    })

    it('should store string values directly', async () => {
      await cache.set('test-key', 'hello world')

      const stored = mockKV._storage.get('test-key')
      expect(stored).toBe('hello world')
    })

    it('should set TTL when provided', async () => {
      await cache.set('test-key', 'value', { ttl: 3600 })

      expect(mockKV.put).toHaveBeenCalledWith('test-key', 'value', {
        expirationTtl: 3600
      })
    })
  })

  describe('delete', () => {
    it('should delete value from cache', async () => {
      await mockKV.put('test-key', 'value')
      await cache.delete('test-key')

      expect(mockKV._storage.has('test-key')).toBe(false)
    })
  })

  describe('has', () => {
    it('should return true for existing key', async () => {
      await mockKV.put('test-key', 'value')

      const exists = await cache.has('test-key')
      expect(exists).toBe(true)
    })

    it('should return false for missing key', async () => {
      const exists = await cache.has('missing-key')
      expect(exists).toBe(false)
    })
  })

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      await mockKV.put('test-key', JSON.stringify({ cached: true }))

      const factory = vi.fn().mockResolvedValue({ cached: false })
      const result = await cache.getOrSet('test-key', factory)

      expect(result).toEqual({ cached: true })
      expect(factory).not.toHaveBeenCalled()
    })

    it('should call factory and cache result if not exists', async () => {
      const factoryResult = { fresh: true }
      const factory = vi.fn().mockResolvedValue(factoryResult)

      const result = await cache.getOrSet('test-key', factory)

      expect(result).toEqual(factoryResult)
      expect(factory).toHaveBeenCalled()

      const cached = await cache.get('test-key')
      expect(cached).toEqual(factoryResult)
    })
  })

  describe('with prefix', () => {
    beforeEach(() => {
      cache = new KVCache(mockKV, { prefix: 'user' })
    })

    it('should add prefix to keys', async () => {
      await cache.set('123', { name: 'John' })

      expect(mockKV.put).toHaveBeenCalledWith('user:123', expect.any(String), expect.any(Object))
    })

    it('should list keys with prefix', async () => {
      await mockKV.put('user:1', 'value1')
      await mockKV.put('user:2', 'value2')
      await mockKV.put('other:3', 'value3')

      const keys = await cache.list()

      expect(keys).toContain('user:1')
      expect(keys).toContain('user:2')
      expect(keys).not.toContain('other:3')
    })
  })

  describe('clear', () => {
    it('should delete all keys with prefix', async () => {
      await mockKV.put('prefix:1', 'value1')
      await mockKV.put('prefix:2', 'value2')
      await mockKV.put('other:3', 'value3')

      await cache.clear('prefix')

      expect(mockKV._storage.has('prefix:1')).toBe(false)
      expect(mockKV._storage.has('prefix:2')).toBe(false)
      expect(mockKV._storage.has('other:3')).toBe(true)
    })
  })
})
