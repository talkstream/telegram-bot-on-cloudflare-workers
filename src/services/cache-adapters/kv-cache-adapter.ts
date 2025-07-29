/**
 * Key-Value store cache adapter for multi-layer caching
 */

import type { IKeyValueStore } from '../../core/interfaces/storage';
import type { CacheLayer, CacheOptions } from '../multi-layer-cache';

export interface KVCacheAdapterConfig {
  prefix?: string;
  defaultTTL?: number;
}

export class KVCacheAdapter<T = unknown> implements CacheLayer<T> {
  name = 'kv';
  private kv: IKeyValueStore;
  private prefix: string;
  private defaultTTL: number;

  constructor(kv: IKeyValueStore, config?: KVCacheAdapterConfig) {
    this.kv = kv;
    this.prefix = config?.prefix || 'cache:';
    this.defaultTTL = config?.defaultTTL || 300;
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<T | null> {
    try {
      const fullKey = this.getKey(key);
      const data = await this.kv.get(fullKey);

      if (!data) {
        return null;
      }

      // Parse stored data
      const entry = JSON.parse(data);

      // Check expiration
      if (entry.expires && Date.now() > entry.expires) {
        await this.delete(key);
        return null;
      }

      return entry.value as T;
    } catch {
      // Invalid data or parsing error
      return null;
    }
  }

  async set(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || this.defaultTTL;
    const expires = Date.now() + ttl * 1000;

    const entry = {
      value,
      expires,
      tags: options?.tags,
      metadata: options?.metadata,
    };

    const fullKey = this.getKey(key);
    await this.kv.put(fullKey, JSON.stringify(entry), { expirationTtl: ttl });

    // Store tag index if tags are provided
    if (options?.tags && options.tags.length > 0) {
      await this.updateTagIndex(key, options.tags);
    }
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getKey(key);

    // Get entry to clean up tags
    const data = await this.kv.get(fullKey);
    if (data) {
      try {
        const entry = JSON.parse(data);
        if (entry.tags) {
          await this.removeFromTagIndex(key, entry.tags);
        }
      } catch {
        // Ignore parsing errors
      }
    }

    await this.kv.delete(fullKey);
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Invalidate entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let count = 0;

    for (const tag of tags) {
      const tagKey = `${this.prefix}tag:${tag}`;
      const keysData = await this.kv.get(tagKey);

      if (keysData) {
        try {
          const keys = JSON.parse(keysData) as string[];
          for (const key of keys) {
            await this.delete(key);
            count++;
          }
        } catch {
          // Ignore parsing errors
        }
      }
    }

    return count;
  }

  /**
   * Invalidate entries by pattern
   */
  async invalidatePattern(pattern: string | RegExp): Promise<number> {
    // Get all keys with prefix
    const keys = await this.kv.list({ prefix: this.prefix });
    let count = 0;

    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);

    for (const keyInfo of keys.keys) {
      // Remove prefix to get original key
      const originalKey = keyInfo.name.substring(this.prefix.length);

      if (regex.test(originalKey)) {
        await this.delete(originalKey);
        count++;
      }
    }

    return count;
  }

  private async updateTagIndex(key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `${this.prefix}tag:${tag}`;
      const existingData = await this.kv.get(tagKey);

      let keys: string[] = [];
      if (existingData) {
        try {
          keys = JSON.parse(existingData);
        } catch {
          keys = [];
        }
      }

      if (!keys.includes(key)) {
        keys.push(key);
        await this.kv.put(tagKey, JSON.stringify(keys), { expirationTtl: 86400 }); // 24 hours
      }
    }
  }

  private async removeFromTagIndex(key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `${this.prefix}tag:${tag}`;
      const existingData = await this.kv.get(tagKey);

      if (existingData) {
        try {
          let keys = JSON.parse(existingData) as string[];
          keys = keys.filter((k) => k !== key);

          if (keys.length > 0) {
            await this.kv.put(tagKey, JSON.stringify(keys), { expirationTtl: 86400 });
          } else {
            await this.kv.delete(tagKey);
          }
        } catch {
          // Ignore parsing errors
        }
      }
    }
  }
}
