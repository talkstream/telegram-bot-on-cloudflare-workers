import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MultiLayerCache, type CacheLayer } from '../multi-layer-cache';
import { MemoryCacheAdapter } from '../cache-adapters/memory-cache-adapter';

// Mock cache layer for testing
class MockCacheLayer<T = unknown> implements CacheLayer<T> {
  name: string;
  private store = new Map<string, T>();
  private getCalls = 0;
  private setCalls = 0;

  constructor(name: string) {
    this.name = name;
  }

  async get(key: string): Promise<T | null> {
    this.getCalls++;
    return this.store.get(key) || null;
  }

  async set(key: string, value: T): Promise<void> {
    this.setCalls++;
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  getGetCalls(): number {
    return this.getCalls;
  }

  getSetCalls(): number {
    return this.setCalls;
  }

  clear(): void {
    this.store.clear();
    this.getCalls = 0;
    this.setCalls = 0;
  }
}

describe('MultiLayerCache', () => {
  let l1: MockCacheLayer<string>;
  let l2: MockCacheLayer<string>;
  let l3: MockCacheLayer<string>;
  let cache: MultiLayerCache<string>;

  beforeEach(() => {
    l1 = new MockCacheLayer('L1');
    l2 = new MockCacheLayer('L2');
    l3 = new MockCacheLayer('L3');

    cache = new MultiLayerCache<string>({
      layers: [l1, l2, l3],
      defaultTTL: 300,
    });
  });

  describe('constructor', () => {
    it('should throw error if no layers provided', () => {
      expect(() => new MultiLayerCache({ layers: [] })).toThrow(
        'At least one cache layer is required',
      );
    });
  });

  describe('get', () => {
    it('should return value from first layer if present', async () => {
      await l1.set('key1', 'value1');

      const result = await cache.get('key1');

      expect(result).toBe('value1');
      expect(l1.getGetCalls()).toBe(1);
      expect(l2.getGetCalls()).toBe(0);
      expect(l3.getGetCalls()).toBe(0);
    });

    it('should check subsequent layers if not in first', async () => {
      await l2.set('key1', 'value2');

      const result = await cache.get('key1');

      expect(result).toBe('value2');
      expect(l1.getGetCalls()).toBe(1);
      expect(l2.getGetCalls()).toBe(1);
      expect(l3.getGetCalls()).toBe(0);
    });

    it('should populate upper layers when found in lower layer', async () => {
      await l3.set('key1', 'value3');

      const result = await cache.get('key1');

      expect(result).toBe('value3');

      // Wait for async population
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check that upper layers were populated
      expect(await l1.get('key1')).toBe('value3');
      expect(await l2.get('key1')).toBe('value3');
    });

    it('should return null if not found in any layer', async () => {
      const result = await cache.get('nonexistent');

      expect(result).toBeNull();
      expect(l1.getGetCalls()).toBe(1);
      expect(l2.getGetCalls()).toBe(1);
      expect(l3.getGetCalls()).toBe(1);
    });

    it('should handle layer errors gracefully', async () => {
      const errorLayer = {
        name: 'error',
        get: vi.fn().mockRejectedValue(new Error('Layer error')),
        set: vi.fn(),
        delete: vi.fn(),
      };

      const cacheWithError = new MultiLayerCache<string>({
        layers: [errorLayer, l2],
      });

      await l2.set('key1', 'value2');
      const result = await cacheWithError.get('key1');

      expect(result).toBe('value2');
      expect(errorLayer.get).toHaveBeenCalled();
    });
  });

  describe('set', () => {
    it('should set value in all layers', async () => {
      await cache.set('key1', 'value1');

      expect(await l1.get('key1')).toBe('value1');
      expect(await l2.get('key1')).toBe('value1');
      expect(await l3.get('key1')).toBe('value1');
    });

    it('should handle layer errors gracefully', async () => {
      const errorLayer = {
        name: 'error',
        get: vi.fn(),
        set: vi.fn().mockRejectedValue(new Error('Set error')),
        delete: vi.fn(),
      };

      const cacheWithError = new MultiLayerCache<string>({
        layers: [errorLayer, l2],
      });

      await cacheWithError.set('key1', 'value1');

      // Should still set in working layer
      expect(await l2.get('key1')).toBe('value1');
    });
  });

  describe('delete', () => {
    it('should delete from all layers', async () => {
      await l1.set('key1', 'value1');
      await l2.set('key1', 'value1');
      await l3.set('key1', 'value1');

      await cache.delete('key1');

      expect(await l1.get('key1')).toBeNull();
      expect(await l2.get('key1')).toBeNull();
      expect(await l3.get('key1')).toBeNull();
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      await l1.set('key1', 'cached');
      const factory = vi.fn().mockResolvedValue('generated');

      const result = await cache.getOrSet('key1', factory);

      expect(result).toBe('cached');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should generate and cache value if not exists', async () => {
      const factory = vi.fn().mockResolvedValue('generated');

      const result = await cache.getOrSet('key1', factory);

      expect(result).toBe('generated');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(await l1.get('key1')).toBe('generated');
    });
  });

  describe('warmUp', () => {
    it('should warm up cache with multiple items', async () => {
      const items = [
        { key: 'item1', factory: () => Promise.resolve('value1') },
        { key: 'item2', factory: () => Promise.resolve('value2') },
        { key: 'item3', factory: () => Promise.resolve('value3') },
      ];

      await cache.warmUp(items);

      expect(await cache.get('item1')).toBe('value1');
      expect(await cache.get('item2')).toBe('value2');
      expect(await cache.get('item3')).toBe('value3');
    });

    it('should handle warmup errors gracefully', async () => {
      const items = [
        { key: 'item1', factory: () => Promise.resolve('value1') },
        { key: 'item2', factory: () => Promise.reject(new Error('Factory error')) },
        { key: 'item3', factory: () => Promise.resolve('value3') },
      ];

      await cache.warmUp(items);

      expect(await cache.get('item1')).toBe('value1');
      expect(await cache.get('item2')).toBeNull();
      expect(await cache.get('item3')).toBe('value3');
    });
  });

  describe('has', () => {
    it('should return true if key exists in any layer', async () => {
      await l2.set('key1', 'value');

      const result = await cache.has('key1');

      expect(result).toBe(true);
    });

    it('should return false if key does not exist', async () => {
      const result = await cache.has('nonexistent');

      expect(result).toBe(false);
    });

    it('should use get as fallback if has is not implemented', async () => {
      const layerWithoutHas = {
        name: 'no-has',
        get: vi.fn().mockResolvedValue('value'),
        set: vi.fn(),
        delete: vi.fn(),
      };

      const cacheWithoutHas = new MultiLayerCache({
        layers: [layerWithoutHas],
      });

      const result = await cacheWithoutHas.has('key1');

      expect(result).toBe(true);
      expect(layerWithoutHas.get).toHaveBeenCalledWith('key1');
    });
  });

  describe('statistics', () => {
    it('should track cache statistics', async () => {
      await l1.set('hit1', 'value1');
      await l2.set('hit2', 'value2');

      await cache.get('hit1'); // L1 hit
      await cache.get('hit2'); // L2 hit
      await cache.get('miss'); // Miss
      await cache.set('new', 'value');
      await cache.delete('hit1');

      const stats = cache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(1);
      expect(stats.deletes).toBe(1);
      expect(stats.layerHits['L1']).toBe(1);
      expect(stats.layerHits['L2']).toBe(1);
      expect(stats.layerHits['L3']).toBe(0);
    });

    it('should reset statistics', async () => {
      await cache.get('key');
      await cache.set('key', 'value');

      cache.resetStats();
      const stats = cache.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.deletes).toBe(0);
    });
  });

  describe('MemoryCacheAdapter', () => {
    let memCache: MemoryCacheAdapter<string>;

    beforeEach(() => {
      memCache = new MemoryCacheAdapter<string>();
    });

    it('should handle TTL expiration', async () => {
      // Set with 1ms TTL
      await memCache.set('key1', 'value1', { ttl: 0.001 });

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 5));

      const result = await memCache.get('key1');
      expect(result).toBeNull();
    });

    it('should support tag-based invalidation', async () => {
      await memCache.set('key1', 'value1', { tags: ['tag1', 'tag2'] });
      await memCache.set('key2', 'value2', { tags: ['tag1'] });
      await memCache.set('key3', 'value3', { tags: ['tag2'] });
      await memCache.set('key4', 'value4');

      const count = await memCache.invalidateByTags(['tag1']);

      expect(count).toBe(2);
      expect(await memCache.get('key1')).toBeNull();
      expect(await memCache.get('key2')).toBeNull();
      expect(await memCache.get('key3')).toBe('value3');
      expect(await memCache.get('key4')).toBe('value4');
    });

    it('should prune expired entries', async () => {
      await memCache.set('expired1', 'value1', { ttl: 0.001 });
      await memCache.set('expired2', 'value2', { ttl: 0.001 });
      await memCache.set('valid', 'value3', { ttl: 3600 });

      await new Promise((resolve) => setTimeout(resolve, 5));

      const pruned = await memCache.prune();

      expect(pruned).toBe(2);
      expect(memCache.size()).toBe(1);
      expect(await memCache.get('valid')).toBe('value3');
    });
  });

  describe('invalidatePattern', () => {
    it('should invalidate entries matching pattern', async () => {
      const layerWithPattern = {
        name: 'pattern-layer',
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        invalidatePattern: vi.fn().mockResolvedValue(3),
      };

      const cacheWithPattern = new MultiLayerCache({
        layers: [layerWithPattern],
      });

      const count = await cacheWithPattern.invalidatePattern(/user:.*/);

      expect(count).toBe(3);
      expect(layerWithPattern.invalidatePattern).toHaveBeenCalledWith(/user:.*/);
    });

    it('should handle layers without pattern support', async () => {
      const count = await cache.invalidatePattern(/test/);
      expect(count).toBe(0);
    });
  });
});
