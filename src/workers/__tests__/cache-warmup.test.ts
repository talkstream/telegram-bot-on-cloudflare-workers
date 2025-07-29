import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CacheWarmupService, CacheWarmupPatterns, type CacheWarmupItem } from '../cache-warmup.js';
import type { IEdgeCacheService } from '../../core/interfaces/cache.js';
import type { ILogger } from '../../core/interfaces/logger.js';

// Mock implementations
class MockEdgeCacheService implements IEdgeCacheService {
  private cache = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.cache.get(key) as T) || null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.cache.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = await this.get<T>(key);
    if (existing !== null) return existing;

    const value = await factory();
    await this.set(key, value);
    return value;
  }

  async cacheResponse(): Promise<void> {}
  async getCachedResponse(): Promise<Response | null> {
    return null;
  }
  async purgeByTags(): Promise<void> {}
  async warmUp(): Promise<void> {}
}

const mockLogger: ILogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('CacheWarmupService', () => {
  let cache: MockEdgeCacheService;
  let warmupService: CacheWarmupService;

  beforeEach(() => {
    cache = new MockEdgeCacheService();
    warmupService = new CacheWarmupService(cache, mockLogger);
    vi.clearAllMocks();
  });

  describe('warmup', () => {
    it('should warm up all items successfully', async () => {
      const items: CacheWarmupItem[] = [
        {
          key: 'test1',
          factory: async () => ({ data: 'value1' }),
        },
        {
          key: 'test2',
          factory: async () => ({ data: 'value2' }),
        },
      ];

      const result = await warmupService.warmup({ items });

      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.results).toHaveLength(2);

      // Verify items were cached
      expect(await cache.get('test1')).toEqual({ data: 'value1' });
      expect(await cache.get('test2')).toEqual({ data: 'value2' });
    });

    it('should respect priority order', async () => {
      const executionOrder: string[] = [];

      const items: CacheWarmupItem[] = [
        {
          key: 'low',
          factory: async () => {
            executionOrder.push('low');
            return 'low-value';
          },
          priority: 1,
        },
        {
          key: 'high',
          factory: async () => {
            executionOrder.push('high');
            return 'high-value';
          },
          priority: 10,
        },
        {
          key: 'medium',
          factory: async () => {
            executionOrder.push('medium');
            return 'medium-value';
          },
          priority: 5,
        },
      ];

      await warmupService.warmup({ items, concurrency: 1 });

      expect(executionOrder).toEqual(['high', 'medium', 'low']);
    });

    it('should skip already cached items when skipIfCached is true', async () => {
      // Pre-cache an item
      await cache.set('existing', { cached: true });

      const factorySpy = vi.fn().mockResolvedValue({ new: true });

      const items: CacheWarmupItem[] = [
        {
          key: 'existing',
          factory: factorySpy,
          skipIfCached: true,
        },
      ];

      const result = await warmupService.warmup({ items });

      expect(result.skipped).toBe(1);
      expect(result.successful).toBe(0);
      expect(factorySpy).not.toHaveBeenCalled();

      // Original value should remain
      expect(await cache.get('existing')).toEqual({ cached: true });
    });

    it('should handle failed items', async () => {
      const items: CacheWarmupItem[] = [
        {
          key: 'success',
          factory: async () => 'value',
        },
        {
          key: 'failure',
          factory: async () => {
            throw new Error('Factory failed');
          },
        },
      ];

      const result = await warmupService.warmup({ items });

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);

      const failedResult = result.results.find((r) => r.key === 'failure');
      expect(failedResult?.status).toBe('failed');
      expect(failedResult?.error).toBe('Factory failed');
    });

    it('should retry failed items when configured', async () => {
      let attempts = 0;

      const items: CacheWarmupItem[] = [
        {
          key: 'retry-test',
          factory: async () => {
            attempts++;
            if (attempts < 3) {
              throw new Error(`Attempt ${attempts} failed`);
            }
            return 'success';
          },
        },
      ];

      const result = await warmupService.warmup({
        items,
        retryFailures: true,
        maxRetries: 3,
      });

      expect(attempts).toBe(3);
      expect(result.successful).toBe(1);
      expect(await cache.get('retry-test')).toBe('success');
    });

    it('should respect concurrency limit', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const items: CacheWarmupItem[] = Array.from({ length: 10 }, (_, i) => ({
        key: `concurrent-${i}`,
        factory: async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((resolve) => setTimeout(resolve, 10));
          concurrent--;
          return i;
        },
      }));

      await warmupService.warmup({ items, concurrency: 3 });

      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });
  });
});

describe('CacheWarmupPatterns', () => {
  describe('createApiEndpointWarmup', () => {
    it('should create warmup items for API endpoints', () => {
      const endpoints = [
        { path: '/api/users', ttl: 300, priority: 5 },
        { path: '/api/posts', method: 'POST', params: { limit: '10' } },
      ];

      const factory = vi.fn();
      const items = CacheWarmupPatterns.createApiEndpointWarmup(endpoints, () => factory);

      expect(items).toHaveLength(2);
      expect(items[0].key).toBe('api:GET:/api/users');
      expect(items[0].options?.ttl).toBe(300);
      expect(items[0].priority).toBe(5);

      expect(items[1].key).toBe('api:POST:/api/posts:limit=10');
      expect(items[1].factory).toBe(factory);
    });

    it('should handle endpoints with multiple params consistently', () => {
      const endpoints = [{ path: '/api/search', params: { q: 'test', sort: 'date', limit: '20' } }];

      const items = CacheWarmupPatterns.createApiEndpointWarmup(endpoints, () => async () => ({}));

      // Params should be sorted alphabetically
      expect(items[0].key).toBe('api:GET:/api/search:limit=20&q=test&sort=date');
    });
  });

  describe('createDatabaseWarmup', () => {
    it('should create warmup items for database queries', () => {
      const queries = [
        {
          name: 'user-count',
          query: async () => ({ count: 100 }),
          ttl: 600,
          tags: ['users', 'stats'],
          priority: 8,
        },
        {
          name: 'recent-posts',
          query: async () => [],
        },
      ];

      const items = CacheWarmupPatterns.createDatabaseWarmup(queries);

      expect(items).toHaveLength(2);
      expect(items[0].key).toBe('db:user-count');
      expect(items[0].options?.ttl).toBe(600);
      expect(items[0].options?.tags).toEqual(['users', 'stats']);
      expect(items[0].priority).toBe(8);

      expect(items[1].key).toBe('db:recent-posts');
      expect(items[1].options?.ttl).toBe(300); // default
    });
  });
});
