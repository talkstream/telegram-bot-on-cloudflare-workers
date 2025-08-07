# Request-Scoped Cache Pattern

## Overview

The Request-Scoped Cache pattern eliminates duplicate database queries and API calls within a single request lifecycle. This pattern has been production-tested in the Kogotochki bot, achieving a **70% reduction in database queries** and **67% improvement in response time**.

## Problem

In complex request handlers, the same data is often needed in multiple places:

```typescript
// Without request cache - multiple identical queries
async function handleRequest(userId: string) {
  const user = await db.getUser(userId) // Query 1
  const permissions = await getPermissions(userId)
  // ... inside getPermissions:
  //   const user = await db.getUser(userId);    // Query 2 (duplicate!)

  const profile = await buildProfile(userId)
  // ... inside buildProfile:
  //   const user = await db.getUser(userId);    // Query 3 (duplicate!)

  // 3 identical database queries for the same data!
}
```

## Solution

Request-scoped caching ensures each unique query is executed only once per request:

```typescript
import { RequestCache } from '@/lib/cache/request-cache'

async function handleRequest(userId: string) {
  const cache = new RequestCache()

  // First call executes the query
  const user1 = await cache.getOrCompute('user:' + userId, () => db.getUser(userId))

  // Subsequent calls return cached value
  const user2 = await cache.getOrCompute(
    'user:' + userId,
    () => db.getUser(userId) // This won't execute!
  )

  // Only 1 database query executed
}
```

## Implementation

### Basic Usage

```typescript
import { RequestCache, RequestCacheFactory } from '@/lib/cache/request-cache'

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Create cache for this request
    const cache = RequestCacheFactory.create()

    // Use throughout request handling
    const user = await cache.getOrCompute('user:123', () =>
      env.DB.prepare('SELECT * FROM users WHERE id = ?').bind('123').first()
    )

    // Cache automatically cleaned up when request ends
    return new Response(JSON.stringify(user))
  }
}
```

### Service Integration

```typescript
class UserService {
  constructor(
    private db: D1Database,
    private cache: RequestCache
  ) {}

  async getUser(id: string) {
    return this.cache.getOrCompute(`user:${id}`, () =>
      this.db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first()
    )
  }

  async getUserWithPosts(id: string) {
    // Both queries are cached independently
    const [user, posts] = await Promise.all([
      this.getUser(id), // Might be cached
      this.cache.getOrCompute(`posts:user:${id}`, () =>
        this.db.prepare('SELECT * FROM posts WHERE user_id = ?').bind(id).all()
      )
    ])

    return { ...user, posts }
  }
}
```

### Decorator Pattern

```typescript
import { Cached } from '@/lib/cache/request-cache'

class UserRepository {
  @Cached('users')
  async findById(id: string) {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first()
  }

  @Cached('users')
  async findByEmail(email: string) {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()
  }
}
```

## Features

### Automatic Deduplication

Prevents duplicate operations even when called concurrently:

```typescript
// All three calls happen simultaneously
const [user1, user2, user3] = await Promise.all([
  cache.getOrCompute('user:123', fetchUser),
  cache.getOrCompute('user:123', fetchUser),
  cache.getOrCompute('user:123', fetchUser)
])

// Only ONE database query executed!
```

### Namespacing

Prevent key collisions between different domains:

```typescript
const userCache = RequestCacheFactory.createNamespaced('users')
const postCache = RequestCacheFactory.createNamespaced('posts')

// These won't conflict even with same ID
await userCache.getOrCompute('123', fetchUser)
await postCache.getOrCompute('123', fetchPost)
```

### TTL Support

For time-sensitive data:

```typescript
// Cache exchange rates for 5 minutes
const rate = await cache.getOrCompute(
  'usd:eur',
  fetchExchangeRate,
  5 * 60 * 1000 // TTL in milliseconds
)
```

### Performance Metrics

Track cache effectiveness:

```typescript
const stats = cache.getStats()
console.log('Cache performance:', {
  hits: stats.hits,
  misses: stats.misses,
  hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
  queriesSaved: stats.hits
})
```

## Production Results

From Kogotochki bot deployment on Cloudflare Workers:

### Before Request Cache

- Response time: 150ms average
- Database queries: 8-12 per request
- CPU time: 8-9ms (dangerously close to 10ms free tier limit)
- Memory usage: Higher due to duplicate data

### After Request Cache

- Response time: **50ms** (67% reduction)
- Database queries: **3-4** per request (70% reduction)
- CPU time: **3-4ms** (55% reduction)
- Memory usage: Lower due to data reuse

### Real Example

```typescript
// Telegram bot handler with multiple database lookups
async handleUpdate(update: TelegramUpdate) {
  const cache = new RequestCache();

  // Before: 12 queries for complex update
  // After: 4 queries (user, settings, permissions, state)

  const user = await cache.getOrCompute(`user:${update.from.id}`,
    () => this.userService.getUser(update.from.id)
  );

  // These all reuse the cached user
  await this.checkPermissions(user);  // No query!
  await this.loadUserSettings(user);  // No query!
  await this.validateSubscription(user); // No query!

  // Process update with all data already cached
}
```

## Best Practices

### 1. Create Early, Use Everywhere

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Create cache at request entry point
    const cache = new RequestCache()

    // Pass to all services
    const userService = new UserService(env.DB, cache)
    const authService = new AuthService(env.DB, cache)

    // Handle request...
  }
}
```

### 2. Consistent Key Patterns

```typescript
class CacheKeys {
  static user = (id: string) => `user:${id}`
  static userByEmail = (email: string) => `user:email:${email}`
  static userPosts = (userId: string) => `posts:user:${userId}`
  static userPermissions = (userId: string) => `permissions:user:${userId}`
}

// Usage
await cache.getOrCompute(CacheKeys.user(userId), () => fetchUser(userId))
```

### 3. Separate Caches for Different Concerns

```typescript
class RequestContext {
  readonly entityCache = RequestCacheFactory.createNamespaced('entities')
  readonly permissionCache = RequestCacheFactory.createNamespaced('permissions')
  readonly configCache = RequestCacheFactory.createNamespaced('config')
}
```

### 4. Don't Cache Mutations

```typescript
// ❌ Don't cache write operations
await cache.getOrCompute('update', () => db.prepare('UPDATE users SET ...').run())

// ✅ Only cache reads
await cache.getOrCompute('user:123', () =>
  db.prepare('SELECT * FROM users WHERE id = ?').bind('123').first()
)

// ✅ Clear cache after mutations
await updateUser(userId, data)
cache.delete(`user:${userId}`)
```

## When to Use

✅ **Perfect for:**

- Database queries within single request
- API calls to external services
- Expensive computations
- Telegram bot handlers
- GraphQL resolvers
- REST API endpoints

❌ **Not suitable for:**

- Cross-request caching (use KV or Cache API)
- Long-term storage (use database)
- Session data (use KV storage)
- Real-time data that changes frequently

## Testing

```typescript
import { describe, it, expect, vi } from 'vitest'
import { RequestCache } from '@/lib/cache/request-cache'

describe('UserService with caching', () => {
  it('should cache database queries', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ id: '123', name: 'Test' })
        })
      })
    }

    const cache = new RequestCache()
    const service = new UserService(mockDb, cache)

    // Call twice
    await service.getUser('123')
    await service.getUser('123')

    // Database should only be queried once
    expect(mockDb.prepare).toHaveBeenCalledTimes(1)
  })
})
```

## Migration Guide

### From No Caching

```typescript
// Before
class UserService {
  async getUser(id: string) {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first()
  }
}

// After
class UserService {
  constructor(
    private db: D1Database,
    private cache: RequestCache
  ) {}

  async getUser(id: string) {
    return this.cache.getOrCompute(`user:${id}`, () =>
      this.db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first()
    )
  }
}
```

### From Global Cache

```typescript
// Before - global cache persists between requests
const globalCache = new Map()

// After - request-scoped cache
export default {
  async fetch(request: Request, env: Env) {
    const cache = new RequestCache() // Fresh for each request
    // ...
  }
}
```

## Performance Tips

1. **Enable debug mode in development** to see cache hits/misses
2. **Monitor cache stats** to identify optimization opportunities
3. **Use consistent keys** to maximize cache reuse
4. **Clear after mutations** to prevent stale data
5. **Namespace by domain** to prevent key collisions

## Summary

The Request-Scoped Cache pattern is essential for production applications on Cloudflare Workers, especially on the free tier with its 10ms CPU limit. With zero configuration and immediate benefits, it's one of the highest-impact optimizations you can make.
