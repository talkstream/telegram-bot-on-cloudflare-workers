/**
 * Multi-layer caching service with automatic layer population
 * Provides a hierarchy of caches: L1 (fastest) -> L2 -> L3 (slowest)
 */

import type { ILogger } from '../core/interfaces/logger';

export interface CacheLayer<T = unknown> {
  name: string;
  get(key: string): Promise<T | null>;
  set(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  has?(key: string): Promise<boolean>;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for bulk invalidation
  metadata?: Record<string, unknown>;
}

export interface MultiLayerCacheConfig {
  layers: CacheLayer[];
  defaultTTL?: number;
  populateUpperLayers?: boolean;
  logger?: ILogger;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  layerHits: Record<string, number>;
}

export class MultiLayerCache<T = unknown> {
  private layers: CacheLayer<T>[];
  private defaultTTL: number;
  private populateUpperLayers: boolean;
  private logger?: ILogger;
  private stats: CacheStats;

  constructor(config: MultiLayerCacheConfig) {
    if (config.layers.length === 0) {
      throw new Error('At least one cache layer is required');
    }

    this.layers = config.layers as CacheLayer<T>[];
    this.defaultTTL = config.defaultTTL || 300; // 5 minutes default
    this.populateUpperLayers = config.populateUpperLayers ?? true;
    this.logger = config.logger;

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      layerHits: {},
    };

    // Initialize layer hit counters
    for (const layer of this.layers) {
      this.stats.layerHits[layer.name] = 0;
    }
  }

  /**
   * Get value from cache, checking each layer in order
   */
  async get(key: string): Promise<T | null> {
    const missedLayers: Array<{ layer: CacheLayer<T>; index: number }> = [];

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (!layer) continue;

      try {
        const value = await layer.get(key);

        if (value !== null) {
          this.stats.hits++;
          const layerName = layer.name;
          const hitCount = this.stats.layerHits[layerName];
          if (hitCount !== undefined) {
            this.stats.layerHits[layerName] = hitCount + 1;
          }
          this.logger?.debug('Cache hit', { key, layer: layer.name });

          // Populate upper layers if enabled
          if (this.populateUpperLayers && missedLayers.length > 0) {
            this.populateUpperLayersAsync(missedLayers, key, value);
          }

          return value;
        }

        missedLayers.push({ layer, index: i });
      } catch (error) {
        this.logger?.error('Cache layer error', { error, layer: layer.name, key });
      }
    }

    this.stats.misses++;
    this.logger?.debug('Cache miss', { key });
    return null;
  }

  /**
   * Set value in all cache layers
   */
  async set(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || this.defaultTTL;
    const promises: Promise<void>[] = [];

    for (const layer of this.layers) {
      promises.push(
        layer.set(key, value, { ...options, ttl }).catch((error) => {
          this.logger?.error('Failed to set in cache layer', {
            error,
            layer: layer.name,
            key,
          });
        }),
      );
    }

    await Promise.all(promises);
    this.stats.sets++;
    this.logger?.debug('Cache set', { key, ttl });
  }

  /**
   * Delete value from all cache layers
   */
  async delete(key: string): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const layer of this.layers) {
      promises.push(
        layer.delete(key).catch((error) => {
          this.logger?.error('Failed to delete from cache layer', {
            error,
            layer: layer.name,
            key,
          });
        }),
      );
    }

    await Promise.all(promises);
    this.stats.deletes++;
    this.logger?.debug('Cache delete', { key });
  }

  /**
   * Get or set with cache-aside pattern
   */
  async getOrSet(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T> {
    // Try to get from cache
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Generate value
    const value = await factory();

    // Cache it
    await this.set(key, value, options);

    return value;
  }

  /**
   * Warm up cache with predefined values
   */
  async warmUp(
    items: Array<{
      key: string;
      factory: () => Promise<T>;
      options?: CacheOptions;
    }>,
  ): Promise<void> {
    this.logger?.info('Warming up cache', { count: items.length });

    const promises = items.map(({ key, factory, options }) =>
      this.getOrSet(key, factory, options).catch((error) => {
        this.logger?.error('Cache warmup failed', { error, key });
      }),
    );

    await Promise.all(promises);
  }

  /**
   * Check if key exists in any layer
   */
  async has(key: string): Promise<boolean> {
    for (const layer of this.layers) {
      try {
        if (layer.has) {
          const exists = await layer.has(key);
          if (exists) return true;
        } else {
          // Fallback to get if has is not implemented
          const value = await layer.get(key);
          if (value !== null) return true;
        }
      } catch (error) {
        this.logger?.error('Cache layer error during has check', {
          error,
          layer: layer.name,
          key,
        });
      }
    }

    return false;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.sets = 0;
    this.stats.deletes = 0;

    for (const layer of this.layers) {
      this.stats.layerHits[layer.name] = 0;
    }
  }

  /**
   * Populate upper layers asynchronously
   */
  private populateUpperLayersAsync(
    missedLayers: Array<{ layer: CacheLayer<T>; index: number }>,
    key: string,
    value: T,
  ): void {
    // Calculate TTL based on layer position
    const baseTTL = this.defaultTTL;

    Promise.all(
      missedLayers.map(({ layer, index }) => {
        // Reduce TTL for upper layers
        const ttl = Math.max(60, Math.floor(baseTTL * (1 - index * 0.2)));

        return layer.set(key, value, { ttl }).catch((error) => {
          this.logger?.error('Failed to populate upper layer', {
            error,
            layer: layer.name,
            key,
          });
        });
      }),
    ).catch(() => {
      // Already logged individual errors
    });
  }

  /**
   * Invalidate by pattern (requires pattern support in layers)
   */
  async invalidatePattern(pattern: string | RegExp): Promise<number> {
    let totalInvalidated = 0;

    for (const layer of this.layers) {
      try {
        // Check if layer supports pattern invalidation
        if ('invalidatePattern' in layer && typeof layer.invalidatePattern === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Pattern invalidation is an optional extension
          const count = await (layer as any).invalidatePattern(pattern);
          totalInvalidated += count;
        }
      } catch (error) {
        this.logger?.error('Pattern invalidation error', {
          error,
          layer: layer.name,
          pattern: pattern.toString(),
        });
      }
    }

    return totalInvalidated;
  }
}
