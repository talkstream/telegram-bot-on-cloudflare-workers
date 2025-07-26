import { describe, it, expect, beforeEach, vi } from 'vitest';

import { EdgeCacheService, generateCacheKey } from '../edge-cache-service';
import type { ILogger } from '../../../interfaces/logger';

// Mock Cache API
const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

// Mock global caches
vi.stubGlobal('caches', {
  default: mockCache,
});

describe('EdgeCacheService', () => {
  let service: EdgeCacheService;
  let mockLogger: ILogger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    service = new EdgeCacheService({ logger: mockLogger });
  });

  describe('get', () => {
    it('should return null when cache miss', async () => {
      mockCache.match.mockResolvedValue(null);

      const result = await service.get('test-key');

      expect(result).toBeNull();
      expect(mockCache.match).toHaveBeenCalledWith('https://cache.internal/test-key');
    });

    it('should return cached value when hit', async () => {
      const testData = { foo: 'bar' };
      const mockResponse = new Response(JSON.stringify(testData), {
        headers: {
          expires: new Date(Date.now() + 60000).toISOString(),
        },
      });
      mockCache.match.mockResolvedValue(mockResponse);

      const result = await service.get('test-key');

      expect(result).toEqual(testData);
      expect(mockLogger.debug).toHaveBeenCalledWith('Edge cache hit', { key: 'test-key' });
    });

    it('should return null and delete expired cache', async () => {
      const mockResponse = new Response(JSON.stringify({ foo: 'bar' }), {
        headers: {
          expires: new Date(Date.now() - 1000).toISOString(), // Expired
        },
      });
      mockCache.match.mockResolvedValue(mockResponse);
      mockCache.delete.mockResolvedValue(true);

      const result = await service.get('test-key');

      expect(result).toBeNull();
      expect(mockCache.delete).toHaveBeenCalledWith('https://cache.internal/test-key');
    });

    it('should handle errors gracefully', async () => {
      mockCache.match.mockRejectedValue(new Error('Cache error'));

      const result = await service.get('test-key');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Edge cache get error',
        expect.objectContaining({ key: 'test-key' }),
      );
    });
  });

  describe('set', () => {
    it('should store value with default TTL', async () => {
      const testData = { foo: 'bar' };

      await service.set('test-key', testData);

      expect(mockCache.put).toHaveBeenCalledWith(
        'https://cache.internal/test-key',
        expect.any(Response),
      );

      // Verify response headers
      const putCall = mockCache.put.mock.calls[0];
      const response = putCall[1] as Response;
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=300, s-maxage=300');
    });

    it('should store value with custom options', async () => {
      const testData = { foo: 'bar' };
      const options = {
        ttl: 600,
        tags: ['tag1', 'tag2'],
        browserTTL: 60,
        edgeTTL: 1800,
      };

      await service.set('test-key', testData, options);

      const putCall = mockCache.put.mock.calls[0];
      const response = putCall[1] as Response;
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=60, s-maxage=1800');
      expect(response.headers.get('X-Cache-Tags')).toBe('tag1,tag2');
    });

    it('should handle errors gracefully', async () => {
      mockCache.put.mockRejectedValue(new Error('Cache error'));

      await service.set('test-key', { foo: 'bar' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Edge cache set error',
        expect.objectContaining({ key: 'test-key' }),
      );
    });
  });

  describe('delete', () => {
    it('should delete cache entry', async () => {
      mockCache.delete.mockResolvedValue(true);

      await service.delete('test-key');

      expect(mockCache.delete).toHaveBeenCalledWith('https://cache.internal/test-key');
      expect(mockLogger.debug).toHaveBeenCalledWith('Edge cache delete', { key: 'test-key' });
    });

    it('should handle errors gracefully', async () => {
      mockCache.delete.mockRejectedValue(new Error('Delete error'));

      await service.delete('test-key');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Edge cache delete error',
        expect.objectContaining({ key: 'test-key' }),
      );
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const cachedData = { cached: true };
      const mockResponse = new Response(JSON.stringify(cachedData), {
        headers: {
          expires: new Date(Date.now() + 60000).toISOString(),
        },
      });
      mockCache.match.mockResolvedValue(mockResponse);

      const factory = vi.fn().mockResolvedValue({ fresh: true });

      const result = await service.getOrSet('test-key', factory);

      expect(result).toEqual(cachedData);
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result on miss', async () => {
      mockCache.match.mockResolvedValue(null);
      const freshData = { fresh: true };
      const factory = vi.fn().mockResolvedValue(freshData);

      const result = await service.getOrSet('test-key', factory, { ttl: 600 });

      expect(result).toEqual(freshData);
      expect(factory).toHaveBeenCalled();
      expect(mockCache.put).toHaveBeenCalled();
    });
  });

  describe('cacheResponse', () => {
    it('should cache HTTP response', async () => {
      const request = new Request('https://example.com/api/data');
      const response = new Response('{"data": "test"}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      await service.cacheResponse(request, response, { ttl: 600, tags: ['api'] });

      expect(mockCache.put).toHaveBeenCalledWith(request, expect.any(Response));

      const cachedResponse = mockCache.put.mock.calls[0][1] as Response;
      expect(cachedResponse.headers.get('Cache-Control')).toBe('public, max-age=600, s-maxage=600');
      expect(cachedResponse.headers.get('X-Cache-Tags')).toBe('api');
    });
  });

  describe('getCachedResponse', () => {
    it('should return cached response if not expired', async () => {
      const mockResponse = new Response('{"data": "test"}', {
        headers: {
          expires: new Date(Date.now() + 60000).toISOString(),
        },
      });
      mockCache.match.mockResolvedValue(mockResponse);

      const request = new Request('https://example.com/api/data');
      const result = await service.getCachedResponse(request);

      expect(result).toBe(mockResponse);
      expect(mockLogger.debug).toHaveBeenCalledWith('Response cache hit', {
        url: 'https://example.com/api/data',
      });
    });

    it('should return null and delete expired response', async () => {
      const mockResponse = new Response('{"data": "test"}', {
        headers: {
          expires: new Date(Date.now() - 1000).toISOString(),
        },
      });
      mockCache.match.mockResolvedValue(mockResponse);
      mockCache.delete.mockResolvedValue(true);

      const request = new Request('https://example.com/api/data');
      const result = await service.getCachedResponse(request);

      expect(result).toBeNull();
      expect(mockCache.delete).toHaveBeenCalledWith(request);
    });
  });

  describe('warmUp', () => {
    it('should warm up cache with multiple entries', async () => {
      mockCache.match.mockResolvedValue(null);

      const entries = [
        { key: 'key1', factory: vi.fn().mockResolvedValue({ data: 1 }) },
        { key: 'key2', factory: vi.fn().mockResolvedValue({ data: 2 }), options: { ttl: 600 } },
      ];

      await service.warmUp(entries);

      expect(entries[0].factory).toHaveBeenCalled();
      expect(entries[1].factory).toHaveBeenCalled();
      expect(mockCache.put).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith('Edge cache warmup completed', {
        total: 2,
        successful: 2,
      });
    });

    it('should handle warmup errors gracefully', async () => {
      mockCache.match.mockResolvedValue(null);
      mockCache.put.mockRejectedValue(new Error('Cache error'));

      const entries = [{ key: 'key1', factory: vi.fn().mockResolvedValue({ data: 1 }) }];

      await service.warmUp(entries);

      // Error happens in set method
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Edge cache set error',
        expect.objectContaining({ key: 'key1' }),
      );
    });
  });
});

describe('generateCacheKey', () => {
  it('should generate consistent cache keys', () => {
    const params1 = { userId: 123, category: 'electronics', active: true };
    const params2 = { active: true, userId: 123, category: 'electronics' }; // Different order

    const key1 = generateCacheKey('api', params1);
    const key2 = generateCacheKey('api', params2);

    expect(key1).toBe(key2);
    expect(key1).toBe('api:active:true:category:electronics:userId:123');
  });

  it('should handle empty params', () => {
    const key = generateCacheKey('test', {});
    expect(key).toBe('test:');
  });

  it('should handle different types of values', () => {
    const params = {
      string: 'value',
      number: 42,
      boolean: false,
    };

    const key = generateCacheKey('mixed', params);
    expect(key).toBe('mixed:boolean:false:number:42:string:value');
  });
});
