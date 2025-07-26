/**
 * Cache service interfaces for the Wireframe Platform
 * Provides abstraction for various caching strategies
 */

/**
 * Cache options for storing values
 */
export interface CacheOptions {
  /** Time to live in seconds */
  ttl?: number;
  /** Cache tags for bulk invalidation */
  tags?: string[];
  /** Browser cache TTL (for edge caching) */
  browserTTL?: number;
  /** Edge cache TTL (for CDN caching) */
  edgeTTL?: number;
}

/**
 * Cache service interface
 * Provides basic caching operations
 */
export interface ICacheService {
  /**
   * Get a value from cache
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache
   */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;

  /**
   * Delete a value from cache
   */
  delete(key: string): Promise<void>;

  /**
   * Get or set with cache-aside pattern
   */
  getOrSet<T>(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T>;

  /**
   * Check if key exists in cache
   */
  has(key: string): Promise<boolean>;

  /**
   * Clear all cache entries
   */
  clear(): Promise<void>;
}

/**
 * Edge cache service interface
 * Extends basic cache with edge-specific features
 */
export interface IEdgeCacheService extends ICacheService {
  /**
   * Cache HTTP response
   */
  cacheResponse(request: Request, response: Response, options?: CacheOptions): Promise<void>;

  /**
   * Get cached HTTP response
   */
  getCachedResponse(request: Request): Promise<Response | null>;

  /**
   * Purge cache by tags
   */
  purgeByTags(tags: string[]): Promise<void>;

  /**
   * Warm up cache with predefined keys
   */
  warmUp(
    keys: Array<{
      key: string;
      factory: () => Promise<unknown>;
      options?: CacheOptions;
    }>,
  ): Promise<void>;
}

/**
 * Cache key generator function type
 */
export type CacheKeyGenerator = (
  prefix: string,
  params: Record<string, string | number | boolean>,
) => string;

/**
 * Cache configuration for routes
 */
export interface RouteCacheConfig {
  /** TTL in seconds (0 = no cache) */
  ttl: number;
  /** Cache tags */
  tags: string[];
  /** Path pattern (exact or prefix match) */
  pattern?: string;
}

/**
 * Platform-specific cache features
 */
export interface CacheFeatures {
  /** Supports edge caching (CDN) */
  hasEdgeCache: boolean;
  /** Supports tag-based invalidation */
  hasTagInvalidation: boolean;
  /** Supports cache warmup */
  hasWarmup: boolean;
  /** Maximum cache size in MB */
  maxCacheSize?: number;
  /** Maximum TTL in seconds */
  maxTTL?: number;
}
