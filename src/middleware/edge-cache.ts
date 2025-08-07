import type { Context, Next } from 'hono'

import type { IEdgeCacheService, RouteCacheConfig } from '../core/interfaces/cache'
import { EdgeCacheService } from '../core/services/cache/edge-cache-service'

/**
 * Default cache configuration for different route patterns
 * Can be overridden by passing custom config to the middleware
 */
export const DEFAULT_CACHE_CONFIG: Record<string, RouteCacheConfig> = {
  '/webhook': { ttl: 0, tags: [] }, // No cache for webhooks
  '/admin': { ttl: 0, tags: [] }, // No cache for admin
  '/api/static': { ttl: 86400, tags: ['api', 'static'] }, // 24 hours for static data
  '/api': { ttl: 300, tags: ['api'] }, // 5 minutes for API calls
  '/health': { ttl: 60, tags: ['monitoring'] }, // 1 minute for health checks
  '/metrics': { ttl: 60, tags: ['monitoring'] } // 1 minute for metrics
}

/**
 * Edge cache middleware configuration
 */
export interface EdgeCacheMiddlewareConfig {
  /** Cache service instance */
  cacheService?: IEdgeCacheService
  /** Route cache configurations */
  routeConfig?: Record<string, RouteCacheConfig>
  /** Skip caching for these methods */
  skipMethods?: string[]
  /** Custom cache key generator */
  keyGenerator?: (c: Context) => string
  /** Enable debug logging */
  debug?: boolean
}

/**
 * Edge cache middleware using Cloudflare Cache API
 * Provides automatic response caching based on route configuration
 *
 * @example
 * ```typescript
 * // Basic usage with defaults
 * app.use('*', edgeCache());
 *
 * // Custom configuration
 * app.use('*', edgeCache({
 *   routeConfig: {
 *     '/api/users': { ttl: 600, tags: ['users'] },
 *     '/api/posts': { ttl: 300, tags: ['posts'] }
 *   }
 * }));
 * ```
 */
export function edgeCache(config: EdgeCacheMiddlewareConfig = {}) {
  const cacheService = config.cacheService || new EdgeCacheService()
  const routeConfig = { ...DEFAULT_CACHE_CONFIG, ...config.routeConfig }
  const skipMethods = config.skipMethods || ['POST', 'PUT', 'PATCH', 'DELETE']
  const debug = config.debug || false

  return async (c: Context, next: Next) => {
    // Skip caching for non-cacheable methods
    if (skipMethods.includes(c.req.method)) {
      await next()
      return
    }

    // Get cache configuration for the route
    const cacheConfig = getCacheConfig(c.req.path, routeConfig)

    // Skip if no caching configured
    if (cacheConfig.ttl === 0) {
      await next()
      return
    }

    // Generate cache key (for future use with custom key generators)
    // const cacheKey = config.keyGenerator
    //   ? config.keyGenerator(c)
    //   : c.req.url;

    // Try to get from cache
    const cachedResponse = cacheService.getCachedResponse
      ? await cacheService.getCachedResponse(c.req.raw)
      : null
    if (cachedResponse) {
      if (debug) {
        // Log cache hit (in production, use proper logger)
      }
      // Add cache status header
      cachedResponse.headers.set('X-Cache-Status', 'HIT')
      return cachedResponse
    }

    // Execute handler
    await next()

    // Cache successful responses
    if (c.res.status >= 200 && c.res.status < 300) {
      // Clone response to avoid consuming it
      const responseToCache = c.res.clone()

      // Add cache status header
      c.res.headers.set('X-Cache-Status', 'MISS')

      // Cache in background
      const cachePromise = cacheService.cacheResponse
        ? cacheService.cacheResponse(c.req.raw, responseToCache, {
            ttl: cacheConfig.ttl,
            tags: cacheConfig.tags,
            browserTTL: Math.min(cacheConfig.ttl, 300), // Max 5 min browser cache
            edgeTTL: cacheConfig.ttl
          })
        : Promise.resolve()

      cachePromise
        .then(() => {
          if (debug) {
            // eslint-disable-next-line no-console
            console.log(`[EdgeCache] Cached response for ${c.req.path}`)
          }
          return
        })
        .catch(() => {
          // Ignore cache errors - they should not break the response
        })

      // Use executionCtx if available (production), otherwise await (testing)
      try {
        c.executionCtx.waitUntil(cachePromise)
      } catch (_e) {
        // In testing environment, just fire and forget
        cachePromise.catch((err: unknown) => {
          if (debug) {
            console.error(`[EdgeCache] Failed to cache response: ${err}`)
          }
        })
      }
    }

    return c.res
  }
}

/**
 * Get cache configuration for a path
 */
function getCacheConfig(
  path: string,
  routeConfig: Record<string, RouteCacheConfig>
): RouteCacheConfig {
  // Check exact match
  if (routeConfig[path]) {
    return routeConfig[path]
  }

  // Check prefix match
  for (const [pattern, config] of Object.entries(routeConfig)) {
    if (path.startsWith(pattern)) {
      return config
    }
  }

  // Default: no cache
  return { ttl: 0, tags: [] }
}

/**
 * Cache invalidation helper middleware
 * Allows manual cache invalidation via special endpoints
 *
 * @example
 * ```typescript
 * // Add cache invalidation endpoint
 * app.post('/cache/invalidate', cacheInvalidator(cacheService));
 * ```
 */
export function cacheInvalidator(cacheService: IEdgeCacheService) {
  return async (c: Context) => {
    const body = await c.req.json<{ tags?: string[]; keys?: string[] }>()

    if (body.tags && body.tags.length > 0) {
      await cacheService.purgeByTags(body.tags)
      return c.json({
        success: true,
        message: `Purged cache for tags: ${body.tags.join(', ')}`
      })
    }

    if (body.keys && body.keys.length > 0) {
      await Promise.all(body.keys.map(key => cacheService.delete(key)))
      return c.json({
        success: true,
        message: `Deleted ${body.keys.length} cache entries`
      })
    }

    return c.json(
      {
        success: false,
        message: 'No tags or keys provided for invalidation'
      },
      400
    )
  }
}

/**
 * Cache warmup helper
 * Pre-populates cache with common queries
 *
 * @example
 * ```typescript
 * // Warm up cache on startup
 * await warmupCache(cacheService, [
 *   { key: 'api:users:list', factory: () => fetchUsers() },
 *   { key: 'api:config', factory: () => getConfig(), options: { ttl: 3600 } }
 * ]);
 * ```
 */
export async function warmupCache(
  cacheService: IEdgeCacheService,
  entries: Array<{
    key: string
    factory: () => Promise<unknown>
    options?: import('../core/interfaces/cache').CacheOptions
  }>
): Promise<void> {
  if (cacheService.warmUp) {
    await cacheService.warmUp(entries)
  }
}
