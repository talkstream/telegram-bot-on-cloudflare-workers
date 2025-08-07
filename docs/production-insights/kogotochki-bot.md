# Production Insights: Kogotochki Bot

## Context

- **Bot Type**: Telegram lottery/auction bot for nail salon services
- **Scale**: 100+ daily active users
- **Tier**: Cloudflare Workers Free Tier
- **Database**: Cloudflare D1
- **Cache**: Cloudflare KV
- **Development Period**: January 2025

## Recent Production Fixes

### 5. Critical Bug: Database Field Name Mismatch

**Problem**: "My Services" button stopped working after providers added services. Investigation revealed that database queries returned snake_case fields (e.g., `provider_id`) but TypeScript code expected camelCase (`providerId`), causing undefined values.

**Solution**: Implemented comprehensive field mapping (see contrib/patterns/003-database-field-mapping.md):

```typescript
// Before: Silent failure
const services = await db.query<Service>(`SELECT * FROM services`)
console.log(services[0].providerId) // undefined!

// After: Type-safe mapping
const services = await db.query<ServiceDatabaseRow>(`SELECT * FROM services`)
return services.map(row => ({
  providerId: row.provider_id
  // ... explicit mapping
}))
```

**Impact**: Fixed critical user-facing bug and prevented entire class of runtime errors.

## Key Challenges & Solutions

### 1. Performance: CloudPlatformFactory Singleton Pattern

**Problem**: Response times were 3-5 seconds due to `CloudPlatformFactory.createFromTypedEnv()` being called 33 times per request.

**Solution**: Implemented global singleton cache:

```typescript
// src/core/cloud/cloud-platform-cache.ts
const connectorCache = new Map<string, ICloudPlatformConnector>()

export function getCloudPlatformConnector(env: Env): ICloudPlatformConnector {
  const key = getCacheKey(env)

  const cached = connectorCache.get(key)
  if (cached) {
    return cached
  }

  const connector = CloudPlatformFactory.createFromTypedEnv(env)
  connectorCache.set(key, connector)

  return connector
}
```

**Impact**:

- Response time: 3-5s → ~500ms (80%+ improvement)
- Factory calls: 33 → 1 per request
- Critical for free tier 10ms CPU limit

### 2. Pattern: Universal KV Cache Layer

**Problem**: Repeated database queries for user data, regions, and daily winners.

**Solution**: Reusable cache layer with smart TTL:

```typescript
export class KVCache {
  async getOrSet<T>(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T> {
    const cached = await this.get<T>(key, options?.namespace)
    if (cached !== null) return cached

    const value = await factory()
    await this.set(key, value, options)
    return value
  }
}

// Cached service pattern
export class CachedUserService extends UserService {
  override async getUserByTelegramId(telegramId: number): Promise<User | null> {
    return this.cache.getOrSet(
      CacheKeys.user(telegramId),
      () => super.getUserByTelegramId(telegramId),
      { ttl: 300 } // 5 minutes
    )
  }
}
```

**Smart TTL for daily data**:

```typescript
const now = new Date()
const endOfDay = new Date(now)
endOfDay.setHours(23, 59, 59, 999)
const ttl = Math.floor((endOfDay.getTime() - now.getTime()) / 1000)
```

**Impact**:

- Database queries: -70%
- Response time: Additional 200-300ms improvement
- Edge-optimized with KV

### 3. Pattern: Type-Safe Database Field Mapping

**Problem**: Critical data loss - user's region_id was lost after selection due to snake_case/camelCase mismatch.

**Solution**: Explicit database row types:

```typescript
// Database row type (matches actual DB schema)
export interface UserDatabaseRow {
  telegram_id: number;
  username?: string;
  region_id?: string;
  is_active: number; // 0 or 1
  created_at: string;
}

// Service with explicit mapping
async getUserByTelegramId(telegramId: number): Promise<User | null> {
  const result = await this.db
    .prepare('SELECT * FROM users WHERE telegram_id = ?')
    .bind(telegramId)
    .first<UserDatabaseRow>();

  if (!result) return null;

  // Type-safe mapping
  return {
    telegramId: result.telegram_id,
    regionId: result.region_id,
    isActive: result.is_active === 1,
    createdAt: new Date(result.created_at),
  };
}
```

**Impact**:

- Fixed critical data loss bug
- Full TypeScript strict mode compliance
- Zero runtime field mapping errors

### 4. Pattern: Lazy Service Initialization

**Problem**: Services initialized even when not needed, wasting memory on free tier.

**Solution**: Lazy initialization with global service holder:

```typescript
const services: ServiceInstances = {
  userService: null,
  locationService: null
  // ...
}

function ensureServicesInitialized(): void {
  if (!services.userService) {
    const kvCache = services.env?.CACHE
    services.userService = kvCache
      ? new CachedUserService(services.dbStore, kvCache)
      : new UserService(services.dbStore)
  }
  // ... other services
}

export function getUserService(): UserService {
  ensureServicesInitialized()
  if (!services.userService) {
    throw new Error('UserService not initialized')
  }
  return services.userService
}
```

**Impact**:

- Reduced memory usage
- Faster cold starts
- Services created only when accessed

## Recommendations for Wireframe

### 1. Include CloudPlatform Caching by Default

The singleton pattern should be built into the framework:

```typescript
// Proposed addition to core/cloud/index.ts
export function getCachedCloudPlatform(env: Env): ICloudPlatformConnector {
  return getCloudPlatformConnector(env)
}
```

### 2. Provide KV Cache Abstraction

The KV cache pattern is universal and should be in core:

```typescript
// Proposed: core/cache/kv-cache.ts
export class KVCache {
  /* ... */
}
export class CachedService<T> {
  /* ... */
}
```

### 3. Database Type Mapping Guidelines

Add to documentation:

- Always create `DatabaseRow` types
- Use explicit field mapping
- Handle D1-specific types (0/1 booleans)
- Never use type assertions

### 4. Service Initialization Best Practices

Document lazy initialization pattern for resource-constrained environments.

## Lessons Learned

1. **Free Tier Constraints Drive Innovation**: The 10ms CPU limit forced us to optimize aggressively
2. **Type Safety Prevents Runtime Errors**: Explicit mapping caught issues TypeScript alone missed
3. **Caching is Essential**: Not optional for production bots
4. **Measure Everything**: We tracked factory calls, query counts, response times

## Production Metrics

- **Daily Active Users**: 100+
- **Average Response Time**: ~500ms (from 3-5s)
- **Error Rate**: <0.1%
- **Uptime**: 99.9%
- **Free Tier CPU Usage**: ~7ms average (under 10ms limit)

## Code References

All patterns implemented in Kogotochki bot:

- Repository: https://github.com/nafigator/kogotochki
- CloudPlatform Cache: `src/core/cloud/cloud-platform-cache.ts`
- KV Cache: `src/lib/cache/kv-cache.ts`
- Database Types: `src/types/database.ts`
- Cached Services: `src/connectors/messaging/telegram/services/cached-services.ts`

These patterns have been battle-tested in production and significantly improved both performance and reliability.
