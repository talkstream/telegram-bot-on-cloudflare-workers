# Performance Monitoring Pattern

This document describes the performance monitoring implementation that provides comprehensive tracking and analysis of application performance across different platforms and frameworks.

## Overview

The Performance Monitoring pattern allows you to track operation durations, identify bottlenecks, and analyze performance trends in your application. It's designed to be platform-agnostic and integrates easily with various web frameworks.

## Core Features

- **Operation Tracking**: Measure and record performance of any operation
- **Statistical Analysis**: Calculate percentiles, averages, and trends
- **Slow Operation Detection**: Automatic alerts for performance degradation
- **Framework Integration**: Ready-to-use middleware for popular frameworks
- **Memory Monitoring**: Track memory usage alongside performance
- **Scoped Monitoring**: Create isolated monitors for different components

## Basic Usage

```typescript
import { PerformanceMonitor } from '@/middleware/performance-monitor';

const monitor = new PerformanceMonitor({
  slowOperationThreshold: 1000, // 1 second
  verySlowOperationThreshold: 5000, // 5 seconds
  logger: console,
});

// Track an async operation
const result = await monitor.trackOperation(
  'database.query',
  async () => {
    return await db.query('SELECT * FROM users');
  },
  { query: 'SELECT * FROM users' },
);

// Get statistics
const stats = monitor.getStats('database.query');
console.log(`Average query time: ${stats.avgDuration}ms`);
console.log(`95th percentile: ${stats.p95}ms`);
```

## Timer API

For more granular control:

```typescript
const timer = monitor.startTimer();

// Do some work
await performComplexOperation();

const duration = timer.stop();
console.log(`Operation took ${duration}ms`);

// Or check elapsed time without stopping
const elapsed = timer.elapsed();
console.log(`Still running after ${elapsed}ms`);
```

## Framework Integration

### Express/Connect

```typescript
import { createExpressMiddleware } from '@/middleware/performance-http';

const app = express();
app.use(createExpressMiddleware(monitor));

// Stats endpoint
app.get('/stats', createStatsHandler(monitor));
```

### Hono (Cloudflare Workers)

```typescript
import { Hono } from 'hono';
import { createHonoMiddleware } from '@/middleware/performance-http';

const app = new Hono();
app.use('*', createHonoMiddleware(monitor));
```

### Koa

```typescript
import Koa from 'koa';
import { createKoaMiddleware } from '@/middleware/performance-http';

const app = new Koa();
app.use(createKoaMiddleware(monitor));
```

### Fastify

```typescript
import fastify from 'fastify';
import { createFastifyPlugin } from '@/middleware/performance-http';

const app = fastify();
app.register(createFastifyPlugin(monitor));
```

## Decorator Pattern

Use decorators for automatic method tracking:

```typescript
import { TrackPerformance } from '@/middleware/performance-monitor';

class UserService {
  @TrackPerformance()
  async getUser(id: string) {
    return await this.db.findUser(id);
  }

  @TrackPerformance('custom.findUsers')
  async findUsers(criteria: any) {
    return await this.db.query(criteria);
  }
}
```

## Scoped Monitoring

Create isolated monitors for different parts of your application:

```typescript
const apiMonitor = monitor.scope('api');
const dbMonitor = monitor.scope('database');

// Operations are prefixed
await apiMonitor.trackOperation('users.list', async () => {
  // This is tracked as "api.users.list"
});

// Get scoped stats
const apiStats = apiMonitor.getStats(); // Only api.* operations
```

## Custom Handlers

React to slow operations:

```typescript
const monitor = new PerformanceMonitor({
  slowOperationThreshold: 1000,
  onSlowOperation: async (metrics) => {
    // Send alert
    await alertService.notify({
      message: `Slow operation detected: ${metrics.operation}`,
      duration: metrics.duration,
      metadata: metrics.metadata,
    });

    // Log to external service
    await logger.error('Performance degradation', metrics);
  },
});
```

## Memory Monitoring

Track memory usage alongside performance:

```typescript
import { getMemoryMetrics } from '@/middleware/performance-http';

// In your monitoring routine
setInterval(() => {
  const memory = getMemoryMetrics();
  console.log(`Heap used: ${memory.heapUsed}MB`);
  console.log(`RSS: ${memory.rss}MB`);

  if (memory.heapUsed > 500) {
    console.warn('High memory usage detected');
  }
}, 60000);
```

## Statistical Analysis

The monitor provides comprehensive statistics:

```typescript
const stats = monitor.getStats('api.endpoint');

console.log({
  totalRequests: stats.count,
  successRate: (stats.successCount / stats.count) * 100,
  errorRate: (stats.errorCount / stats.count) * 100,
  performance: {
    average: stats.avgDuration,
    min: stats.minDuration,
    max: stats.maxDuration,
    median: stats.p50,
    p95: stats.p95,
    p99: stats.p99,
  },
});
```

## Export and Analysis

Export metrics for external analysis:

```typescript
// Export all metrics
const allMetrics = monitor.exportMetrics();

// Convert to format for analytics service
const analyticsData = Array.from(allMetrics.entries()).map(([operation, metrics]) => ({
  operation,
  metrics: metrics.map((m) => ({
    timestamp: m.timestamp,
    duration: m.duration,
    success: m.success,
  })),
}));

await analyticsService.ingest(analyticsData);
```

## Performance Budget

Set up performance budgets and alerts:

```typescript
class PerformanceBudgetMonitor {
  constructor(
    private monitor: PerformanceMonitor,
    private budgets: Map<string, number>,
  ) {}

  async check() {
    const violations = [];

    for (const [operation, budget] of this.budgets) {
      const stats = this.monitor.getStats(operation);
      if (stats && stats.p95 > budget) {
        violations.push({
          operation,
          budget,
          actual: stats.p95,
          severity: stats.p95 / budget,
        });
      }
    }

    return violations;
  }
}

// Usage
const budgetMonitor = new PerformanceBudgetMonitor(
  monitor,
  new Map([
    ['api.users.list', 200], // 200ms budget
    ['api.users.get', 100], // 100ms budget
    ['database.query', 50], // 50ms budget
  ]),
);

// Check periodically
setInterval(async () => {
  const violations = await budgetMonitor.check();
  if (violations.length > 0) {
    console.error('Performance budget violations:', violations);
  }
}, 60000);
```

## Integration with Wireframe

The performance monitor integrates seamlessly with Wireframe's architecture:

```typescript
import { PlatformContext } from '@/core/platform-context';
import { PerformanceMonitor } from '@/middleware/performance-monitor';

export class MonitoredService {
  private monitor: PerformanceMonitor;

  constructor(private ctx: PlatformContext) {
    this.monitor = new PerformanceMonitor({
      logger: ctx.logger,
      onSlowOperation: async (metrics) => {
        // Use platform's error reporting
        ctx.errorReporter?.report(new Error(`Slow operation: ${metrics.operation}`), {
          severity: 'warning',
          metadata: metrics,
        });
      },
    });
  }

  async processRequest(data: any) {
    return this.monitor.trackOperation(
      'request.process',
      async () => {
        // Your business logic
        return await this.handleData(data);
      },
      { requestId: ctx.requestId },
    );
  }
}
```

## Best Practices

1. **Operation Naming**: Use hierarchical names (e.g., `api.users.create`)
2. **Metadata**: Include relevant context without sensitive data
3. **Thresholds**: Set realistic thresholds based on your SLAs
4. **Sampling**: For high-traffic operations, consider sampling
5. **Cleanup**: Periodically clear old metrics to prevent memory growth

## Production Considerations

### High-Traffic Applications

```typescript
// Sample only 10% of requests
const shouldTrack = Math.random() < 0.1;

if (shouldTrack) {
  await monitor.trackOperation('high-traffic-op', operation);
} else {
  // Execute without tracking
  await operation();
}
```

### Long-Running Applications

```typescript
// Periodically reset metrics to prevent memory growth
setInterval(() => {
  const stats = monitor.getStats();

  // Save stats to persistent storage
  await saveStats(stats);

  // Clear old metrics
  monitor.clear();
}, 3600000); // Every hour
```

## Troubleshooting

### Common Issues

1. **Memory Growth**: Too many operations tracked
   - Solution: Reduce `maxMetricsPerOperation` or clear metrics periodically

2. **Performance Overhead**: Tracking itself becomes slow
   - Solution: Use sampling or disable in production

3. **Clock Drift**: Inconsistent timings
   - Solution: Use `performance.now()` instead of `Date.now()`

The performance monitoring pattern provides essential insights for maintaining and improving application performance across different deployment environments.
