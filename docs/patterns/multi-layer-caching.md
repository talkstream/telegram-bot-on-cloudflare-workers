# Multi-Layer Caching Pattern

This document describes the multi-layer caching implementation that provides a hierarchical caching system with automatic layer population and intelligent TTL management.

## Overview

The multi-layer cache pattern allows you to chain multiple cache layers together, where each layer has different performance characteristics and storage capacities. When a cache miss occurs in a faster layer, the system automatically checks slower layers and populates the faster layers with found values.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   L1: Edge  │ --> │  L2: KV     │ --> │ L3: Database│
│  (fastest)  │     │   (fast)    │     │  (slowest)  │
└─────────────┘     └─────────────┘     └─────────────┘
       ↑                    ↑                    │
       └────────────────────┴────────────────────┘
              Auto-population on cache hit
```

## Usage Example

```typescript
import { MultiLayerCache } from '@/services/multi-layer-cache';
import { EdgeCacheAdapter } from '@/services/cache-adapters/edge-cache-adapter';
import { KVCacheAdapter } from '@/services/cache-adapters/kv-cache-adapter';
import { MemoryCacheAdapter } from '@/services/cache-adapters/memory-cache-adapter';

// Configure cache layers
const cache = new MultiLayerCache({
  layers: [
    new EdgeCacheAdapter({ baseUrl: 'https://cache.example.com' }),
    new KVCacheAdapter(kvNamespace, { prefix: 'app:' }),
    new MemoryCacheAdapter(),
  ],
  defaultTTL: 300, // 5 minutes
  populateUpperLayers: true, // Auto-populate faster layers
  logger: logger,
});

// Basic usage
const value = await cache.get('user:123');

// Cache-aside pattern
const user = await cache.getOrSet(
  'user:123',
  async () => {
    return await database.getUser(123);
  },
  { ttl: 3600, tags: ['users'] },
);

// Invalidation
await cache.delete('user:123');
await cache.invalidatePattern(/^user:.*/);
```

## Features

### 1. Automatic Layer Population

When a value is found in a lower layer, it's automatically copied to all upper layers for faster subsequent access:

```typescript
// First call - checks all layers, finds in database (L3)
const data = await cache.get('key'); // L1 miss, L2 miss, L3 hit

// Second call - found in edge cache (L1)
const data2 = await cache.get('key'); // L1 hit
```

### 2. Tag-Based Invalidation

```typescript
// Set with tags
await cache.set('product:123', product, {
  tags: ['products', 'category:electronics'],
});

// Invalidate all electronics
await cache.invalidateByTags(['category:electronics']);
```

### 3. Pattern-Based Invalidation

```typescript
// Invalidate all user cache entries
await cache.invalidatePattern(/^user:.*/);

// Invalidate specific patterns
await cache.invalidatePattern('session:*:2024-*');
```

### 4. Cache Statistics

```typescript
const stats = cache.getStats();
console.log({
  hitRate: (stats.hits / (stats.hits + stats.misses)) * 100,
  layerEfficiency: stats.layerHits,
});
```

### 5. Cache Warmup

```typescript
await cache.warmUp([
  {
    key: 'config:app',
    factory: () => loadAppConfig(),
    options: { ttl: 86400 },
  },
  {
    key: 'categories:all',
    factory: () => loadCategories(),
    options: { ttl: 3600, tags: ['categories'] },
  },
]);
```

## Cache Adapters

### EdgeCacheAdapter

Uses Cloudflare's Cache API for ultra-fast edge caching:

- Fastest response times
- Limited storage
- Best for frequently accessed data
- Automatic geographic distribution

### KVCacheAdapter

Uses Cloudflare KV or similar key-value stores:

- Fast global reads
- Larger storage capacity
- Best for semi-static data
- Supports metadata and tags

### MemoryCacheAdapter

In-memory caching for single instance:

- Fastest possible access
- Limited by instance memory
- Lost on restart
- Best for computation results

## TTL Strategies

### Dynamic TTL Based on Layer

```typescript
class SmartCache extends MultiLayerCache {
  protected populateUpperLayersAsync(
    missedLayers: Array<{ layer: CacheLayer; index: number }>,
    key: string,
    value: T,
  ): void {
    missedLayers.forEach(({ layer, index }) => {
      // Shorter TTL for upper layers
      const ttl = this.defaultTTL * (1 - index * 0.2);
      layer.set(key, value, { ttl });
    });
  }
}
```

### Time-Based TTL

```typescript
function calculateTTL(targetTime: Date): number {
  const now = new Date();
  const ttl = Math.floor((targetTime.getTime() - now.getTime()) / 1000);
  return Math.max(60, Math.min(86400, ttl)); // 1 min to 24 hours
}
```

## Performance Considerations

1. **Layer Ordering**: Place fastest layers first
2. **TTL Management**: Use shorter TTLs for upper layers
3. **Selective Population**: Only populate upper layers for frequently accessed data
4. **Batch Operations**: Use warmup for predictable access patterns
5. **Error Handling**: Failed layers don't block cache operations

## Integration with Wireframe

The multi-layer cache integrates seamlessly with Wireframe's architecture:

```typescript
import { PlatformContext } from '@/core/platform-context';
import { MultiLayerCache } from '@/services/multi-layer-cache';

export class CachedDataService {
  private cache: MultiLayerCache;

  constructor(private ctx: PlatformContext) {
    this.cache = new MultiLayerCache({
      layers: [
        new EdgeCacheAdapter({ logger: ctx.logger }),
        new KVCacheAdapter(ctx.platform.getKeyValueStore(), {
          prefix: `${ctx.config.name}:cache:`,
        }),
      ],
      logger: ctx.logger,
    });
  }

  async getData(key: string): Promise<Data> {
    return this.cache.getOrSet(key, async () => {
      return await this.fetchFromSource(key);
    });
  }
}
```

## Best Practices

1. **Cache Key Design**: Use hierarchical keys (e.g., `type:id:version`)
2. **Invalidation Strategy**: Prefer tags over individual key deletion
3. **Monitoring**: Track cache hit rates and adjust layer configuration
4. **Graceful Degradation**: Always handle cache failures gracefully
5. **Security**: Don't cache sensitive data in shared layers

## Migration from Single-Layer Cache

```typescript
// Before
const cache = new KVCache(kv);
const data = await cache.get(key);

// After
const cache = new MultiLayerCache({
  layers: [new KVCacheAdapter(kv)],
});
const data = await cache.get(key);
```

The multi-layer cache is backward compatible with single-layer usage while providing room for growth.
