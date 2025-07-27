import { describe, it, expect, beforeEach, vi } from 'vitest';

import { KVCache, getTTLUntilEndOfDay, getExponentialTTL } from '../kv-cache';

import type { IKeyValueStore } from '@/core/interfaces/storage';

// Mock KV store
class MockKVStore implements IKeyValueStore {
  private store = new Map<string, unknown>();
  private metadata = new Map<string, { metadata: unknown; options?: unknown }>();

  async get<T = string>(key: string): Promise<T | null> {
    const value = this.store.get(key);
    return (value !== undefined ? value : null) as T | null;
  }

  async getWithMetadata<T = string>(
    key: string,
  ): Promise<{ value: T | null; metadata: Record<string, unknown> | null }> {
    const value = await this.get<T>(key);
    const meta = this.metadata.get(key);
    return {
      value,
      metadata: (meta?.metadata as Record<string, unknown> | null) ?? null,
    };
  }

  async put(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
    this.metadata.delete(key);
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string; metadata?: Record<string, unknown> }>;
    list_complete: boolean;
    cursor?: string;
  }> {
    let keys = Array.from(this.store.keys());

    if (options?.prefix) {
      const prefix = options.prefix;
      keys = keys.filter((key) => key.startsWith(prefix));
    }

    if (options?.limit) {
      keys = keys.slice(0, options.limit);
    }

    return {
      keys: keys.map((name) => ({ name })),
      list_complete: true,
      cursor: undefined,
    };
  }

  // Mock method for metadata support
  async putWithMetadata(
    key: string,
    value: string,
    metadata: unknown,
    options?: { expirationTtl: number },
  ): Promise<void> {
    this.store.set(key, value);
    this.metadata.set(key, { metadata, options });
  }

  // Test helper
  clear(): void {
    this.store.clear();
    this.metadata.clear();
  }
}

describe('KVCache', () => {
  let cache: KVCache;
  let mockKV: MockKVStore;

  beforeEach(() => {
    mockKV = new MockKVStore();
    cache = new KVCache(mockKV);
  });

  describe('Basic Operations', () => {
    it('should set and get values', async () => {
      const data = { id: 1, name: 'Test User' };

      await cache.set('test-key', data);
      const retrieved = await cache.get('test-key');

      expect(retrieved).toEqual(data);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should delete values', async () => {
      await cache.set('delete-test', 'value');
      expect(await cache.get('delete-test')).toBe('value');

      await cache.delete('delete-test');
      expect(await cache.get('delete-test')).toBeNull();
    });

    it('should handle namespaces correctly', async () => {
      await cache.set('key', 'value1', { namespace: 'ns1' });
      await cache.set('key', 'value2', { namespace: 'ns2' });

      expect(await cache.get('key', 'ns1')).toBe('value1');
      expect(await cache.get('key', 'ns2')).toBe('value2');
    });
  });

  describe('getOrSet Pattern', () => {
    it('should use cached value when available', async () => {
      let factoryCalls = 0;
      const factory = async () => {
        factoryCalls++;
        return { value: 'test' };
      };

      // First call - should execute factory
      const result1 = await cache.getOrSet('cache-key', factory);
      expect(factoryCalls).toBe(1);
      expect(result1).toEqual({ value: 'test' });

      // Second call - should use cache
      const result2 = await cache.getOrSet('cache-key', factory);
      expect(factoryCalls).toBe(1); // Factory not called again
      expect(result2).toEqual({ value: 'test' });
    });

    it('should respect options in getOrSet', async () => {
      const factory = async () => ({ data: 'test' });

      await cache.getOrSet('key', factory, {
        namespace: 'custom',
        ttl: 600,
      });

      // Should be able to retrieve with same namespace
      const cached = await cache.get('key', 'custom');
      expect(cached).toEqual({ data: 'test' });

      // Should not exist in default namespace
      const notCached = await cache.get('key');
      expect(notCached).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should not throw on get errors', async () => {
      const errorKV: IKeyValueStore = {
        get: vi.fn().mockRejectedValue(new Error('KV Error')),
        getWithMetadata: vi.fn().mockRejectedValue(new Error('KV Error')),
        put: vi.fn().mockRejectedValue(new Error('KV Error')),
        delete: vi.fn().mockRejectedValue(new Error('KV Error')),
        list: vi.fn().mockRejectedValue(new Error('KV Error')),
      };
      const errorCache = new KVCache(errorKV);

      const result = await errorCache.get('key');
      expect(result).toBeNull();
    });

    it('should not throw on set errors', async () => {
      const errorKV: IKeyValueStore = {
        get: vi.fn().mockResolvedValue(null),
        getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
        put: vi.fn().mockRejectedValue(new Error('KV Error')),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
      };
      const errorCache = new KVCache(errorKV);

      await expect(errorCache.set('key', 'value')).resolves.not.toThrow();
    });

    it('should not throw on delete errors', async () => {
      const errorKV: IKeyValueStore = {
        get: vi.fn().mockResolvedValue(null),
        getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockRejectedValue(new Error('KV Error')),
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
      };
      const errorCache = new KVCache(errorKV);

      await expect(errorCache.delete('key')).resolves.not.toThrow();
    });
  });

  describe('Statistics', () => {
    it('should track cache hits and misses', async () => {
      await cache.set('existing', 'value');

      // Hit
      await cache.get('existing');
      // Miss
      await cache.get('non-existing');
      // Another hit
      await cache.get('existing');

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });

    it('should track sets and deletes', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.delete('key1');

      const stats = cache.getStats();
      expect(stats.sets).toBe(2);
      expect(stats.deletes).toBe(1);
    });

    it('should reset statistics', async () => {
      await cache.set('key', 'value');
      await cache.get('key');

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
    });
  });

  describe('JSON Handling', () => {
    it('should handle complex objects', async () => {
      const complexData = {
        id: 1,
        user: {
          name: 'Test',
          roles: ['admin', 'user'],
          metadata: {
            lastLogin: new Date().toISOString(),
          },
        },
      };

      await cache.set('complex', complexData);
      const retrieved = await cache.get('complex');

      expect(retrieved).toEqual(complexData);
    });

    it('should handle arrays', async () => {
      const arrayData = [1, 2, 3, { id: 4 }];

      await cache.set('array', arrayData);
      const retrieved = await cache.get('array');

      expect(retrieved).toEqual(arrayData);
    });
  });
});

describe('TTL Utilities', () => {
  it('should calculate TTL until end of day', () => {
    const ttl = getTTLUntilEndOfDay();

    // Should be between 0 and 24 hours
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(24 * 60 * 60);
  });

  it('should calculate exponential TTL', () => {
    expect(getExponentialTTL(0)).toBe(60); // Base: 60s
    expect(getExponentialTTL(1)).toBe(120); // 2x: 120s
    expect(getExponentialTTL(2)).toBe(240); // 4x: 240s
    expect(getExponentialTTL(10)).toBe(3600); // Max: 1 hour
  });

  it('should respect custom base for exponential TTL', () => {
    expect(getExponentialTTL(0, 30)).toBe(30);
    expect(getExponentialTTL(1, 30)).toBe(60);
    expect(getExponentialTTL(2, 30)).toBe(120);
  });
});
