# Performance Optimization Guide

This guide contains battle-tested performance optimizations from production deployments, particularly focused on Cloudflare Workers free tier constraints.

## Table of Contents

- [Overview](#overview)
- [Key Constraints](#key-constraints)
- [Implemented Optimizations](#implemented-optimizations)
- [Performance Patterns](#performance-patterns)
- [Benchmarks](#benchmarks)
- [Best Practices](#best-practices)
- [Monitoring](#monitoring)

## Overview

These optimizations were discovered and tested during the development of Kogotochki bot, a production Telegram bot with 100+ daily active users running on Cloudflare Workers free tier.

### Impact Summary

- **Response Time**: 3-5s → ~500ms (80%+ improvement)
- **Cold Start**: 30% faster
- **Memory Usage**: 40% reduction
- **Database Queries**: 70% reduction
- **Free Tier Viability**: Achieved < 10ms CPU time per request

## Key Constraints

### Cloudflare Workers Free Tier

- **CPU Time**: 10ms per request
- **Memory**: 128MB
- **Subrequests**: 50 per request
- **KV Operations**: 1000 reads/day, 100 writes/day
- **D1 Queries**: Limited quota

### Optimization Targets

1. Minimize initialization overhead
2. Reduce external service calls
3. Cache aggressively but smartly
4. Lazy load non-critical components

## Implemented Optimizations

### 1. CloudPlatform Singleton Pattern

**Location**: `/src/core/cloud/cloud-platform-cache.ts`

**Problem**: CloudPlatformFactory was being called 33 times per request

**Solution**: Global singleton cache

```typescript
import { getCloudPlatformConnector } from '@/core/cloud/cloud-platform-cache'

// Before: const platform = CloudPlatformFactory.createFromTypedEnv(env);
// After:
const platform = getCloudPlatformConnector(env)
```

**Impact**:

- Factory calls: 33 → 1 per request
- Response time improvement: ~2-3 seconds

### 2. KV Cache Layer

**Location**: `/src/lib/cache/kv-cache.ts`

**Problem**: Repeated database queries for same data

**Solution**: Universal caching layer with smart TTL

```typescript
import { KVCache } from '@/lib/cache'

const cache = new KVCache(env.CACHE)

// Cache user data for 30 minutes
const user = await cache.getOrSet(`user:${telegramId}`, () => db.getUserByTelegramId(telegramId), {
  ttl: 1800,
  namespace: 'users'
})
```

**Impact**:

- Database queries: -70%
- Response time: -200-300ms

### 3. Lazy Service Initialization

**Location**: `/src/patterns/lazy-services.ts` & `/src/core/services/service-container.ts`

**Problem**: All services initialized even when not needed

**Solution**: Initialize services only on first use

```typescript
import { LazyServiceContainer } from '@/patterns/lazy-services'
import { getRoleService, getAIConnector } from '@/core/services/service-container'

// Using the global container
const roleService = getRoleService() // Created only now
const aiConnector = getAIConnector() // Created only now

// Or create your own container
const container = new LazyServiceContainer<MyServices>()
container.register('analytics', () => new AnalyticsService(db))
const analytics = container.get('analytics') // Lazy init
```

**Impact**:

- Cold start: -30%
- Memory usage: -40%
- Services created only when accessed
- Perfect for master-only or rarely used services

### 4. Type-Safe Database Field Mapping

**Location**: `/contrib/patterns/002-database-field-mapping.md`

**Problem**: Runtime errors from snake_case/camelCase mismatches

**Solution**: Explicit field mapping with TypeScript

```typescript
interface UserRow {
  telegram_id: number
  created_at: string
}

interface User {
  telegramId: number
  createdAt: Date
}

function mapUser(row: UserRow): User {
  return {
    telegramId: row.telegram_id,
    createdAt: new Date(row.created_at)
  }
}
```

**Impact**: Prevented entire class of runtime errors

## Performance Patterns

### 1. Request Batching

Combine multiple operations into single requests:

```typescript
// Bad: Multiple sequential calls
const user = await getUser(id)
const settings = await getSettings(id)
const stats = await getStats(id)

// Good: Batch operation
const [user, settings, stats] = await Promise.all([getUser(id), getSettings(id), getStats(id)])
```

### 2. Smart TTL Strategies

Different data types need different cache durations:

```typescript
import { getTTLUntilEndOfDay, getShortTTL, getLongTTL } from '@/lib/cache'

// Daily data - cache until midnight
await cache.set('daily-winners', data, { ttl: getTTLUntilEndOfDay() })

// User sessions - medium TTL (30 min)
await cache.set(`session:${id}`, session, { ttl: 1800 })

// Static config - long TTL (24 hours)
await cache.set('app-config', config, { ttl: getLongTTL() })
```

### 3. Conditional Loading

Load heavy dependencies only when needed:

```typescript
// Bad: Always import heavy library
import { heavyLibrary } from 'heavy-library'

// Good: Dynamic import when needed
async function processComplexData(data: any) {
  const { heavyLibrary } = await import('heavy-library')
  return heavyLibrary.process(data)
}
```

## Benchmarks

### Response Time Improvements

| Operation    | Before | After | Improvement |
| ------------ | ------ | ----- | ----------- |
| User lookup  | 800ms  | 50ms  | 94%         |
| Daily stats  | 1200ms | 100ms | 92%         |
| Full request | 3-5s   | 500ms | 80%+        |

### Resource Usage

| Metric         | Before  | After  | Reduction |
| -------------- | ------- | ------ | --------- |
| CPU time/req   | 25-30ms | 8-10ms | 67%       |
| Memory peak    | 85MB    | 50MB   | 41%       |
| D1 queries/req | 12      | 3      | 75%       |

## Best Practices

### 1. Profile First

Always measure before optimizing:

```typescript
const start = performance.now()
// ... operation ...
const duration = performance.now() - start
console.log(`Operation took ${duration}ms`)
```

### 2. Cache Invalidation

Always invalidate cache after updates:

```typescript
async function updateUser(id: number, data: Partial<User>) {
  await db.updateUser(id, data)
  await cache.delete(`user:${id}`)
}
```

### 3. Error Resilience

Cache failures should not break functionality:

```typescript
async function getWithFallback<T>(key: string, fallback: () => Promise<T>): Promise<T> {
  try {
    const cached = await cache.get<T>(key)
    if (cached) return cached
  } catch (error) {
    console.error('Cache error:', error)
  }
  return fallback()
}
```

### 4. Monitor Cache Performance

Track cache hit rates:

```typescript
const stats = cache.getStats()
console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(2)}%`)
```

## Monitoring

### Key Metrics to Track

1. **Response Times**
   - P50, P95, P99 latencies
   - Cold start duration
   - Time to first byte

2. **Resource Usage**
   - CPU time per request
   - Memory consumption
   - Subrequest count

3. **Cache Performance**
   - Hit rate by namespace
   - Average TTL utilization
   - Invalidation frequency

4. **Error Rates**
   - Timeout errors
   - Memory limit errors
   - Rate limit violations

### Logging Strategy

```typescript
// Structured logging for analysis
logger.info('request_complete', {
  duration: performance.now() - start,
  cpu_time: env.CF?.cpu_time,
  cache_hits: cacheStats.hits,
  cache_misses: cacheStats.misses,
  db_queries: queryCount
})
```

## Free Tier Optimization Checklist

- [ ] CloudPlatform singleton implemented
- [ ] KV cache layer active
- [ ] Services use lazy initialization
- [ ] Database queries batched
- [ ] Response streaming enabled
- [ ] Heavy operations deferred
- [ ] Cache warming on cold start
- [ ] Monitoring in place

## Conclusion

These optimizations made it possible to run a production bot with 100+ daily active users on Cloudflare Workers free tier. The key is aggressive caching, lazy loading, and singleton patterns to minimize redundant work.

Remember: **The best optimization is the code that doesn't run.**
