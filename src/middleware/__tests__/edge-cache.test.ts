import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';

import { edgeCache, cacheInvalidator, warmupCache, DEFAULT_CACHE_CONFIG } from '../edge-cache';
import type { IEdgeCacheService } from '../../core/interfaces/cache';

// Mock EdgeCacheService
const createMockCacheService = (): IEdgeCacheService => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  has: vi.fn(),
  clear: vi.fn(),
  getOrSet: vi.fn(),
  cacheResponse: vi.fn(),
  getCachedResponse: vi.fn(),
  purgeByTags: vi.fn(),
  warmUp: vi.fn(),
});

describe('edgeCache middleware', () => {
  let app: Hono;
  let mockCacheService: IEdgeCacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    mockCacheService = createMockCacheService();
  });

  it('should skip caching for non-GET requests', async () => {
    app.use('*', edgeCache({ cacheService: mockCacheService }));
    app.post('/api/data', (c) => c.json({ success: true }));

    const res = await app.request('/api/data', {
      method: 'POST',
    });

    expect(mockCacheService.getCachedResponse).not.toHaveBeenCalled();
    expect(mockCacheService.cacheResponse).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('should skip caching for routes with ttl=0', async () => {
    app.use('*', edgeCache({ cacheService: mockCacheService }));
    app.get('/webhook', (c) => c.json({ data: 'webhook' }));

    const res = await app.request('/webhook', {});

    expect(mockCacheService.getCachedResponse).not.toHaveBeenCalled();
    expect(mockCacheService.cacheResponse).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('should return cached response when available', async () => {
    const cachedResponse = new Response('{"cached": true}', {
      headers: { 'Content-Type': 'application/json' },
    });
    (mockCacheService.getCachedResponse as ReturnType<typeof vi.fn>).mockResolvedValue(
      cachedResponse,
    );

    app.use('*', edgeCache({ cacheService: mockCacheService }));
    app.get('/api/data', (c) => c.json({ fresh: true }));

    const res = await app.request('/api/data', {});
    const data = await res.json();

    expect(data).toEqual({ cached: true });
    expect(res.headers.get('X-Cache-Status')).toBe('HIT');
  });

  it('should cache response on cache miss', async () => {
    (mockCacheService.getCachedResponse as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockCacheService.cacheResponse as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    app.use('*', edgeCache({ cacheService: mockCacheService }));
    app.get('/api/data', (c) => c.json({ fresh: true }));

    const res = await app.request('/api/data');
    const data = await res.json();

    expect(data).toEqual({ fresh: true });
    expect(res.headers.get('X-Cache-Status')).toBe('MISS');

    // Wait a bit for the cache promise to resolve
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockCacheService.cacheResponse).toHaveBeenCalledWith(
      expect.any(Request),
      expect.any(Response),
      expect.objectContaining({
        ttl: 300, // Default API TTL
        tags: ['api'],
      }),
    );
  });

  it('should use custom route configuration', async () => {
    (mockCacheService.getCachedResponse as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockCacheService.cacheResponse as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const customConfig = {
      '/api/custom': { ttl: 1800, tags: ['custom', 'api'] },
    };

    app.use(
      '*',
      edgeCache({
        cacheService: mockCacheService,
        routeConfig: customConfig,
      }),
    );
    app.get('/api/custom', (c) => c.json({ custom: true }));

    const res = await app.request('/api/custom');

    expect(res.status).toBe(200);

    // Wait a bit for the cache promise to resolve
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockCacheService.cacheResponse).toHaveBeenCalledWith(
      expect.any(Request),
      expect.any(Response),
      expect.objectContaining({
        ttl: 1800,
        tags: ['custom', 'api'],
      }),
    );
  });

  it('should not cache error responses', async () => {
    (mockCacheService.getCachedResponse as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    app.use('*', edgeCache({ cacheService: mockCacheService }));
    app.get('/api/error', (c) => c.json({ error: 'Not found' }, 404));

    const res = await app.request('/api/error', {});

    expect(res.status).toBe(404);
    expect(mockCacheService.cacheResponse).not.toHaveBeenCalled();
  });

  it('should use custom key generator', async () => {
    (mockCacheService.getCachedResponse as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockCacheService.cacheResponse as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const keyGenerator = vi.fn().mockReturnValue('custom-key');

    app.use(
      '*',
      edgeCache({
        cacheService: mockCacheService,
        keyGenerator,
      }),
    );
    app.get('/api/data', (c) => c.json({ data: true }));

    await app.request('/api/data?param=value', {});

    expect(keyGenerator).toHaveBeenCalledWith(
      expect.objectContaining({
        req: expect.objectContaining({
          url: expect.stringContaining('/api/data?param=value'),
        }),
      }),
    );
  });
});

describe('cacheInvalidator', () => {
  let app: Hono;
  let mockCacheService: IEdgeCacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    mockCacheService = createMockCacheService();
  });

  it('should invalidate cache by tags', async () => {
    app.post('/cache/invalidate', cacheInvalidator(mockCacheService));

    const res = await app.request('/cache/invalidate', {
      method: 'POST',
      body: JSON.stringify({ tags: ['api', 'users'] }),
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();

    expect(mockCacheService.purgeByTags).toHaveBeenCalledWith(['api', 'users']);
    expect(data).toEqual({
      success: true,
      message: 'Purged cache for tags: api, users',
    });
  });

  it('should delete specific cache keys', async () => {
    app.post('/cache/invalidate', cacheInvalidator(mockCacheService));

    const res = await app.request('/cache/invalidate', {
      method: 'POST',
      body: JSON.stringify({ keys: ['key1', 'key2'] }),
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();

    expect(mockCacheService.delete).toHaveBeenCalledWith('key1');
    expect(mockCacheService.delete).toHaveBeenCalledWith('key2');
    expect(data).toEqual({
      success: true,
      message: 'Deleted 2 cache entries',
    });
  });

  it('should return error when no tags or keys provided', async () => {
    app.post('/cache/invalidate', cacheInvalidator(mockCacheService));

    const res = await app.request('/cache/invalidate', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({
      success: false,
      message: 'No tags or keys provided for invalidation',
    });
  });
});

describe('warmupCache', () => {
  it('should delegate to cache service warmUp method', async () => {
    const mockCacheService = createMockCacheService();
    const entries = [
      { key: 'key1', factory: vi.fn() },
      { key: 'key2', factory: vi.fn(), options: { ttl: 600 } },
    ];

    await warmupCache(mockCacheService, entries);

    expect(mockCacheService.warmUp).toHaveBeenCalledWith(entries);
  });
});

describe('DEFAULT_CACHE_CONFIG', () => {
  it('should have appropriate default configurations', () => {
    expect(DEFAULT_CACHE_CONFIG['/webhook']?.ttl).toBe(0);
    expect(DEFAULT_CACHE_CONFIG['/admin']?.ttl).toBe(0);
    expect(DEFAULT_CACHE_CONFIG['/api/static']?.ttl).toBe(86400);
    expect(DEFAULT_CACHE_CONFIG['/api']?.ttl).toBe(300);
    expect(DEFAULT_CACHE_CONFIG['/health']?.ttl).toBe(60);
  });
});
