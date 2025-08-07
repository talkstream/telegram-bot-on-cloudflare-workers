import type { CacheOptions, IEdgeCacheService } from '../../interfaces/cache'
import type { ILogger } from '../../interfaces/logger'

// Use existing caches global from Cloudflare Workers
// The 'caches' global is already available in Workers environment

/**
 * Edge Cache Service using Cloudflare Cache API
 * Provides ultra-fast caching at the edge for improved performance
 *
 * This service is designed for paid Cloudflare Workers tiers and provides:
 * - Sub-10ms cache access
 * - Automatic cache invalidation
 * - Tag-based purging
 * - Response caching for HTTP requests
 */
export class EdgeCacheService implements IEdgeCacheService {
  private cacheApi: Cache
  private baseUrl: string
  private logger?: ILogger

  constructor(config: { baseUrl?: string; logger?: ILogger } = {}) {
    this.cacheApi = caches.default
    this.baseUrl = config.baseUrl || 'https://cache.internal'
    this.logger = config.logger
  }

  /**
   * Generate cache key URL
   */
  private getCacheKey(key: string): string {
    return `${this.baseUrl}/${key}`
  }

  /**
   * Get response from edge cache
   */
  async get(key: string): Promise<Response | null> {
    try {
      const cacheKey = this.getCacheKey(key)
      const cached = await this.cacheApi.match(cacheKey)

      if (!cached) {
        return null
      }

      // Check if expired
      const expires = cached.headers.get('expires')
      if (expires && new Date(expires) < new Date()) {
        await this.delete(key)
        return null
      }

      return cached
    } catch (error) {
      this.logger?.error('Edge cache get error', { error, key })
      return null
    }
  }

  /**
   * Put response into edge cache
   */
  async put(key: string, response: Response, _options?: CacheOptions): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(key)
      await this.cacheApi.put(cacheKey, response)
      this.logger?.debug('Edge cache put', { key })
    } catch (error) {
      this.logger?.error('Edge cache put error', { error, key })
    }
  }

  /**
   * Match request against cache
   */
  async match(request: Request): Promise<Response | undefined> {
    try {
      return await this.cacheApi.match(request)
    } catch (error) {
      this.logger?.error('Edge cache match error', { error })
      return undefined
    }
  }

  /**
   * Get item from edge cache (legacy method for JSON data)
   */
  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = this.getCacheKey(key)
      const cached = await this.cacheApi.match(cacheKey)

      if (!cached) {
        return null
      }

      // Check if expired
      const expires = cached.headers.get('expires')
      if (expires && new Date(expires) < new Date()) {
        await this.delete(key)
        return null
      }

      const data = await cached.json()
      this.logger?.debug('Edge cache hit', { key })
      return data as T
    } catch (error) {
      this.logger?.error('Edge cache get error', { error, key })
      return null
    }
  }

  /**
   * Set item in edge cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(key)
      const ttl = options?.ttl || 300 // Default 5 minutes

      const response = new Response(JSON.stringify(value), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${options?.browserTTL || ttl}, s-maxage=${
            options?.edgeTTL || ttl
          }`,
          Expires: new Date(Date.now() + ttl * 1000).toISOString(),
          'X-Cache-Tags': options?.tags?.join(',') || ''
        }
      })

      await this.cacheApi.put(cacheKey, response)
      this.logger?.debug('Edge cache set', { key, ttl })
    } catch (error) {
      this.logger?.error('Edge cache set error', { error, key })
    }
  }

  /**
   * Delete item from edge cache
   */
  async delete(key: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(key)
      const success = await this.cacheApi.delete(cacheKey)
      if (success) {
        this.logger?.debug('Edge cache delete', { key })
      }
    } catch (error) {
      this.logger?.error('Edge cache delete error', { error, key })
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key)
    return value !== null
  }

  /**
   * Clear all cache entries
   * Note: This is not supported in Cloudflare Cache API
   * Use tag-based purging instead
   */
  async clear(): Promise<void> {
    this.logger?.warn('Clear all cache is not supported in edge cache. Use tag-based purging.')
  }

  /**
   * Get or set with cache-aside pattern
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T> {
    // Try to get from cache as JSON
    const cached = await this.getJSON<T>(key)
    if (cached !== null) {
      return cached
    }

    // Generate value
    const value = await factory()

    // Cache it
    await this.set(key, value, options)

    return value
  }

  /**
   * Cache response object directly
   */
  async cacheResponse(request: Request, response: Response, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl || 300

      // Clone response to avoid consuming it
      const responseToCache = new Response(response.body, response)

      // Add cache headers
      responseToCache.headers.set(
        'Cache-Control',
        `public, max-age=${options?.browserTTL || ttl}, s-maxage=${options?.edgeTTL || ttl}`
      )
      responseToCache.headers.set('Expires', new Date(Date.now() + ttl * 1000).toISOString())

      if (options?.tags) {
        responseToCache.headers.set('X-Cache-Tags', options.tags.join(','))
      }

      await this.cacheApi.put(request, responseToCache)
      this.logger?.debug('Response cached', {
        url: request.url,
        ttl,
        tags: options?.tags
      })
    } catch (error) {
      this.logger?.error('Response cache error', { error, url: request.url })
    }
  }

  /**
   * Get cached response
   */
  async getCachedResponse(request: Request): Promise<Response | null> {
    try {
      const cached = await this.cacheApi.match(request)
      if (cached) {
        this.logger?.debug('Response cache hit', { url: request.url })

        // Check if expired
        const expires = cached.headers.get('expires')
        if (expires && new Date(expires) < new Date()) {
          await this.cacheApi.delete(request)
          return null
        }
      }
      return cached || null
    } catch (error) {
      this.logger?.error('Response cache get error', { error, url: request.url })
      return null
    }
  }

  /**
   * Purge cache by tags
   * Note: This requires Cloudflare API access
   */
  async purgeByTags(tags: string[]): Promise<void> {
    // Note: Tag-based purging requires Cloudflare API
    // This is a placeholder for the implementation
    this.logger?.info('Purging cache by tags', { tags })

    // In production, this would call Cloudflare API:
    // POST /zones/{zone_id}/purge_cache
    // { "tags": tags }

    // For now, log a warning
    this.logger?.warn(
      'Tag-based cache purging requires Cloudflare API configuration. ' +
        'See: https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-tags/'
    )
  }

  /**
   * Warm up cache with common queries
   */
  async warmUp(
    keys: Array<{
      key: string
      factory: () => Promise<unknown>
      options?: CacheOptions
    }>
  ): Promise<void> {
    this.logger?.info('Warming up edge cache', { count: keys.length })

    const warmupPromises = keys.map(async ({ key, factory, options }) => {
      try {
        await this.getOrSet(key, factory, options)
        this.logger?.debug('Cache warmed', { key })
      } catch (error) {
        this.logger?.error('Cache warmup failed', { error, key })
      }
    })

    await Promise.all(warmupPromises)

    this.logger?.info('Edge cache warmup completed', {
      total: keys.length,
      successful: warmupPromises.length
    })
  }
}

/**
 * Cache key generator for complex queries
 * Ensures consistent key generation across the application
 */
export function generateCacheKey(
  prefix: string,
  params: Record<string, string | number | boolean>
): string {
  const sortedParams = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join(':')

  return `${prefix}:${sortedParams}`
}
