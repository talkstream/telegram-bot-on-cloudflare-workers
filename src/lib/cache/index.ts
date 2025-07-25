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
  type CacheOptions,
  type CacheMetadata,
  type CacheStats,
  // TTL utilities
  getTTLUntilEndOfDay,
  getExponentialTTL,
  getShortTTL,
  getMediumTTL,
  getLongTTL,
} from './kv-cache';

export { CachedService, CachedRepository, Cached, createCachedProxy } from './cached-service';

// Re-export examples for documentation
export type { CachedUserService } from './examples/cached-user-service';
