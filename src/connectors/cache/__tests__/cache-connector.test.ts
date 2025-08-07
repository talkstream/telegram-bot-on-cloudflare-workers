import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EventBus } from '../../../core/events/event-bus'
import { EdgeCacheService } from '../../../core/services/cache/edge-cache-service'
import { KVCache } from '../../../lib/cache/kv-cache'
import { RequestCache } from '../../../lib/cache/request-cache'
import { PerformanceMonitor } from '../../../middleware/performance-monitor'
import { CacheConnector, CacheConnectorFactory } from '../cache-connector'

// Mock the dependencies
vi.mock('../../../lib/cache/request-cache')
vi.mock('../../../core/services/cache/edge-cache-service')
vi.mock('../../../lib/cache/kv-cache')

describe('CacheConnector', () => {
  let connector: CacheConnector
  let mockEventBus: EventBus
  let mockMonitor: PerformanceMonitor
  let mockKVNamespace: KVNamespace
  let mockRequestCache: {
    get: ReturnType<typeof vi.fn>
    set: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
  }
  let mockEdgeCache: {
    getJSON: ReturnType<typeof vi.fn>
    set: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
  }
  let mockKVCache: {
    get: ReturnType<typeof vi.fn>
    set: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    clear: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockEventBus = new EventBus()
    mockMonitor = new PerformanceMonitor()

    // Mock KVNamespace
    mockKVNamespace = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      getWithMetadata: vi.fn()
    } as unknown as KVNamespace

    // Setup mock instances
    mockRequestCache = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn()
    }

    mockEdgeCache = {
      getJSON: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn()
    }

    mockKVCache = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn()
    }

    // Mock the constructors to return our mock instances
    vi.mocked(RequestCache).mockImplementation(() => mockRequestCache)
    vi.mocked(EdgeCacheService).mockImplementation(() => mockEdgeCache)
    vi.mocked(KVCache).mockImplementation(() => mockKVCache)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with all layers enabled', async () => {
      const emitSpy = vi.spyOn(mockEventBus, 'emit')

      connector = new CacheConnector({
        id: 'test-cache',
        name: 'Test Cache',
        eventBus: mockEventBus,
        kvNamespace: mockKVNamespace
      })

      await connector.initialize()

      expect(emitSpy).toHaveBeenCalledWith(
        'cache:initialized',
        {
          connector: 'cache', // Using the id property from the class
          layers: ['request', 'edge', 'kv']
        },
        'CacheConnector'
      )
    })

    it('should initialize with selective layers', async () => {
      connector = new CacheConnector({
        id: 'test-cache',
        name: 'Test Cache',
        eventBus: mockEventBus,
        layers: {
          request: true,
          edge: false,
          kv: false
        }
      })

      await connector.initialize()

      expect(connector.getEdgeCache()).toBeUndefined()
      expect(connector.getKVCache()).toBeUndefined()
      expect(connector.getRequestCache()).toBeDefined()
    })
  })

  describe('get operations', () => {
    beforeEach(async () => {
      connector = new CacheConnector({
        id: 'test-cache',
        name: 'Test Cache',
        eventBus: mockEventBus,
        kvNamespace: mockKVNamespace,
        performanceMonitor: mockMonitor
      })
      await connector.initialize()
    })

    it('should return value from L1 cache when available', async () => {
      const testData = { foo: 'bar' }
      mockRequestCache.get.mockReturnValue(testData)

      const result = await connector.get('test-key')

      expect(result).toEqual(testData)
      expect(mockRequestCache.get).toHaveBeenCalledWith('test-key')
      expect(mockEdgeCache.getJSON).not.toHaveBeenCalled()
      expect(mockKVCache.get).not.toHaveBeenCalled()
    })

    it('should fallback to L2 cache when L1 misses', async () => {
      const testData = { foo: 'bar' }
      mockRequestCache.get.mockReturnValue(undefined)
      mockEdgeCache.getJSON.mockResolvedValue(testData)

      const result = await connector.get('test-key')

      expect(result).toEqual(testData)
      expect(mockEdgeCache.getJSON).toHaveBeenCalledWith('test-key')
      expect(mockRequestCache.set).toHaveBeenCalledWith('test-key', testData)
    })

    it('should fallback to L3 cache when L1 and L2 miss', async () => {
      const testData = { foo: 'bar' }
      mockRequestCache.get.mockReturnValue(undefined)
      mockEdgeCache.getJSON.mockResolvedValue(null)
      mockKVCache.get.mockResolvedValue(testData)

      const result = await connector.get('test-key')

      expect(result).toEqual(testData)
      expect(mockKVCache.get).toHaveBeenCalledWith('test-key')
      expect(mockEdgeCache.set).toHaveBeenCalledWith(
        'test-key',
        testData,
        expect.objectContaining({ ttl: 300 })
      )
      expect(mockRequestCache.set).toHaveBeenCalledWith('test-key', testData)
    })

    it('should return null when all layers miss', async () => {
      mockRequestCache.get.mockReturnValue(undefined)
      mockEdgeCache.getJSON.mockResolvedValue(null)
      mockKVCache.get.mockResolvedValue(null)

      const emitSpy = vi.spyOn(mockEventBus, 'emit')
      const result = await connector.get('test-key')

      expect(result).toBeNull()
      expect(emitSpy).toHaveBeenCalledWith(
        'cache:miss',
        {
          key: 'test-key',
          layers: ['request', 'edge', 'kv']
        },
        'CacheConnector'
      )
    })
  })

  describe('set operations', () => {
    beforeEach(async () => {
      connector = new CacheConnector({
        id: 'test-cache',
        name: 'Test Cache',
        eventBus: mockEventBus,
        kvNamespace: mockKVNamespace
      })
      await connector.initialize()
    })

    it('should set value in all layers', async () => {
      const testData = { foo: 'bar' }
      const options = { ttl: 600, tags: ['test'] }

      await connector.set('test-key', testData, options)

      expect(mockRequestCache.set).toHaveBeenCalledWith('test-key', testData, 600)
      expect(mockEdgeCache.set).toHaveBeenCalledWith(
        'test-key',
        testData,
        expect.objectContaining({ ttl: 600, tags: ['test'] })
      )
      expect(mockKVCache.set).toHaveBeenCalledWith('test-key', testData, { ttl: 600 })
    })
  })

  describe('getOrSet operations', () => {
    beforeEach(async () => {
      connector = new CacheConnector({
        id: 'test-cache',
        name: 'Test Cache',
        eventBus: mockEventBus,
        kvNamespace: mockKVNamespace
      })
      await connector.initialize()
    })

    it('should return cached value without calling factory', async () => {
      const testData = { foo: 'bar' }
      mockRequestCache.get.mockReturnValue(testData)

      const factory = vi.fn()
      const result = await connector.getOrSet('test-key', factory)

      expect(result).toEqual(testData)
      expect(factory).not.toHaveBeenCalled()
    })

    it('should call factory and cache result on miss', async () => {
      const testData = { foo: 'bar' }
      mockRequestCache.get.mockReturnValue(undefined)
      mockEdgeCache.getJSON.mockResolvedValue(null)
      mockKVCache.get.mockResolvedValue(null)

      const factory = vi.fn().mockResolvedValue(testData)
      const result = await connector.getOrSet('test-key', factory, { ttl: 300 })

      expect(result).toEqual(testData)
      expect(factory).toHaveBeenCalled()
      expect(mockRequestCache.set).toHaveBeenCalled()
      expect(mockEdgeCache.set).toHaveBeenCalled()
      expect(mockKVCache.set).toHaveBeenCalled()
    })
  })

  describe('delete operations', () => {
    beforeEach(async () => {
      connector = new CacheConnector({
        id: 'test-cache',
        name: 'Test Cache',
        eventBus: mockEventBus,
        kvNamespace: mockKVNamespace
      })
      await connector.initialize()
    })

    it('should delete from all layers', async () => {
      await connector.delete('test-key')

      expect(mockRequestCache.delete).toHaveBeenCalledWith('test-key')
      expect(mockEdgeCache.delete).toHaveBeenCalledWith('test-key')
      expect(mockKVCache.delete).toHaveBeenCalledWith('test-key')
    })
  })

  describe('clear operations', () => {
    beforeEach(async () => {
      connector = new CacheConnector({
        id: 'test-cache',
        name: 'Test Cache',
        eventBus: mockEventBus,
        kvNamespace: mockKVNamespace
      })
      await connector.initialize()
    })

    it('should clear specific layer', async () => {
      await connector.clear('request')

      expect(mockRequestCache.clear).toHaveBeenCalled()
    })

    it('should clear all layers when no layer specified', async () => {
      await connector.clear()

      expect(mockRequestCache.clear).toHaveBeenCalled()
      expect(mockEdgeCache.clear).toHaveBeenCalled()
      // KVCache doesn't have a clear method
    })
  })

  describe('warmup operations', () => {
    beforeEach(async () => {
      connector = new CacheConnector({
        id: 'test-cache',
        name: 'Test Cache',
        eventBus: mockEventBus,
        kvNamespace: mockKVNamespace
      })
      await connector.initialize()
    })

    it('should warm up cache with provided entries', async () => {
      const entries = [
        { key: 'key1', factory: vi.fn().mockResolvedValue({ data: 1 }) },
        { key: 'key2', factory: vi.fn().mockResolvedValue({ data: 2 }) }
      ]

      const emitSpy = vi.spyOn(mockEventBus, 'emit')
      await connector.warmUp(entries)

      expect(entries[0].factory).toHaveBeenCalled()
      expect(entries[1].factory).toHaveBeenCalled()
      expect(emitSpy).toHaveBeenCalledWith('cache:warmup', { count: 2 }, 'CacheConnector')
    })
  })

  describe('statistics', () => {
    beforeEach(async () => {
      connector = new CacheConnector({
        id: 'test-cache',
        name: 'Test Cache',
        eventBus: mockEventBus,
        kvNamespace: mockKVNamespace
      })
      await connector.initialize()
    })

    it('should track cache hits and misses', async () => {
      // Simulate hits
      mockRequestCache.get.mockReturnValue({ data: 'test' })
      await connector.get('key1')

      mockRequestCache.get.mockReturnValue(undefined)
      mockEdgeCache.getJSON.mockResolvedValue({ data: 'test' })
      await connector.get('key2')

      // Simulate miss
      mockEdgeCache.getJSON.mockResolvedValue(null)
      mockKVCache.get.mockResolvedValue(null)
      await connector.get('key3')

      const stats = connector.getStats()

      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBeCloseTo(0.667, 2)
      expect(stats.layerStats.request.hits).toBe(1)
      expect(stats.layerStats.edge.hits).toBe(1)
    })
  })
})

describe('CacheConnectorFactory', () => {
  it('should create connector with config', () => {
    const connector = CacheConnectorFactory.create({
      id: 'test',
      name: 'Test',
      defaultTTL: 600
    })

    expect(connector).toBeInstanceOf(CacheConnector)
  })

  it('should create connector with defaults', () => {
    const mockKV = {} as KVNamespace
    const connector = CacheConnectorFactory.createWithDefaults(mockKV, {
      defaultTTL: 900
    })

    expect(connector).toBeInstanceOf(CacheConnector)
  })
})
