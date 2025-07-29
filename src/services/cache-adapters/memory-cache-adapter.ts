/**
 * In-memory cache adapter for multi-layer caching
 */

import type { CacheLayer, CacheOptions } from '../multi-layer-cache';

interface CacheEntry<T> {
  value: T;
  expires: number;
  tags?: string[];
}

export class MemoryCacheAdapter<T = unknown> implements CacheLayer<T> {
  name = 'memory';
  private cache = new Map<string, CacheEntry<T>>();
  private tagIndex = new Map<string, Set<string>>();

  async get(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expires) {
      await this.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || 300;
    const expires = Date.now() + ttl * 1000;

    // Remove from old tags if exists
    const existingEntry = this.cache.get(key);
    if (existingEntry?.tags) {
      this.removeFromTags(key, existingEntry.tags);
    }

    // Set new entry
    const entry: CacheEntry<T> = {
      value,
      expires,
      tags: options?.tags,
    };

    this.cache.set(key, entry);

    // Update tag index
    if (options?.tags) {
      this.addToTags(key, options.tags);
    }
  }

  async delete(key: string): Promise<void> {
    const entry = this.cache.get(key);
    if (entry) {
      if (entry.tags) {
        this.removeFromTags(key, entry.tags);
      }
      this.cache.delete(key);
    }
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check expiration
    if (Date.now() > entry.expires) {
      await this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.tagIndex.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Invalidate entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    const keysToDelete = new Set<string>();

    for (const tag of tags) {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        for (const key of keys) {
          keysToDelete.add(key);
        }
      }
    }

    const count = keysToDelete.size;
    for (const key of keysToDelete) {
      await this.delete(key);
    }

    return count;
  }

  /**
   * Prune expired entries
   */
  async prune(): Promise<number> {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      await this.delete(key);
    }

    return keysToDelete.length;
  }

  private addToTags(key: string, tags: string[]): void {
    for (const tag of tags) {
      let keys = this.tagIndex.get(tag);
      if (!keys) {
        keys = new Set();
        this.tagIndex.set(tag, keys);
      }
      keys.add(key);
    }
  }

  private removeFromTags(key: string, tags: string[]): void {
    for (const tag of tags) {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        keys.delete(key);
        if (keys.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }
  }
}
