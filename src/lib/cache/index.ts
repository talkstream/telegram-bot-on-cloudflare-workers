/**
 * KV Cache Layer
 *
 * Universal caching solution for Wireframe
 * Based on production patterns from Kogotochki bot
 *
 * @module lib/cache
 */

export {
  KVCache,
  getExponentialTTL,
  getLongTTL,
  getMediumTTL,
  getShortTTL,
  // TTL utilities
  getTTLUntilEndOfDay,
  type CacheMetadata,
  type CacheOptions,
  type CacheStats
} from './kv-cache'

export { Cached, CachedRepository, CachedService, createCachedProxy } from './cached-service'

export {
  Cached as CachedRequest,
  RequestCache,
  RequestCacheFactory,
  type CacheEntry,
  type RequestCacheOptions
} from './request-cache'

// Re-export examples for documentation
export type { CachedUserService } from './examples/cached-user-service'
