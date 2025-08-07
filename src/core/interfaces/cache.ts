/**
 * Cache interfaces for multi-layer caching strategy
 */

export interface CacheOptions {
  /** Time-to-live in seconds */
  ttl?: number
  /** Browser cache TTL */
  browserTTL?: number
  /** Edge cache TTL */
  edgeTTL?: number
  /** Cache tags for invalidation */
  tags?: string[]
  /** Cache key prefix */
  prefix?: string
  /** Whether to bypass cache */
  bypass?: boolean
}

export interface RouteCacheConfig {
  ttl: number
  tags: string[]
  browserTTL?: number
  edgeTTL?: number
}

export interface IEdgeCacheService {
  /**
   * Get value from edge cache
   */
  get(key: string): Promise<Response | null>

  /**
   * Put value into edge cache
   */
  put(key: string, response: Response, options?: CacheOptions): Promise<void>

  /**
   * Delete from edge cache
   */
  delete(key: string): Promise<boolean | void>

  /**
   * Purge by tags
   */
  purgeByTags(tags: string[]): Promise<void>

  /**
   * Match request against cache
   */
  match(request: Request): Promise<Response | undefined>

  /**
   * Get cached response
   */
  getCachedResponse?(request: Request): Promise<Response | null>

  /**
   * Cache response
   */
  cacheResponse?(request: Request, response: Response, config: RouteCacheConfig): Promise<void>

  /**
   * Warm up cache
   */
  warmUp?(
    keys:
      | Array<{
          key: string
          factory: () => Promise<unknown>
          options?: CacheOptions
        }>
      | string[]
  ): Promise<void>
}

export interface ICacheLayer {
  /**
   * Get value from cache
   */
  get<T>(key: string): Promise<T | null>

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>

  /**
   * Delete from cache
   */
  delete(key: string): Promise<boolean>

  /**
   * Check if key exists
   */
  has(key: string): Promise<boolean>

  /**
   * Clear all cache
   */
  clear(): Promise<void>
}

export interface IMultiLayerCache {
  /**
   * Memory cache layer
   */
  memory: ICacheLayer

  /**
   * KV cache layer
   */
  kv: ICacheLayer

  /**
   * Edge cache layer
   */
  edge?: IEdgeCacheService

  /**
   * Get with fallback through layers
   */
  get<T>(key: string, fetcher?: () => Promise<T>): Promise<T | null>

  /**
   * Set in all layers
   */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>
}
