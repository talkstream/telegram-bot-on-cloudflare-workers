# Performance Monitoring System

The Performance Monitoring System provides comprehensive metrics collection and reporting for your Cloudflare Workers applications. It tracks request latencies, error rates, and custom metrics with minimal overhead.

## Features

- **Request Metrics** - Automatic tracking of HTTP request duration, status codes, and errors
- **Custom Metrics** - Support for counters, gauges, histograms, and timings
- **Multiple Providers** - Send metrics to Cloudflare Analytics, StatsD, or custom backends
- **Tag-based Filtering** - Add custom tags to metrics for detailed analysis
- **Sampling Control** - Reduce overhead with configurable sampling rates
- **Zero Dependencies** - Built specifically for Cloudflare Workers environment

## Quick Start

### Basic Usage

```typescript
import { Hono } from 'hono';
import { performanceMonitoring } from '@/middleware/performance';

const app = new Hono();

// Add performance monitoring middleware
app.use('*', performanceMonitoring());

// Your routes
app.get('/api/users', async (c) => {
  // Automatically tracked!
  return c.json({ users: [] });
});
```

### Custom Configuration

```typescript
import {
  PerformanceMonitor,
  CloudflareAnalyticsProvider,
} from '@/core/services/performance-monitor';

// Create monitor with Cloudflare Analytics
const monitor = new PerformanceMonitor({
  providers: [
    new CloudflareAnalyticsProvider(
      process.env.CF_ACCOUNT_ID,
      process.env.CF_API_TOKEN,
      'my-app-metrics',
    ),
  ],
  defaultTags: {
    app: 'my-app',
    environment: process.env.ENVIRONMENT,
  },
  flushInterval: 5000, // 5 seconds
});

// Use in middleware
app.use(
  '*',
  performanceMonitoring({
    monitor,
    detailed: true, // Enable detailed metrics
    sampleRate: 0.1, // Sample 10% of requests
    skipPaths: ['/health', '/metrics'],
  }),
);
```

## Metric Types

### Counters

Track occurrences of events:

```typescript
monitor.increment('api.calls', 1, { endpoint: '/users' });
monitor.increment('errors.validation', 1, { field: 'email' });
```

### Gauges

Track current values:

```typescript
monitor.gauge('queue.size', queue.length);
monitor.gauge('memory.usage', process.memoryUsage().heapUsed);
```

### Timings

Track durations:

```typescript
const timer = monitor.startTimer('db.query', { table: 'users' });
const results = await db.query('SELECT * FROM users');
timer.end({ rows: results.length });

// Or manually:
monitor.timing('external.api.call', 235, { service: 'payment' });
```

### Histograms

Track value distributions:

```typescript
monitor.histogram('response.size', responseBytes);
monitor.histogram('items.per.request', items.length);
```

## Middleware Options

### Configuration

```typescript
interface PerformanceMiddlewareConfig {
  // Performance monitor instance
  monitor?: IPerformanceMonitor;

  // Enable detailed metrics (response size, user agents, etc.)
  detailed?: boolean;

  // Skip monitoring for these paths
  skipPaths?: string[];

  // Custom metric name generator
  metricNameGenerator?: (c: Context) => string;

  // Custom tag generator
  tagGenerator?: (c: Context) => Record<string, string>;

  // Sample rate (0-1, where 1 means 100% sampling)
  sampleRate?: number;
}
```

### Custom Metric Names

```typescript
app.use(
  '*',
  performanceMonitoring({
    metricNameGenerator: (c) => {
      // Group metrics by API version
      const version = c.req.path.match(/^\/v(\d+)/)?.[1] || 'legacy';
      return `api.v${version}.request`;
    },
  }),
);
```

### Custom Tags

```typescript
app.use(
  '*',
  performanceMonitoring({
    tagGenerator: (c) => ({
      method: c.req.method,
      route: c.req.routePath || 'unknown',
      country: c.req.header('cf-ipcountry') || 'unknown',
      device: detectDevice(c.req.header('user-agent')),
    }),
  }),
);
```

## Monitoring Providers

### Console Provider (Development)

```typescript
const monitor = new PerformanceMonitor({
  providers: [new ConsoleMonitoringProvider()],
  debug: true,
});
```

### Cloudflare Analytics Engine

```typescript
const provider = new CloudflareAnalyticsProvider(
  env.CF_ACCOUNT_ID,
  env.CF_API_TOKEN,
  'production-metrics', // dataset name
);

const monitor = new PerformanceMonitor({
  providers: [provider],
});
```

### StatsD Provider

```typescript
const provider = new StatsDProvider(
  'statsd.example.com',
  8125,
  'myapp', // metric prefix
);

const monitor = new PerformanceMonitor({
  providers: [provider],
});
```

### Custom Provider

```typescript
class CustomProvider implements IMonitoringProvider {
  name = 'custom';

  async send(metrics: IMetric[]): Promise<void> {
    // Send to your backend
    await fetch('https://metrics.example.com/ingest', {
      method: 'POST',
      body: JSON.stringify(metrics),
    });
  }

  isAvailable(): boolean {
    return true;
  }
}
```

## Automatic Metrics

The middleware automatically tracks:

### Request Metrics

- `http.request.count` - Total request count
- `http.request.duration` - Request duration in milliseconds
- `http.request.status.{code}` - Count by status code
- `http.request.error` - Error count

### Detailed Metrics (when enabled)

- `http.request.response_size` - Response body size
- `http.request.request_size` - Request body size
- `http.request.user_agent` - User agent distribution
- `http.request.latency_bucket.{bucket}` - Latency distribution

## Best Practices

### 1. Use Appropriate Sampling

For high-traffic applications, use sampling to reduce overhead:

```typescript
app.use(
  '*',
  performanceMonitoring({
    sampleRate: 0.01, // Sample 1% of requests
  }),
);
```

### 2. Add Context with Tags

Always add relevant context to your metrics:

```typescript
monitor.increment('feature.usage', 1, {
  feature: 'export',
  format: 'pdf',
  user_tier: user.tier,
});
```

### 3. Use Consistent Naming

Follow a naming convention for metrics:

```
service.component.action.unit
```

Examples:

- `api.users.create.duration`
- `cache.hits.count`
- `db.connections.active`

### 4. Monitor Business Metrics

Track metrics that matter to your business:

```typescript
monitor.increment('checkout.completed', 1, {
  payment_method: 'card',
  currency: 'USD',
});

monitor.histogram('order.value', orderTotal, {
  category: order.category,
});
```

### 5. Set Up Alerts

Configure alerts based on your metrics:

```typescript
// Track error rates
monitor.increment('api.errors', 1, {
  type: error.name,
  endpoint: c.req.path,
});

// Set up alerts when error rate > 5%
```

## Performance Considerations

### Overhead

The monitoring system is designed for minimal overhead:

- Metrics are buffered and sent asynchronously
- Sampling reduces load for high-traffic endpoints
- Tag generation is lazy and cached

### Memory Usage

- Default buffer size: 1000 metrics
- Auto-flush when buffer is full
- Configurable flush intervals

### CPU Usage

- < 1ms overhead per request (without detailed metrics)
- < 2ms overhead with detailed metrics enabled
- Negligible impact on Worker CPU limits

## Debugging

### Enable Debug Mode

```typescript
const monitor = new PerformanceMonitor({
  debug: true, // Logs all metric operations
});
```

### Metrics Endpoint

Add a metrics endpoint for debugging:

```typescript
import { metricsEndpoint } from '@/middleware/performance';

app.get('/metrics', metricsEndpoint(monitor));
```

### Check Provider Status

```typescript
// Check if metrics are being sent
const provider = new CloudflareAnalyticsProvider(...);
if (!provider.isAvailable()) {
  console.error('Analytics provider not configured!');
}
```

## Example: Complete Setup

```typescript
import { Hono } from 'hono';
import { performanceMonitoring, metricsEndpoint } from '@/middleware/performance';
import {
  PerformanceMonitor,
  CloudflareAnalyticsProvider,
  ConsoleMonitoringProvider,
} from '@/core/services/performance-monitor';

const app = new Hono();

// Create monitor with multiple providers
const monitor = new PerformanceMonitor({
  providers: [
    // Production metrics
    new CloudflareAnalyticsProvider(env.CF_ACCOUNT_ID, env.CF_API_TOKEN, 'api-metrics'),
    // Development logging
    ...(env.DEBUG ? [new ConsoleMonitoringProvider()] : []),
  ],
  defaultTags: {
    app: 'api',
    version: env.APP_VERSION,
    environment: env.ENVIRONMENT,
  },
  flushInterval: 5000,
});

// Add monitoring middleware
app.use(
  '*',
  performanceMonitoring({
    monitor,
    detailed: env.ENVIRONMENT === 'production',
    sampleRate: env.ENVIRONMENT === 'production' ? 0.1 : 1,
    skipPaths: ['/health', '/metrics', '/favicon.ico'],
    tagGenerator: (c) => ({
      method: c.req.method,
      path: c.req.routePath || c.req.path,
      country: c.req.header('cf-ipcountry') || 'XX',
      colo: c.req.header('cf-ray')?.split('-')[1] || 'unknown',
    }),
  }),
);

// Health check endpoint (not monitored)
app.get('/health', (c) => c.text('OK'));

// Metrics debugging endpoint
app.get('/metrics', metricsEndpoint(monitor));

// API routes (automatically monitored)
app.get('/api/users', async (c) => {
  // Custom metric for business logic
  const timer = monitor.startTimer('business.user.list');

  const users = await db.getUsers();

  timer.end({
    count: users.length,
    cached: false,
  });

  return c.json({ users });
});

// Error tracking
app.onError((err, c) => {
  monitor.increment('errors.unhandled', 1, {
    error: err.name,
    path: c.req.path,
  });

  return c.json({ error: 'Internal Server Error' }, 500);
});

export default app;
```

## Troubleshooting

### Metrics Not Appearing

1. Check provider configuration
2. Verify flush is being called
3. Enable debug mode to see operations
4. Check network requests in provider

### High Memory Usage

1. Reduce flush interval
2. Decrease max buffer size
3. Use sampling for high-traffic routes
4. Disable detailed metrics

### Performance Impact

1. Use sampling for high-traffic endpoints
2. Disable detailed metrics in production
3. Skip monitoring for static assets
4. Use batch sending in providers
