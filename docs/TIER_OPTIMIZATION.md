# Tier-based Optimization System

The wireframe platform includes a sophisticated tier-based optimization system that automatically adapts to Cloudflare's different plan limits, ensuring optimal performance regardless of your subscription level.

## Overview

Cloudflare Workers have different resource limits based on your plan:

- **Free Plan**: 10ms CPU, limited subrequests, basic features
- **Paid Plan** ($5/month): 30s CPU, more subrequests, advanced features
- **Enterprise Plan**: Higher limits, premium features

This optimization system automatically detects your tier and applies appropriate optimizations to maximize performance within your plan's constraints.

## Features

- **Automatic Tier Detection**: Detects your Cloudflare plan automatically
- **Resource Tracking**: Monitors CPU, memory, and API usage in real-time
- **Dynamic Optimization**: Applies strategies based on current resource usage
- **Graceful Degradation**: Maintains functionality when approaching limits
- **Smart Recommendations**: Provides actionable insights for optimization

## Basic Usage

### Middleware Integration

```typescript
import { createTierOptimizer } from '@/middleware/tier-optimizer';
import { EdgeCacheService } from '@/core/services/edge-cache';

const app = new Hono();

// Initialize with auto-detection
app.use(
  '*',
  createTierOptimizer({
    cacheService: new EdgeCacheService(),
    debug: true, // Enable debug headers
  }),
);

// Or specify tier explicitly
app.use(
  '*',
  createTierOptimizer({
    tier: 'free',
    config: {
      aggressive: true, // Enable aggressive optimizations
    },
  }),
);
```

### Manual Usage

```typescript
import { TierOptimizationService } from '@/core/services/tier-optimization';

const optimizer = new TierOptimizationService('free', {
  cache: {
    enabled: true,
    ttl: 600, // 10 minutes for free tier
  },
  batching: {
    enabled: true,
    size: 5, // Smaller batches for free tier
  },
});

// Track usage
optimizer.trackUsage('cpuTime', 5);
optimizer.trackOperation('kv', 'read', 10);

// Check limits
if (!optimizer.isWithinLimits()) {
  console.warn('Approaching resource limits!');
}

// Get recommendations
const recommendations = optimizer.getRecommendations();
```

## Optimization Strategies

### 1. Cache Optimization

Automatically adjusts cache TTL based on tier:

```typescript
// Free tier: Aggressive caching
cache.ttl = 600; // 10 minutes
cache.swr = 7200; // 2 hours

// Paid tier: Balanced caching
cache.ttl = 300; // 5 minutes
cache.swr = 3600; // 1 hour
```

### 2. Request Batching

Batches multiple operations to reduce overhead:

```typescript
// Automatically enabled when approaching subrequest limits
const results = await optimizedBatch(
  ctx,
  items,
  async (batch) => processItems(batch),
  10, // Default batch size
);
```

### 3. Query Simplification

Reduces query complexity for free tier:

```typescript
// Free tier: Max complexity 50
// Paid tier: Max complexity 100
// Enterprise: No limit
```

### 4. Early Termination

Stops processing when approaching CPU limits:

```typescript
// Defers non-critical operations
if (cpuUsage > 80%) {
  utils.defer(() => backgroundTask());
}
```

### 5. Graceful Degradation

Reduces functionality to stay within limits:

```typescript
// Returns simplified responses for free tier
return createTieredResponse(ctx, fullData, {
  fullDataTiers: ['paid', 'enterprise'],
  summaryFields: ['id', 'name', 'status'],
});
```

## Helper Functions

### Optimized Cache

```typescript
import { optimizedCache } from '@/middleware/tier-optimizer';

// Automatically adjusts cache times based on tier
const data = await optimizedCache(
  ctx,
  'cache-key',
  async () => fetchExpensiveData(),
  { ttl: 300 }, // Base TTL, adjusted by tier
);
```

### Optimized Batch Processing

```typescript
import { optimizedBatch } from '@/middleware/tier-optimizer';

// Automatically adjusts batch size based on tier and resources
const results = await optimizedBatch(ctx, largeDataset, async (batch) => {
  // Process batch
  return batch.map((item) => transform(item));
});
```

### Tiered Responses

```typescript
import { createTieredResponse } from '@/middleware/tier-optimizer';

// Returns different data based on tier
app.get('/api/data', async (c) => {
  const fullData = await fetchAllData();

  return createTieredResponse(c, fullData, {
    fullDataTiers: ['paid', 'enterprise'],
    summaryFields: ['id', 'name', 'created'],
  });
});
```

## Resource Tracking

### CPU Time

```typescript
const { result, cpuTime } = await utils.measureCPU(async () => {
  return expensiveOperation();
});

console.log(`Operation took ${cpuTime}ms`);
```

### KV Operations

```typescript
// Automatically tracked by middleware
const value = await kv.get('key');
optimizer.trackOperation('kv', 'read');

// Batch KV operations
const values = await Promise.all(keys.map((key) => kv.get(key)));
optimizer.trackOperation('kv', 'read', keys.length);
```

### Memory Usage

```typescript
optimizer.trackUsage('memory', process.memoryUsage().heapUsed / 1024 / 1024);
```

## Recommendations System

The system provides actionable recommendations:

```typescript
const recommendations = optimizer.getRecommendations();

recommendations.forEach((rec) => {
  console.log(`[${rec.type}] ${rec.category}: ${rec.message}`);
  if (rec.action) {
    console.log(`  Action: ${rec.action}`);
  }
});
```

Example recommendations:

```json
{
  "type": "critical",
  "category": "cpu",
  "message": "High CPU usage detected",
  "description": "CPU usage is at 85% of the limit",
  "impact": 9,
  "action": "Consider upgrading to paid plan for 3000x more CPU time",
  "metrics": {
    "cpuTime": 8.5,
    "limit": 10
  }
}
```

## Configuration Options

### Full Configuration

```typescript
const config: IOptimizationConfig = {
  enabled: true,
  aggressive: false, // Set true for maximum optimization

  cache: {
    enabled: true,
    ttl: 300, // Base TTL in seconds
    swr: 3600, // Stale-while-revalidate
  },

  batching: {
    enabled: true,
    size: 10, // Items per batch
    timeout: 100, // Batch timeout in ms
  },

  compression: {
    enabled: true,
    threshold: 1024, // Min size for compression
  },

  queries: {
    cache: true,
    batch: true,
    maxComplexity: 100,
  },
};
```

### Custom Strategies

```typescript
const customStrategy: IOptimizationStrategy = {
  name: 'custom-image-optimization',
  description: 'Optimize image processing for tier',
  priority: 10,

  shouldApply: (context) => {
    return context.tier === 'free' && context.request?.path.includes('/images');
  },

  apply: (context) => {
    // Reduce image quality for free tier
    context.config.imageQuality = context.tier === 'free' ? 70 : 90;
  },
};

// Register custom strategy
const optimizer = createTierOptimizer({
  strategies: [customStrategy],
});
```

## Best Practices

### 1. Early Detection

Detect tier early in the request lifecycle:

```typescript
app.use(
  '*',
  createTierOptimizer({
    detectTier: (c) => {
      // Custom tier detection logic
      if (c.env.PREMIUM_FEATURES) return 'enterprise';
      if (c.env.QUEUES) return 'paid';
      return 'free';
    },
  }),
);
```

### 2. Progressive Enhancement

Build features that work on all tiers:

```typescript
// Base functionality for all tiers
const baseData = await getEssentialData();

// Enhanced data for higher tiers
if (tier !== 'free') {
  const extraData = await getEnhancedData();
  return { ...baseData, ...extraData };
}

return baseData;
```

### 3. Resource Budgeting

Allocate resources wisely:

```typescript
const remaining = utils.getRemainingResources();

if (remaining.cpuTime > 5) {
  // Enough time for complex operation
  await complexOperation();
} else {
  // Use cached or simplified result
  return cachedResult;
}
```

### 4. Monitoring

Track optimization effectiveness:

```typescript
app.use(
  '*',
  createTierOptimizer({
    eventBus,
    debug: true,
  }),
);

eventBus.on('optimization:applied', (event) => {
  analytics.track('optimization', {
    strategy: event.strategy,
    tier: event.tier,
  });
});
```

### 5. Testing

Test with different tier limits:

```typescript
describe('API endpoints', () => {
  it('should work within free tier limits', async () => {
    const optimizer = new TierOptimizationService('free');

    // Test with free tier constraints
    const response = await app.request('/api/data');

    expect(optimizer.isWithinLimits()).toBe(true);
  });
});
```

## Migration Guide

### From Unoptimized Code

Before:

```typescript
// Unoptimized - may exceed free tier limits
app.get('/api/users', async (c) => {
  const users = await db.select().from('users').all();
  const enriched = await Promise.all(users.map((user) => enrichUserData(user)));
  return c.json(enriched);
});
```

After:

```typescript
// Optimized for tier limits
app.get('/api/users', async (c) => {
  const optimizer = getOptimizationService(c);

  // Use cache for free tier
  const users = await optimizedCache(c, 'users-list', async () => {
    return db.select().from('users').limit(100).all();
  });

  // Batch enrichment
  const enriched = await optimizedBatch(c, users, async (batch) => {
    return Promise.all(batch.map((user) => enrichUserData(user)));
  });

  // Return tiered response
  return createTieredResponse(c, enriched, {
    summaryFields: ['id', 'name', 'email'],
  });
});
```

## Troubleshooting

### Common Issues

1. **"CPU limit exceeded" errors**
   - Enable aggressive optimizations
   - Reduce batch sizes
   - Use more caching
   - Consider upgrading tier

2. **Slow responses on free tier**
   - Normal due to CPU limits
   - Optimize critical paths
   - Pre-compute when possible

3. **Recommendations not applied**
   - Check if optimizations are enabled
   - Verify strategy conditions
   - Review debug logs

### Debug Headers

Enable debug mode to see optimization details:

```
X-Tier: free
X-CPU-Usage: 8.5/10ms
X-Memory-Usage: 45.2/128MB
X-Optimization-Count: 3
```

### Monitoring

Use the event bus for detailed monitoring:

```typescript
eventBus.on('optimization:*', (event) => {
  console.log('Optimization event:', event);
});
```
