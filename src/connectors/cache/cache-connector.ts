/**
 * Unified Cache Connector
 *
 * Provides a single interface for multi-layer caching with automatic fallback
 * and population of higher cache layers.
 *
 * Cache Layers:
 * - L1: Request-scoped (instant, same request)
 * - L2: Edge cache (sub-10ms, regional)
 * - L3: KV storage (50-100ms, global persistent)
 */

import type { EventBus } from '../../core/events/event-bus'
import type { CacheOptions } from '../../core/interfaces/cache'
import type { ILogger } from '../../core/interfaces/logger'
import type { IKeyValueStore } from '../../core/interfaces/storage'
import { EdgeCacheService } from '../../core/services/cache/edge-cache-service'
import { KVCache } from '../../lib/cache/kv-cache'
import { RequestCache } from '../../lib/cache/request-cache'
import { PerformanceMonitor } from '../../middleware/performance-monitor'

export interface CacheLayer {
  name: string
  ttl: number
  enabled: boolean
}

export interface CacheConnectorConfig {
  id: string
  name: string
  logger?: ILogger
  eventBus?: EventBus
  debug?: boolean
  layers?: {
    request?: boolean
    edge?: boolean
    kv?: boolean
  }
  defaultTTL?: number
  performanceMonitor?: PerformanceMonitor
  kvNamespace?: KVNamespace
  edgeBaseUrl?: string
}

export interface CacheStats {
  hits: number
  misses: number
  hitRate: number
  layerStats: {
    request: { hits: number; misses: number }
    edge: { hits: number; misses: number }
    kv: { hits: number; misses: number }
  }
}

export class CacheConnector {
  public readonly id = 'cache'
  public readonly type = 'cache'

  private requestCache?: RequestCache
  private edgeCache?: EdgeCacheService
  private kvCache?: KVCache
  private logger?: ILogger
  private eventBus?: EventBus
  private monitor?: PerformanceMonitor

  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    layerStats: {
      request: { hits: 0, misses: 0 },
      edge: { hits: 0, misses: 0 },
      kv: { hits: 0, misses: 0 }
    }
  }

  constructor(private config: CacheConnectorConfig) {
    this.logger = config.logger
    this.eventBus = config.eventBus
    this.monitor = config.performanceMonitor

    // Initialize cache layers based on config
    const layers = config.layers || { request: true, edge: true, kv: true }

    if (layers.request !== false) {
      this.requestCache = new RequestCache({
        namespace: 'unified',
        debug: config.debug
      })
    }

    if (layers.edge !== false) {
      this.edgeCache = new EdgeCacheService({
        baseUrl: config.edgeBaseUrl || 'https://cache.internal',
        logger: this.logger
      })
    }

    if (layers.kv !== false && config.kvNamespace) {
      // Convert KVNamespace to IKeyValueStore
      const kvNamespace = config.kvNamespace
      const kvStore: IKeyValueStore = {
        get: async <T = string>(key: string): Promise<T | null> => {
          const value = await kvNamespace.get(key)
          if (!value) return null
          try {
            return JSON.parse(value) as T
          } catch {
            return value as T
          }
        },
        put: async (key: string, value: string): Promise<void> => {
          await kvNamespace.put(key, value)
        },
        delete: async (key: string): Promise<void> => {
          await kvNamespace.delete(key)
        },
        getWithMetadata: async <T = string>(key: string) => {
          const metadata = await kvNamespace.getWithMetadata(key)
          if (!metadata.value) {
            return { value: null, metadata: null }
          }
          try {
            return {
              value: JSON.parse(metadata.value) as T,
              metadata: (metadata.metadata || null) as Record<string, unknown> | null
            }
          } catch {
            return {
              value: metadata.value as T,
              metadata: (metadata.metadata || null) as Record<string, unknown> | null
            }
          }
        },
        list: async (options?: { prefix?: string; limit?: number; cursor?: string }) => {
          const result = await kvNamespace.list(options)
          return {
            keys: result.keys.map(k => ({
              name: k.name,
              metadata: (k.metadata || undefined) as Record<string, unknown> | undefined
            })),
            list_complete: result.list_complete,
            cursor: 'cursor' in result ? result.cursor : undefined
          }
        }
      }
      this.kvCache = new KVCache(kvStore, {
        ttl: config.defaultTTL || 300
      })
    }
  }

  async initialize(): Promise<void> {
    this.logger?.info('CacheConnector initialized', {
      layers: {
        request: !!this.requestCache,
        edge: !!this.edgeCache,
        kv: !!this.kvCache
      }
    })

    this.eventBus?.emit(
      'cache:initialized',
      {
        connector: this.id,
        layers: this.getEnabledLayers()
      },
      'CacheConnector'
    )
  }

  async dispose(): Promise<void> {
    this.requestCache?.clear()
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      layerStats: {
        request: { hits: 0, misses: 0 },
        edge: { hits: 0, misses: 0 },
        kv: { hits: 0, misses: 0 }
      }
    }

    this.eventBus?.emit(
      'cache:disposed',
      {
        connector: this.id
      },
      'CacheConnector'
    )
  }

  /**
   * Get value from cache with automatic layer fallback
   */
  async get<T>(key: string): Promise<T | null> {
    const operation = this.monitor
      ? () => this._getWithFallback<T>(key)
      : () => this._getWithFallback<T>(key)

    return this.monitor
      ? await this.monitor.trackOperation('cache.get', operation, { key })
      : await operation()
  }

  private async _getWithFallback<T>(key: string): Promise<T | null> {
    // L1: Check request cache
    if (this.requestCache) {
      const requestValue = this.requestCache.get<T>(key)
      if (requestValue !== undefined) {
        this.recordHit('request')
        this.logger?.debug('Cache hit L1 (request)', { key })
        return requestValue
      }
      this.recordMiss('request')
    }

    // L2: Check edge cache
    if (this.edgeCache) {
      const edgeValue = await this.edgeCache.getJSON<T>(key)
      if (edgeValue !== null) {
        this.recordHit('edge')
        this.logger?.debug('Cache hit L2 (edge)', { key })

        // Populate L1
        this.requestCache?.set(key, edgeValue)

        return edgeValue
      }
      this.recordMiss('edge')
    }

    // L3: Check KV storage
    if (this.kvCache) {
      const kvValue = await this.kvCache.get<T>(key)
      if (kvValue !== null) {
        this.recordHit('kv')
        this.logger?.debug('Cache hit L3 (kv)', { key })

        // Populate higher layers
        if (this.edgeCache) {
          await this.edgeCache.set(key, kvValue, {
            ttl: this.config.defaultTTL || 300
          })
        }
        this.requestCache?.set(key, kvValue)

        return kvValue
      }
      this.recordMiss('kv')
    }

    // Complete miss
    this.stats.misses++
    this.updateHitRate()
    this.logger?.debug('Cache miss all layers', { key })

    this.eventBus?.emit('cache:miss', { key, layers: this.getEnabledLayers() }, 'CacheConnector')

    return null
  }

  /**
   * Set value in all cache layers
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const operation = async () => {
      const promises: Promise<void>[] = []

      // Set in all layers
      if (this.requestCache) {
        this.requestCache.set(key, value, options?.ttl)
      }

      if (this.edgeCache) {
        promises.push(
          this.edgeCache.set(key, value, {
            ttl: options?.ttl || this.config.defaultTTL || 300,
            tags: options?.tags,
            browserTTL: options?.browserTTL,
            edgeTTL: options?.edgeTTL
          })
        )
      }

      if (this.kvCache) {
        promises.push(
          this.kvCache.set(key, value, { ttl: options?.ttl || this.config.defaultTTL || 300 })
        )
      }

      await Promise.all(promises)

      this.logger?.debug('Cache set all layers', { key, ttl: options?.ttl })
      this.eventBus?.emit('cache:set', { key, layers: this.getEnabledLayers() }, 'CacheConnector')
    }

    return this.monitor
      ? await this.monitor.trackOperation('cache.set', operation, { key })
      : await operation()
  }

  /**
   * Get or compute value with caching
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const operation = async () => {
      const value = await factory()
      await this.set(key, value, options)
      return value
    }

    return this.monitor
      ? await this.monitor.trackOperation('cache.factory', operation, { key })
      : await operation()
  }

  /**
   * Delete from all cache layers
   */
  async delete(key: string): Promise<void> {
    const promises: Promise<unknown>[] = []

    if (this.requestCache) {
      this.requestCache.delete(key)
    }

    if (this.edgeCache) {
      promises.push(this.edgeCache.delete(key))
    }

    if (this.kvCache) {
      promises.push(this.kvCache.delete(key))
    }

    await Promise.all(promises)

    this.logger?.debug('Cache delete all layers', { key })
    this.eventBus?.emit('cache:delete', { key }, 'CacheConnector')
  }

  /**
   * Clear specific layer or all layers
   */
  async clear(layer?: 'request' | 'edge' | 'kv'): Promise<void> {
    if (layer) {
      switch (layer) {
        case 'request':
          this.requestCache?.clear()
          break
        case 'edge':
          await this.edgeCache?.clear()
          break
        case 'kv':
          // KVCache doesn't have a clear method - would need to implement manual clearing
          console.warn('KV cache clearing not implemented')
          break
      }
      this.logger?.info(`Cache layer ${layer} cleared`)
    } else {
      // Clear all layers
      this.requestCache?.clear()
      await this.edgeCache?.clear()
      // KVCache doesn't have a clear method
      this.logger?.info('All cache layers cleared')
    }

    this.eventBus?.emit('cache:clear', { layer }, 'CacheConnector')
  }

  /**
   * Warm up cache with predefined data
   */
  async warmUp(
    entries: Array<{
      key: string
      factory: () => Promise<unknown>
      options?: CacheOptions
    }>
  ): Promise<void> {
    const operation = async () => {
      const promises = entries.map(async ({ key, factory, options }) => {
        try {
          const value = await factory()
          await this.set(key, value, options)
          this.logger?.debug('Cache warmed', { key })
        } catch (error) {
          this.logger?.error('Cache warmup failed', { key, error })
        }
      })

      await Promise.all(promises)
    }

    await (this.monitor
      ? this.monitor.trackOperation('cache.warmup', operation, { count: entries.length })
      : operation())

    this.logger?.info('Cache warmup completed', { count: entries.length })
    this.eventBus?.emit('cache:warmup', { count: entries.length }, 'CacheConnector')
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Get request cache for current request
   */
  getRequestCache(): RequestCache | undefined {
    return this.requestCache
  }

  /**
   * Get edge cache service
   */
  getEdgeCache(): EdgeCacheService | undefined {
    return this.edgeCache
  }

  /**
   * Get KV cache
   */
  getKVCache(): KVCache | undefined {
    return this.kvCache
  }

  private recordHit(layer: 'request' | 'edge' | 'kv'): void {
    this.stats.hits++
    this.stats.layerStats[layer].hits++
    this.updateHitRate()
  }

  private recordMiss(layer: 'request' | 'edge' | 'kv'): void {
    this.stats.layerStats[layer].misses++
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0
  }

  private getEnabledLayers(): string[] {
    const layers: string[] = []
    if (this.requestCache) layers.push('request')
    if (this.edgeCache) layers.push('edge')
    if (this.kvCache) layers.push('kv')
    return layers
  }
}

/**
 * Factory for creating cache connectors
 */
export class CacheConnectorFactory {
  static create(config: CacheConnectorConfig): CacheConnector {
    return new CacheConnector(config)
  }

  static createWithDefaults(
    kvNamespace?: KVNamespace,
    options?: Partial<CacheConnectorConfig>
  ): CacheConnector {
    return new CacheConnector({
      id: options?.id || 'cache',
      name: options?.name || 'Cache',
      layers: {
        request: true,
        edge: true,
        kv: !!kvNamespace
      },
      defaultTTL: 300,
      kvNamespace,
      ...options
    })
  }
}
