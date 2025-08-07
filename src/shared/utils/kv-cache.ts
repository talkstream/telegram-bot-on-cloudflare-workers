import type { KVNamespace } from '@cloudflare/workers-types'

import { logger } from '@/lib/logger'

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  prefix?: string // Key prefix for namespacing
}

export class KVCache {
  constructor(
    private readonly kv: KVNamespace,
    private readonly defaultOptions: CacheOptions = {}
  ) {}

  /**
   * Get a value from cache
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key)

    try {
      const value = await this.kv.get(fullKey, 'json')

      if (value === null) {
        logger.debug('Cache miss', { key: fullKey })
        return null
      }

      logger.debug('Cache hit', { key: fullKey })
      return value as T
    } catch (error) {
      logger.error('Cache get error', { error, key: fullKey })
      return null
    }
  }

  /**
   * Get a string value from cache
   */
  async getString(key: string): Promise<string | null> {
    const fullKey = this.buildKey(key)

    try {
      const value = await this.kv.get(fullKey)

      if (value === null) {
        logger.debug('Cache miss', { key: fullKey })
        return null
      }

      logger.debug('Cache hit', { key: fullKey })
      return value
    } catch (error) {
      logger.error('Cache get error', { error, key: fullKey })
      return null
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const fullKey = this.buildKey(key)
    const ttl = options?.ttl ?? this.defaultOptions.ttl

    try {
      const putOptions: KVNamespacePutOptions = {}

      if (ttl) {
        putOptions.expirationTtl = ttl
      }

      if (typeof value === 'string') {
        await this.kv.put(fullKey, value, putOptions)
      } else {
        await this.kv.put(fullKey, JSON.stringify(value), putOptions)
      }

      logger.debug('Cache set', { key: fullKey, ttl })
    } catch (error) {
      logger.error('Cache set error', { error, key: fullKey })
      throw error
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.buildKey(key)

    try {
      await this.kv.delete(fullKey)
      logger.debug('Cache delete', { key: fullKey })
    } catch (error) {
      logger.error('Cache delete error', { error, key: fullKey })
      throw error
    }
  }

  /**
   * Check if a key exists in cache
   */
  async has(key: string): Promise<boolean> {
    const value = await this.getString(key)
    return value !== null
  }

  /**
   * Get or set a value in cache
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T> | T,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key)

    if (cached !== null) {
      return cached
    }

    const value = await factory()
    await this.set(key, value, options)

    return value
  }

  /**
   * List keys with a prefix
   */
  async list(prefix?: string): Promise<string[]> {
    const fullPrefix = this.buildKey(prefix || '')

    try {
      const list = await this.kv.list({ prefix: fullPrefix })
      return list.keys.map(key => key.name)
    } catch (error) {
      logger.error('Cache list error', { error, prefix: fullPrefix })
      return []
    }
  }

  /**
   * Clear all keys with a prefix
   */
  async clear(prefix?: string): Promise<void> {
    const keys = await this.list(prefix)

    await Promise.all(keys.map(key => this.kv.delete(key)))

    logger.info('Cache cleared', { prefix, count: keys.length })
  }

  /**
   * Build a full key with prefix
   */
  private buildKey(key: string): string {
    const prefix = this.defaultOptions.prefix
    return prefix ? `${prefix}:${key}` : key
  }
}

// Factory function for creating cache instances
export function createCache(kv: KVNamespace, options?: CacheOptions): KVCache {
  return new KVCache(kv, options)
}

// Preset cache configurations
export function createUserCache(kv: KVNamespace): KVCache {
  return new KVCache(kv, {
    prefix: 'user',
    ttl: 3600 // 1 hour
  })
}

export function createSessionCache(kv: KVNamespace): KVCache {
  return new KVCache(kv, {
    prefix: 'session',
    ttl: 86400 // 24 hours
  })
}

export function createRateLimitCache(kv: KVNamespace): KVCache {
  return new KVCache(kv, {
    prefix: 'rate_limit',
    ttl: 60 // 1 minute
  })
}
