# Performance: CloudPlatform Singleton Pattern

## Problem

In production with Kogotochki bot, we discovered `CloudPlatformFactory.createFromTypedEnv()` was being called 33 times per request, causing:

- 3-5 second response times
- Excessive object instantiation
- Multiple database connection setups
- Poor performance on Cloudflare Workers free tier

## Solution

```typescript
// File: src/core/cloud/cloud-platform-cache.ts
import type { ICloudPlatformConnector } from './interfaces'
import type { Env } from '../../config/env'
import { CloudPlatformFactory } from './cloud-platform-factory'

const connectorCache = new Map<string, ICloudPlatformConnector>()

function getCacheKey(env: Env): string {
  // Create unique key based on platform and environment
  return `${env.PLATFORM || 'cloudflare'}_${env.ENVIRONMENT || 'production'}`
}

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

// Clear cache function for testing
export function clearCloudPlatformCache(): void {
  connectorCache.clear()
}
```

## Implementation Guide

1. Replace all direct factory calls:

```typescript
// Before
const platform = CloudPlatformFactory.createFromTypedEnv(env)

// After
import { getCloudPlatformConnector } from './core/cloud/cloud-platform-cache'
const platform = getCloudPlatformConnector(env)
```

2. Update connectors to use cached instance:

```typescript
// In telegram-connector.ts
const cloudConnector = getCloudPlatformConnector(telegramConfig.env)
```

## Test Coverage

```typescript
// File: src/core/cloud/__tests__/cloud-platform-cache.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { getCloudPlatformConnector, clearCloudPlatformCache } from '../cloud-platform-cache'
import { CloudPlatformFactory } from '../cloud-platform-factory'

describe('CloudPlatform Cache', () => {
  beforeEach(() => {
    clearCloudPlatformCache()
  })

  it('should return same instance for same environment', () => {
    const env = { PLATFORM: 'cloudflare', DB: {} }

    const instance1 = getCloudPlatformConnector(env)
    const instance2 = getCloudPlatformConnector(env)

    expect(instance1).toBe(instance2)
  })

  it('should return different instances for different environments', () => {
    const env1 = { PLATFORM: 'cloudflare', ENVIRONMENT: 'dev' }
    const env2 = { PLATFORM: 'cloudflare', ENVIRONMENT: 'prod' }

    const instance1 = getCloudPlatformConnector(env1)
    const instance2 = getCloudPlatformConnector(env2)

    expect(instance1).not.toBe(instance2)
  })

  it('should call factory only once per environment', () => {
    const spy = vi.spyOn(CloudPlatformFactory, 'createFromTypedEnv')
    const env = { PLATFORM: 'cloudflare' }

    getCloudPlatformConnector(env)
    getCloudPlatformConnector(env)
    getCloudPlatformConnector(env)

    expect(spy).toHaveBeenCalledTimes(1)
  })
})
```

## Production Impact

Measured in Kogotochki bot production:

- **Response time**: 3-5s → ~500ms (80%+ improvement)
- **Factory calls**: 33 → 1 per request
- **Memory usage**: Significantly reduced
- **Free tier CPU**: Now fits within 10ms limit

## Why This Matters

1. **Free Tier Viability**: Makes bots feasible on Cloudflare Workers free tier
2. **User Experience**: Sub-second responses instead of multi-second waits
3. **Scalability**: Reduced resource usage allows more concurrent users
4. **Cost Efficiency**: Lower CPU time = lower costs on paid tiers

## Integration Checklist

- [ ] Add `cloud-platform-cache.ts` to core/cloud
- [ ] Update all factory usage to use cache
- [ ] Add tests
- [ ] Update documentation
- [ ] Consider making this the default behavior
