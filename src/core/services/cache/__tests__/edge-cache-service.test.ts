import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ILogger } from '../../../interfaces/logger'
import { EdgeCacheService } from '../edge-cache-service'

// Mock the global caches API
const mockCacheApi = {
  match: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}

// Mock the global caches object
vi.stubGlobal('caches', {
  default: mockCacheApi
})

describe('EdgeCacheService', () => {
  let service: EdgeCacheService
  let mockLogger: ILogger

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnThis(),
      setContext: vi.fn()
    }

    service = new EdgeCacheService({
      baseUrl: 'https://test.cache',
      logger: mockLogger
    })
  })

  describe('get', () => {
    it('should return cached response when available', async () => {
      const mockResponse = new Response('cached data')
      mockResponse.headers.set('expires', new Date(Date.now() + 10000).toISOString())
      mockCacheApi.match.mockResolvedValue(mockResponse)

      const result = await service.get('test-key')

      expect(result).toBe(mockResponse)
      expect(mockCacheApi.match).toHaveBeenCalledWith('https://test.cache/test-key')
    })

    it('should return null when cache miss', async () => {
      mockCacheApi.match.mockResolvedValue(undefined)

      const result = await service.get('test-key')

      expect(result).toBeNull()
    })

    it('should return null and delete expired entries', async () => {
      const mockResponse = new Response('expired data')
      mockResponse.headers.set('expires', new Date(Date.now() - 10000).toISOString())
      mockCacheApi.match.mockResolvedValue(mockResponse)
      mockCacheApi.delete.mockResolvedValue(true)

      const result = await service.get('test-key')

      expect(result).toBeNull()
      expect(mockCacheApi.delete).toHaveBeenCalledWith('https://test.cache/test-key')
    })

    it('should handle errors gracefully', async () => {
      mockCacheApi.match.mockRejectedValue(new Error('Cache error'))

      const result = await service.get('test-key')

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith('Edge cache get error', {
        error: expect.any(Error),
        key: 'test-key'
      })
    })
  })

  describe('put', () => {
    it('should store response in cache', async () => {
      const response = new Response('test data')

      await service.put('test-key', response)

      expect(mockCacheApi.put).toHaveBeenCalledWith('https://test.cache/test-key', response)
      expect(mockLogger.debug).toHaveBeenCalledWith('Edge cache put', { key: 'test-key' })
    })

    it('should handle errors gracefully', async () => {
      const response = new Response('test data')
      mockCacheApi.put.mockRejectedValue(new Error('Put error'))

      await service.put('test-key', response)

      expect(mockLogger.error).toHaveBeenCalledWith('Edge cache put error', {
        error: expect.any(Error),
        key: 'test-key'
      })
    })
  })

  describe('getJSON', () => {
    it('should return parsed JSON data', async () => {
      const testData = { foo: 'bar' }
      const mockResponse = new Response(JSON.stringify(testData))
      mockResponse.headers.set('expires', new Date(Date.now() + 10000).toISOString())
      mockCacheApi.match.mockResolvedValue(mockResponse)

      const result = await service.getJSON<typeof testData>('test-key')

      expect(result).toEqual(testData)
      expect(mockLogger.debug).toHaveBeenCalledWith('Edge cache hit', { key: 'test-key' })
    })

    it('should return null for expired entries', async () => {
      const testData = { foo: 'bar' }
      const mockResponse = new Response(JSON.stringify(testData))
      mockResponse.headers.set('expires', new Date(Date.now() - 10000).toISOString())
      mockCacheApi.match.mockResolvedValue(mockResponse)
      mockCacheApi.delete.mockResolvedValue(true)

      const result = await service.getJSON('test-key')

      expect(result).toBeNull()
      expect(mockCacheApi.delete).toHaveBeenCalled()
    })
  })

  describe('set', () => {
    it('should store JSON data with proper headers', async () => {
      const testData = { foo: 'bar' }

      await service.set('test-key', testData, {
        ttl: 600,
        tags: ['test', 'cache'],
        browserTTL: 300,
        edgeTTL: 600
      })

      expect(mockCacheApi.put).toHaveBeenCalledWith(
        'https://test.cache/test-key',
        expect.objectContaining({
          headers: expect.any(Headers)
        })
      )

      const putCall = mockCacheApi.put.mock.calls[0]
      const response = putCall[1] as Response
      const headers = response.headers

      expect(headers.get('Content-Type')).toBe('application/json')
      expect(headers.get('Cache-Control')).toBe('public, max-age=300, s-maxage=600')
      expect(headers.get('X-Cache-Tags')).toBe('test,cache')
    })

    it('should use default TTL when not specified', async () => {
      const testData = { foo: 'bar' }

      await service.set('test-key', testData)

      const putCall = mockCacheApi.put.mock.calls[0]
      const response = putCall[1] as Response
      const headers = response.headers

      expect(headers.get('Cache-Control')).toBe('public, max-age=300, s-maxage=300')
    })
  })

  describe('delete', () => {
    it('should delete item from cache', async () => {
      mockCacheApi.delete.mockResolvedValue(true)

      await service.delete('test-key')

      expect(mockCacheApi.delete).toHaveBeenCalledWith('https://test.cache/test-key')
      expect(mockLogger.debug).toHaveBeenCalledWith('Edge cache delete', { key: 'test-key' })
    })

    it('should handle delete errors gracefully', async () => {
      mockCacheApi.delete.mockRejectedValue(new Error('Delete error'))

      await service.delete('test-key')

      expect(mockLogger.error).toHaveBeenCalledWith('Edge cache delete error', {
        error: expect.any(Error),
        key: 'test-key'
      })
    })
  })

  describe('getOrSet', () => {
    it('should return cached value when available', async () => {
      const testData = { foo: 'bar' }
      const mockResponse = new Response(JSON.stringify(testData))
      mockResponse.headers.set('expires', new Date(Date.now() + 10000).toISOString())
      mockCacheApi.match.mockResolvedValue(mockResponse)

      const factory = vi.fn()
      const result = await service.getOrSet('test-key', factory)

      expect(result).toEqual(testData)
      expect(factory).not.toHaveBeenCalled()
    })

    it('should call factory and cache result on miss', async () => {
      mockCacheApi.match.mockResolvedValue(undefined)
      const testData = { foo: 'bar' }
      const factory = vi.fn().mockResolvedValue(testData)

      const result = await service.getOrSet('test-key', factory)

      expect(result).toEqual(testData)
      expect(factory).toHaveBeenCalled()
      expect(mockCacheApi.put).toHaveBeenCalled()
    })
  })

  describe('cacheResponse', () => {
    it('should cache response with proper headers', async () => {
      const request = new Request('https://example.com/api')
      const response = new Response('test data')

      await service.cacheResponse(request, response, {
        ttl: 600,
        tags: ['api'],
        browserTTL: 60,
        edgeTTL: 600
      })

      expect(mockCacheApi.put).toHaveBeenCalledWith(request, expect.any(Response))

      const putCall = mockCacheApi.put.mock.calls[0]
      const cachedResponse = putCall[1] as Response

      expect(cachedResponse.headers.get('Cache-Control')).toBe('public, max-age=60, s-maxage=600')
      expect(cachedResponse.headers.get('X-Cache-Tags')).toBe('api')
    })
  })

  describe('getCachedResponse', () => {
    it('should return cached response when available', async () => {
      const request = new Request('https://example.com/api')
      const mockResponse = new Response('cached data')
      mockResponse.headers.set('expires', new Date(Date.now() + 10000).toISOString())
      mockCacheApi.match.mockResolvedValue(mockResponse)

      const result = await service.getCachedResponse(request)

      expect(result).toBe(mockResponse)
      expect(mockLogger.debug).toHaveBeenCalledWith('Response cache hit', { url: request.url })
    })

    it('should return null and delete expired responses', async () => {
      const request = new Request('https://example.com/api')
      const mockResponse = new Response('expired data')
      mockResponse.headers.set('expires', new Date(Date.now() - 10000).toISOString())
      mockCacheApi.match.mockResolvedValue(mockResponse)
      mockCacheApi.delete.mockResolvedValue(true)

      const result = await service.getCachedResponse(request)

      expect(result).toBeNull()
      expect(mockCacheApi.delete).toHaveBeenCalledWith(request)
    })
  })

  describe('warmUp', () => {
    it('should warm up cache with multiple entries', async () => {
      mockCacheApi.match.mockResolvedValue(undefined)

      const keys = [
        { key: 'key1', factory: vi.fn().mockResolvedValue({ data: 1 }) },
        { key: 'key2', factory: vi.fn().mockResolvedValue({ data: 2 }) }
      ]

      await service.warmUp(keys)

      expect(keys[0].factory).toHaveBeenCalled()
      expect(keys[1].factory).toHaveBeenCalled()
      expect(mockCacheApi.put).toHaveBeenCalledTimes(2)
      expect(mockLogger.info).toHaveBeenCalledWith('Warming up edge cache', { count: 2 })
      expect(mockLogger.info).toHaveBeenCalledWith('Edge cache warmup completed', {
        total: 2,
        successful: 2
      })
    })

    it('should handle warmup errors gracefully', async () => {
      mockCacheApi.match.mockResolvedValue(undefined)
      const keys = [{ key: 'key1', factory: vi.fn().mockRejectedValue(new Error('Factory error')) }]

      await service.warmUp(keys)

      expect(mockLogger.error).toHaveBeenCalledWith('Cache warmup failed', {
        error: expect.any(Error),
        key: 'key1'
      })
    })
  })

  describe('purgeByTags', () => {
    it('should log warning about API requirement', async () => {
      await service.purgeByTags(['tag1', 'tag2'])

      expect(mockLogger.info).toHaveBeenCalledWith('Purging cache by tags', {
        tags: ['tag1', 'tag2']
      })
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Tag-based cache purging requires Cloudflare API configuration')
      )
    })
  })
})

describe('generateCacheKey', () => {
  it('should generate consistent cache keys', async () => {
    const { generateCacheKey } = await import('../edge-cache-service')

    const key1 = generateCacheKey('api', { userId: 123, type: 'user', active: true })
    const key2 = generateCacheKey('api', { active: true, type: 'user', userId: 123 })

    expect(key1).toBe(key2)
    expect(key1).toBe('api:active:true:type:user:userId:123')
  })
})
