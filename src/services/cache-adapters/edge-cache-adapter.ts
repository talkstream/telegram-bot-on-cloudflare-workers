/**
 * Edge cache adapter using Cloudflare Cache API for multi-layer caching
 */

import type { CacheLayer, CacheOptions } from '../multi-layer-cache';
import type { ILogger } from '../../core/interfaces/logger';

export interface EdgeCacheAdapterConfig {
  baseUrl?: string;
  logger?: ILogger;
}

export class EdgeCacheAdapter<T = unknown> implements CacheLayer<T> {
  name = 'edge';
  private cacheApi: Cache;
  private baseUrl: string;
  private logger?: ILogger;

  constructor(config?: EdgeCacheAdapterConfig) {
    // Check if running in Cloudflare Workers environment
    if (typeof caches === 'undefined') {
      throw new Error('Edge cache is only available in Cloudflare Workers environment');
    }

    this.cacheApi = caches.default;
    this.baseUrl = config?.baseUrl || 'https://cache.internal';
    this.logger = config?.logger;
  }

  private getCacheKey(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  async get(key: string): Promise<T | null> {
    try {
      const cacheKey = this.getCacheKey(key);
      const cached = await this.cacheApi.match(cacheKey);

      if (!cached) {
        return null;
      }

      // Check if expired
      const expires = cached.headers.get('expires');
      if (expires && new Date(expires) < new Date()) {
        await this.delete(key);
        return null;
      }

      const data = await cached.json();
      return data as T;
    } catch (error) {
      this.logger?.error('Edge cache get error', { error, key });
      return null;
    }
  }

  async set(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(key);
      const ttl = options?.ttl || 300; // Default 5 minutes

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
        Expires: new Date(Date.now() + ttl * 1000).toISOString(),
      };

      // Add tags if provided
      if (options?.tags && options.tags.length > 0) {
        headers['X-Cache-Tags'] = options.tags.join(',');
      }

      // Add metadata if provided
      if (options?.metadata) {
        headers['X-Cache-Metadata'] = JSON.stringify(options.metadata);
      }

      const response = new Response(JSON.stringify(value), { headers });

      await this.cacheApi.put(cacheKey, response);
    } catch (error) {
      this.logger?.error('Edge cache set error', { error, key });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(key);
      await this.cacheApi.delete(cacheKey);
    } catch (error) {
      this.logger?.error('Edge cache delete error', { error, key });
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const cacheKey = this.getCacheKey(key);
      const cached = await this.cacheApi.match(cacheKey);

      if (!cached) {
        return false;
      }

      // Check if expired
      const expires = cached.headers.get('expires');
      if (expires && new Date(expires) < new Date()) {
        await this.delete(key);
        return false;
      }

      return true;
    } catch (error) {
      this.logger?.error('Edge cache has error', { error, key });
      return false;
    }
  }

  /**
   * Cache a Response object directly
   */
  async cacheResponse(request: Request, response: Response, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl || 300;

      // Clone response to avoid consuming it
      const responseToCache = new Response(response.body, response);

      // Add cache headers
      responseToCache.headers.set('Cache-Control', `public, max-age=${ttl}, s-maxage=${ttl}`);
      responseToCache.headers.set('Expires', new Date(Date.now() + ttl * 1000).toISOString());

      if (options?.tags) {
        responseToCache.headers.set('X-Cache-Tags', options.tags.join(','));
      }

      await this.cacheApi.put(request, responseToCache);
    } catch (error) {
      this.logger?.error('Response cache error', { error, url: request.url });
    }
  }

  /**
   * Get cached Response
   */
  async getCachedResponse(request: Request): Promise<Response | null> {
    try {
      const cached = await this.cacheApi.match(request);
      return cached || null;
    } catch (error) {
      this.logger?.error('Response cache get error', { error, url: request.url });
      return null;
    }
  }

  /**
   * Warm up cache with multiple entries
   */
  async warmUp(
    entries: Array<{
      key: string;
      factory: () => Promise<T>;
      options?: CacheOptions;
    }>,
  ): Promise<void> {
    const promises = entries.map(({ key, factory, options }) =>
      factory()
        .then((value) => this.set(key, value, options))
        .catch((error) => {
          this.logger?.error('Cache warmup failed', { error, key });
        }),
    );

    await Promise.all(promises);
  }
}
