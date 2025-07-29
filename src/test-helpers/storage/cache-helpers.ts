import { vi } from 'vitest';

import type { IKeyValueStore } from '../../core/interfaces/index.js';

// Define minimal interfaces for cache service
export interface CacheOptions {
  ttl?: number;
  tags?: string[];
}

export interface IEdgeCacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  list?(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string; metadata?: Record<string, unknown> }>;
    list_complete: boolean;
    cursor?: string;
  }>;
  getMultiple?<T>(keys: string[]): Promise<Map<string, T>>;
  setMultiple?<T>(entries: Map<string, T>, options?: CacheOptions): Promise<void>;
  deleteMultiple?(keys: string[]): Promise<void>;
  purgeByTag?(tag: string): Promise<void>;
  purgeByPattern?(pattern: string | RegExp): Promise<void>;
}

/**
 * Mock cache service for testing
 */
export class MockCacheService implements IEdgeCacheService {
  private cache = new Map<string, { value: unknown; expiry?: number; tags?: string[] }>();
  private hits = 0;
  private misses = 0;

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    if (entry.expiry && entry.expiry < Date.now()) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const expiry = options?.ttl ? Date.now() + options.ttl * 1000 : undefined;
    this.cache.set(key, { value, expiry, tags: options?.tags });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (entry.expiry && entry.expiry < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  async cacheResponse(request: Request, response: Response, options?: CacheOptions): Promise<void> {
    const key = `response:${request.url}`;
    await this.set(key, response.clone(), options);
  }

  async getCachedResponse(request: Request): Promise<Response | null> {
    const key = `response:${request.url}`;
    return await this.get<Response>(key);
  }

  async purgeByTags(tags: string[]): Promise<void> {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (entry.tags && tags.some((tag) => entry.tags.includes(tag))) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  async warmUp(
    keys: Array<{
      key: string;
      factory: () => Promise<unknown>;
      options?: CacheOptions;
    }>,
  ): Promise<void> {
    await Promise.all(
      keys.map(({ key, factory, options }) => this.getOrSet(key, factory, options)),
    );
  }

  // Test helpers
  getStats() {
    // eslint-disable-next-line db-mapping/use-field-mapper -- This is not database mapping, it's cache statistics
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits / (this.hits + this.misses) || 0,
      size: this.cache.size,
    };
  }

  resetStats() {
    this.hits = 0;
    this.misses = 0;
  }

  dump() {
    const entries: Record<string, unknown> = {};
    for (const [key, entry] of this.cache) {
      entries[key] = entry;
    }
    return entries;
  }
}

/**
 * Create a mock KV store with cache-like behavior
 */
export function createMockCacheStore(): IKeyValueStore {
  const store = new Map<string, string>();

  return {
    get: vi.fn(async <T = string>(key: string): Promise<T | null> => {
      const value = store.get(key);
      if (!value) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    }),

    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),

    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),

    list: vi.fn(async (options?: { prefix?: string; limit?: number; cursor?: string }) => {
      const prefix = typeof options === 'string' ? options : options?.prefix;
      const limit = typeof options === 'object' ? options.limit : undefined;

      const matchingKeys = Array.from(store.keys())
        .filter((key) => !prefix || key.startsWith(prefix))
        .slice(0, limit);

      return {
        keys: matchingKeys.map((name) => ({ name, metadata: undefined })),
        list_complete: true,
        cursor: undefined,
      };
    }),

    getWithMetadata: vi.fn(
      async <T = string>(
        key: string,
      ): Promise<{ value: T | null; metadata: Record<string, unknown> | null }> => {
        const value = store.get(key);
        if (!value) return { value: null, metadata: null };
        try {
          return { value: JSON.parse(value) as T, metadata: null };
        } catch {
          return { value: value as unknown as T, metadata: null };
        }
      },
    ),
  } as IKeyValueStore;
}

/**
 * Cache testing utilities
 */
export class CacheTestUtils {
  /**
   * Simulate cache expiration by advancing time
   */
  static async simulateExpiration(cache: MockCacheService, seconds: number): Promise<void> {
    const advanceTime = seconds * 1000;
    vi.advanceTimersByTime(advanceTime);

    // Force cache to check expirations
    const keys = Array.from((cache as unknown as { cache: Map<string, unknown> }).cache.keys());
    for (const key of keys) {
      await cache.has(key as string);
    }
  }

  /**
   * Create a cache monitor for tracking operations
   */
  static createCacheMonitor() {
    const operations: Array<{
      type: 'get' | 'set' | 'delete' | 'clear';
      key?: string;
      value?: unknown;
      timestamp: number;
    }> = [];

    return {
      recordGet(key: string, hit: boolean): void {
        operations.push({
          type: 'get',
          key,
          value: hit,
          timestamp: Date.now(),
        });
      },

      recordSet(key: string, value: unknown): void {
        operations.push({
          type: 'set',
          key,
          value,
          timestamp: Date.now(),
        });
      },

      recordDelete(key: string): void {
        operations.push({
          type: 'delete',
          key,
          timestamp: Date.now(),
        });
      },

      recordClear(): void {
        operations.push({
          type: 'clear',
          timestamp: Date.now(),
        });
      },

      getOperations() {
        return operations;
      },

      clear() {
        operations.length = 0;
      },

      getStats() {
        const stats = {
          totalOps: operations.length,
          gets: operations.filter((op) => op.type === 'get').length,
          hits: operations.filter((op) => op.type === 'get' && op.value === true).length,
          sets: operations.filter((op) => op.type === 'set').length,
          deletes: operations.filter((op) => op.type === 'delete').length,
          clears: operations.filter((op) => op.type === 'clear').length,
        };

        return {
          ...stats,
          hitRate: stats.gets > 0 ? stats.hits / stats.gets : 0,
        };
      },
    };
  }

  /**
   * Create a cache wrapper that tracks TTL effectiveness
   */
  static createTTLTracker(cache: IEdgeCacheService) {
    const ttlData = new Map<string, { setTime: number; ttl: number }>();

    return {
      async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
        if (options?.ttl) {
          ttlData.set(key, { setTime: Date.now(), ttl: options.ttl });
        }
        await cache.set(key, value, options);
      },

      async checkTTL(key: string): Promise<{ expired: boolean; remainingTTL: number }> {
        const data = ttlData.get(key);
        if (!data) return { expired: true, remainingTTL: 0 };

        const elapsed = (Date.now() - data.setTime) / 1000;
        const remainingTTL = Math.max(0, data.ttl - elapsed);

        return {
          expired: remainingTTL <= 0,
          remainingTTL,
        };
      },

      getAverageTTL(): number {
        if (ttlData.size === 0) return 0;

        const ttls = Array.from(ttlData.values()).map((d) => d.ttl);
        return ttls.reduce((sum, ttl) => sum + ttl, 0) / ttls.length;
      },
    };
  }
}
