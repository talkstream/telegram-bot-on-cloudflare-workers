/**
 * Base class for creating cached versions of services
 *
 * Allows wrapping existing services with caching functionality
 * without modifying the original service implementation
 *
 * @module lib/cache/cached-service
 */

import { KVCache } from './kv-cache'

interface CacheableInstance {
  _cache?: KVCache
}

/**
 * Base class for cached services
 */
export abstract class CachedService<T> {
  constructor(
    protected service: T,
    protected cache: KVCache
  ) {}

  /**
   * Get the underlying service instance
   */
  protected getService(): T {
    return this.service
  }

  /**
   * Get the cache instance
   */
  protected getCache(): KVCache {
    return this.cache
  }
}

/**
 * Repository interface for cached repositories
 */
export interface IRepository<TEntity, TKey> {
  getById(id: TKey): Promise<TEntity | null>
  update(id: TKey, data: Partial<TEntity>): Promise<void>
  delete(id: TKey): Promise<void>
  create(data: Omit<TEntity, 'id'>): Promise<TEntity>
}

/**
 * Example implementation for a cached repository pattern
 */
export abstract class CachedRepository<TEntity, TKey> {
  constructor(
    protected repository: IRepository<TEntity, TKey>,
    protected cache: KVCache,
    protected config: {
      namespace: string
      ttl?: number
      keyPrefix?: string
    }
  ) {}

  /**
   * Generate cache key for entity
   */
  protected getCacheKey(id: TKey): string {
    const prefix = this.config.keyPrefix || 'entity'
    return `${prefix}:${id}`
  }

  /**
   * Get entity by ID with caching
   */
  async getById(id: TKey): Promise<TEntity | null> {
    return this.cache.getOrSet(this.getCacheKey(id), () => this.repository.getById(id), {
      ttl: this.config.ttl,
      namespace: this.config.namespace
    })
  }

  /**
   * Update entity and invalidate cache
   */
  async update(id: TKey, data: Partial<TEntity>): Promise<void> {
    await this.repository.update(id, data)
    await this.cache.delete(this.getCacheKey(id), this.config.namespace)
  }

  /**
   * Delete entity and invalidate cache
   */
  async delete(id: TKey): Promise<void> {
    await this.repository.delete(id)
    await this.cache.delete(this.getCacheKey(id), this.config.namespace)
  }

  /**
   * Create new entity (no caching needed)
   */
  async create(data: Omit<TEntity, 'id'>): Promise<TEntity> {
    return this.repository.create(data)
  }
}

/**
 * Decorator for caching method results
 *
 * Usage:
 * ```typescript
 * class MyService {
 *   @Cached({ ttl: 300, namespace: 'myservice' })
 *   async expensiveOperation(param: string): Promise<Result> {
 *     // ... expensive computation
 *   }
 * }
 * ```
 */
export function Cached(options: {
  ttl?: number
  namespace?: string
  keyGenerator?: (...args: unknown[]) => string
}) {
  return function (target: object, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (this: CacheableInstance, ...args: unknown[]) {
      // Ensure the instance has a cache property
      if (!this._cache) {
        console.warn(
          `@Cached decorator used but no _cache property found on ${target.constructor.name}`
        )
        return originalMethod.apply(this, args)
      }

      // Generate cache key
      const key = options.keyGenerator
        ? options.keyGenerator(...args)
        : `${propertyKey}:${JSON.stringify(args)}`

      // Try to get from cache
      const cached = await this._cache.get(key, options.namespace)
      if (cached !== null) {
        return cached
      }

      // Execute original method
      const result = await originalMethod.apply(this, args)

      // Cache the result
      await this._cache.set(key, result, {
        ttl: options.ttl,
        namespace: options.namespace
      })

      return result
    }

    return descriptor
  }
}

/**
 * Helper to create a cached version of any service
 */
export function createCachedProxy<T extends object>(
  service: T,
  cache: KVCache,
  config: {
    methods: string[]
    ttl?: number
    namespace?: string
  }
): T {
  return new Proxy(service, {
    get(target, prop) {
      const original = target[prop as keyof T]

      // Only wrap specified methods
      if (typeof original === 'function' && config.methods.includes(prop as string)) {
        return async (...args: unknown[]) => {
          const key = `${String(prop)}:${JSON.stringify(args)}`

          return cache.getOrSet(key, () => (original as Function).apply(target, args), {
            ttl: config.ttl,
            namespace: config.namespace
          })
        }
      }

      return original
    }
  })
}
