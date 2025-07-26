/**
 * Simple edge cache service implementation
 */

import type { IEdgeCacheService, ICacheOptions } from '../../interfaces/edge-cache';

interface CacheEntry<T> {
  value: T;
  expires: number;
  tags?: string[];
}

/**
 * In-memory edge cache service
 */
export class EdgeCacheService implements IEdgeCacheService {
  private cache = new Map<string, CacheEntry<unknown>>();

  constructor(_options?: { provider?: 'memory' | 'cloudflare' }) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T = unknown>(key: string, value: T, options?: ICacheOptions): Promise<void> {
    const ttl = options?.ttl || 300; // 5 minutes default
    const expires = Date.now() + ttl * 1000;

    this.cache.set(key, {
      value,
      expires,
      tags: options?.tags,
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async clear(tags?: string[]): Promise<void> {
    if (!tags) {
      this.cache.clear();
      return;
    }

    // Clear by tags
    for (const [key, entry] of this.cache) {
      if (entry.tags?.some((tag) => tags.includes(tag))) {
        this.cache.delete(key);
      }
    }
  }
}
