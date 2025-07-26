# Edge Cache Service

The Edge Cache Service provides ultra-fast caching at the edge using Cloudflare's Cache API. This service is designed for paid Cloudflare Workers tiers and can significantly improve your application's performance.

## Features

- **Sub-10ms cache access** - Leverage Cloudflare's global edge network
- **Automatic cache invalidation** - Expire content based on TTL
- **Tag-based purging** - Invalidate groups of related content
- **Response caching** - Cache entire HTTP responses
- **Cache warming** - Pre-populate cache with frequently accessed data
- **Type-safe API** - Full TypeScript support with no `any` types

## Installation

The Edge Cache Service is included in the Wireframe platform. No additional installation required.

## Basic Usage

### 1. Using the Cache Service Directly

```typescript
import { EdgeCacheService } from '@/core/services/cache/edge-cache-service';

// Initialize the service
const cacheService = new EdgeCacheService({
  baseUrl: 'https://cache.myapp.internal',
  logger: console,
});

// Store a value
await cacheService.set('user:123', userData, {
  ttl: 300, // 5 minutes
  tags: ['users', 'profile'],
});

// Retrieve a value
const cached = await cacheService.get('user:123');

// Use cache-aside pattern
const user = await cacheService.getOrSet(
  'user:123',
  async () => {
    // This function is only called on cache miss
    return await fetchUserFromDatabase(123);
  },
  { ttl: 300, tags: ['users'] },
);
```

### 2. Using the Middleware

```typescript
import { Hono } from 'hono';
import { edgeCache } from '@/middleware/edge-cache';

const app = new Hono();

// Apply edge cache middleware
app.use(
  '*',
  edgeCache({
    routeConfig: {
      '/api/static': { ttl: 86400, tags: ['static'] }, // 24 hours
      '/api/users': { ttl: 300, tags: ['users'] }, // 5 minutes
      '/api/auth': { ttl: 0, tags: [] }, // No cache
    },
  }),
);

// Your routes
app.get('/api/users', async (c) => {
  // This response will be automatically cached
  return c.json(await getUsers());
});
```

## Advanced Features

### Custom Cache Keys

Generate consistent cache keys for complex queries:

```typescript
import { generateCacheKey } from '@/core/services/cache/edge-cache-service';

// Generates: "api:users:active:true:page:2:sort:name"
const key = generateCacheKey('api:users', {
  page: 2,
  sort: 'name',
  active: true,
});
```

### Response Caching

Cache HTTP responses for even faster performance:

```typescript
// Cache a response
await cacheService.cacheResponse(request, response, {
  ttl: 600,
  tags: ['api', 'products'],
  browserTTL: 60, // Browser caches for 1 minute
  edgeTTL: 600, // Edge caches for 10 minutes
});

// Retrieve cached response
const cachedResponse = await cacheService.getCachedResponse(request);
if (cachedResponse) {
  return cachedResponse;
}
```

### Cache Invalidation

Invalidate cache entries by tags:

```typescript
// Invalidate all user-related cache entries
await cacheService.purgeByTags(['users']);

// Delete specific cache key
await cacheService.delete('user:123');
```

### Cache Warming

Pre-populate cache with frequently accessed data:

```typescript
await cacheService.warmUp([
  {
    key: 'config',
    factory: async () => await loadConfig(),
    options: { ttl: 3600, tags: ['config'] },
  },
  {
    key: 'popular-products',
    factory: async () => await getPopularProducts(),
    options: { ttl: 600, tags: ['products'] },
  },
]);
```

## Middleware Configuration

### Route-Based Caching

Configure different cache settings for different routes:

```typescript
const cacheConfig = {
  // Static assets - long cache
  '/assets': { ttl: 86400 * 7, tags: ['assets'] }, // 1 week
  '/api/config': { ttl: 3600, tags: ['config'] }, // 1 hour

  // Dynamic content - shorter cache
  '/api/feed': { ttl: 60, tags: ['feed'] }, // 1 minute

  // No cache
  '/api/auth': { ttl: 0, tags: [] },
  '/webhooks': { ttl: 0, tags: [] },
};

app.use('*', edgeCache({ routeConfig: cacheConfig }));
```

### Custom Key Generator

Customize how cache keys are generated:

```typescript
app.use(
  '*',
  edgeCache({
    keyGenerator: (c) => {
      // Include user ID in cache key for personalized content
      const userId = c.get('userId');
      const url = new URL(c.req.url);
      return `${userId}:${url.pathname}:${url.search}`;
    },
  }),
);
```

### Cache Management Endpoints

Add endpoints for cache management:

```typescript
import { cacheInvalidator } from '@/middleware/edge-cache';

// Add cache invalidation endpoint
app.post('/admin/cache/invalidate', cacheInvalidator(cacheService));

// Usage:
// POST /admin/cache/invalidate
// Body: { "tags": ["users", "posts"] }
// or
// Body: { "keys": ["user:123", "post:456"] }
```

## Performance Tips

1. **Use appropriate TTLs**
   - Static content: 24 hours to 1 week
   - Semi-dynamic content: 5-15 minutes
   - Real-time data: 30-60 seconds

2. **Leverage tags for invalidation**
   - Group related content with tags
   - Invalidate entire categories at once

3. **Warm critical paths**
   - Pre-populate cache on deployment
   - Warm up after cache invalidation

4. **Monitor cache performance**
   - Check `X-Cache-Status` header (HIT/MISS)
   - Track cache hit rates
   - Monitor response times

## Platform Support

The Edge Cache Service is optimized for:

- **Cloudflare Workers** (Paid tier) - Full support
- **AWS Lambda** - Requires CloudFront integration
- **Node.js** - In-memory cache fallback

## Limitations

- Tag-based purging requires Cloudflare API configuration
- Maximum cache size depends on your Cloudflare plan
- Cache is region-specific (not globally synchronized)

## Example Application

See [examples/edge-cache-example.ts](../examples/edge-cache-example.ts) for a complete working example.

## Best Practices

1. **Always set appropriate cache headers**

   ```typescript
   {
     ttl: 300,           // Server-side cache
     browserTTL: 60,     // Client-side cache
     edgeTTL: 300,       // CDN cache
   }
   ```

2. **Use cache for expensive operations**
   - Database queries
   - API calls
   - Complex calculations

3. **Implement cache aside pattern**

   ```typescript
   const data = await cache.getOrSet(key, () => expensiveOperation(), { ttl: 600 });
   ```

4. **Handle cache failures gracefully**
   - Cache should never break your application
   - Always have fallback to source data

## Troubleshooting

### Cache not working

1. Check if you're on Cloudflare Workers paid tier
2. Verify cache headers in response
3. Check `X-Cache-Status` header
4. Ensure TTL > 0 for cached routes

### High cache miss rate

1. Review cache keys for consistency
2. Check if TTL is too short
3. Verify cache warming is working
4. Monitor for cache invalidation storms

### Performance issues

1. Use browser cache for static assets
2. Implement cache warming
3. Review cache key generation efficiency
4. Consider increasing TTLs

## Contributing

The Edge Cache Service is production-tested in the Kogotochki bot project. Contributions and improvements are welcome!
