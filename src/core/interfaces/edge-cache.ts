/**
 * Edge cache interfaces
 */

/**
 * Cache options
 */
export interface ICacheOptions {
  /**
   * Time to live in seconds
   */
  ttl?: number;

  /**
   * Stale while revalidate time in seconds
   */
  swr?: number;

  /**
   * Cache tags for invalidation
   */
  tags?: string[];
}

/**
 * Edge cache service interface
 */
export interface IEdgeCacheService {
  /**
   * Get value from cache
   */
  get<T = unknown>(key: string): Promise<T | null>;

  /**
   * Set value in cache
   */
  set<T = unknown>(key: string, value: T, options?: ICacheOptions): Promise<void>;

  /**
   * Delete value from cache
   */
  delete(key: string): Promise<void>;

  /**
   * Check if key exists
   */
  has(key: string): Promise<boolean>;

  /**
   * Clear all cache or by tags
   */
  clear(tags?: string[]): Promise<void>;
}
