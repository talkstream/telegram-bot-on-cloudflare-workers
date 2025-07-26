# Analytics Engine Integration

The wireframe platform provides a comprehensive analytics service abstraction for collecting and querying metrics data. It supports Cloudflare Analytics Engine for production use and includes an in-memory implementation for testing.

## Features

- **Multiple Providers**: Cloudflare Analytics Engine and memory-based storage
- **Batch Writing**: Efficient batch processing with configurable flush intervals
- **Real-time Streaming**: Subscribe to metrics in real-time
- **Flexible Querying**: Time-based aggregations, dimension filtering, grouping
- **Retention Policies**: Automatic data cleanup based on retention rules
- **Export Capabilities**: Export data in JSON or CSV formats
- **Middleware Integration**: Automatic request tracking and performance metrics

## Basic Usage

### Configuration

```typescript
import { AnalyticsFactory } from '@/core/services/analytics';

// Configure for Cloudflare Analytics Engine
AnalyticsFactory.configure({
  provider: 'cloudflare',
  env: env, // Cloudflare Worker environment
  datasetName: 'MY_DATASET', // Analytics Engine dataset binding
  batchOptions: {
    maxBatchSize: 1000,
    flushInterval: 10000, // 10 seconds
  },
  eventBus: eventBus,
});

// Create service instance
const analytics = AnalyticsFactory.createAutoDetect();
```

### Writing Metrics

```typescript
// Write single data point
await analytics.write({
  metric: 'api.request_count',
  value: 1,
  dimensions: {
    endpoint: '/api/users',
    method: 'GET',
    status: 200,
  },
});

// Write batch
await analytics.writeBatch([
  { metric: 'cpu.usage', value: 45.2 },
  { metric: 'memory.usage', value: 1024 },
  { metric: 'disk.usage', value: 85.5 },
]);
```

### Querying Data

```typescript
// Basic query
const result = await analytics.query({
  startTime: new Date(Date.now() - 3600000), // 1 hour ago
  endTime: new Date(),
  metrics: ['api.request_count'],
});

// Query with aggregation
const aggregated = await analytics.query({
  startTime: new Date(Date.now() - 86400000), // 24 hours ago
  endTime: new Date(),
  metrics: ['api.request_count', 'api.response_time'],
  granularity: 'hour',
  aggregation: 'sum',
});

// Query with dimension filtering
const filtered = await analytics.query({
  startTime: new Date(Date.now() - 3600000),
  endTime: new Date(),
  metrics: ['api.request_count'],
  filters: {
    status: [200, 201],
    method: 'POST',
  },
  groupBy: ['endpoint'],
});
```

## Middleware Integration

### Request Tracking Middleware

```typescript
import { createAnalyticsTracker } from '@/middleware/analytics-tracker';

// Basic tracking
app.use(
  createAnalyticsTracker({
    analyticsService: 'cloudflare',
    env: env,
    datasetName: 'API_METRICS',
  }),
);

// Advanced configuration
app.use(
  createAnalyticsTracker({
    metricsPrefix: 'myapp',
    excludeRoutes: ['/health', '/metrics'],
    dimensions: {
      region: (c) => c.req.header('cf-ipcountry'),
      version: (c) => c.req.header('x-api-version'),
      tier: (c) => c.get('userTier'),
    },
    trackResponseTime: true,
    trackRequestSize: true,
    trackResponseSize: true,
    trackErrors: true,
    sampleRate: 0.1, // Sample 10% of requests
  }),
);
```

### Custom Action Tracking

```typescript
import { trackUserAction, trackBusinessMetric } from '@/middleware/analytics-tracker';

// Track user actions
await trackUserAction(analytics, 'button_click', 1, {
  button: 'subscribe',
  page: 'pricing',
  userId: user.id,
});

// Track business metrics
await trackBusinessMetric(analytics, 'revenue', 99.99, {
  product: 'premium_plan',
  currency: 'USD',
  userId: user.id,
});
```

### Performance Tracking

```typescript
import { createPerformanceTracker } from '@/middleware/analytics-tracker';

// Track operation performance
const tracker = createPerformanceTracker(analytics, 'database.query');

try {
  const result = await db.query(sql);
  await tracker.complete({ query: 'getUserById' });
} catch (error) {
  await tracker.fail(error, { query: 'getUserById' });
  throw error;
}
```

## Advanced Features

### Real-time Streaming

```typescript
// Subscribe to metrics
const { stop } = analytics.stream(['api.request_count', 'api.error_count'], (dataPoint) => {
  console.log(`Metric: ${dataPoint.metric}, Value: ${dataPoint.value}`);

  // Trigger alerts
  if (dataPoint.metric === 'api.error_count' && dataPoint.value > 100) {
    alerting.trigger('high_error_rate');
  }
});

// Stop streaming
stop();
```

### Custom Metrics

```typescript
// Define custom metric
await analytics.createMetric('user.subscription', {
  description: 'User subscription events',
  unit: 'events',
  retentionDays: 365,
  dimensions: ['plan', 'source'],
  aggregations: [
    { interval: 'hour', function: 'sum' },
    { interval: 'day', function: 'sum' },
  ],
});

// List available metrics
const metrics = await analytics.listMetrics();
```

### Data Export

```typescript
// Export as JSON
const jsonData = await analytics.export(
  {
    startTime: new Date('2024-01-01'),
    endTime: new Date('2024-01-31'),
    metrics: ['api.request_count'],
    granularity: 'day',
  },
  'json',
);

// Export as CSV
const csvData = await analytics.export(
  {
    startTime: new Date('2024-01-01'),
    endTime: new Date('2024-01-31'),
    metrics: ['api.request_count', 'api.response_time'],
    groupBy: ['endpoint'],
  },
  'csv',
);

// Save to file or send response
return new Response(csvData, {
  headers: {
    'Content-Type': 'text/csv',
    'Content-Disposition': 'attachment; filename="metrics.csv"',
  },
});
```

## Cloudflare Analytics Engine Setup

### 1. Create Dataset

In your `wrangler.toml`:

```toml
[[analytics_engine_datasets]]
binding = "API_METRICS"
```

### 2. Query via SQL API

Analytics Engine supports SQL queries:

```typescript
// Using Cloudflare REST API
const query = `
  SELECT 
    toStartOfInterval(timestamp, INTERVAL 1 hour) as hour,
    sum(double1) as total_requests,
    avg(double2) as avg_response_time
  FROM API_METRICS
  WHERE 
    timestamp >= ${startTime}
    AND timestamp < ${endTime}
    AND blob1 = 'api.request_count'
  GROUP BY hour
  ORDER BY hour
`;

const response = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  },
);
```

## Testing with Memory Analytics

```typescript
import { MemoryAnalyticsService } from '@/core/services/analytics';

// Create test instance
const analytics = new MemoryAnalyticsService();

// Use in tests
describe('MyFeature', () => {
  it('should track metrics', async () => {
    await myFeature.process();

    const result = await analytics.query({
      startTime: new Date(Date.now() - 60000),
      endTime: new Date(),
      metrics: ['feature.processed'],
    });

    expect(result.data[0].values['feature.processed']).toBe(1);
  });
});
```

## Best Practices

### 1. Metric Naming

Use hierarchical naming:

- `api.request_count`
- `api.response_time`
- `business.revenue`
- `user.action.click`

### 2. Dimensions

Keep dimensions consistent:

- Use lowercase keys
- Limit cardinality
- Avoid personal data

### 3. Batching

Configure appropriate batch settings:

```typescript
{
  maxBatchSize: 1000,      // Balance between memory and API calls
  flushInterval: 10000,    // 10 seconds for near real-time
  retryOnFailure: true,
  maxRetries: 3,
}
```

### 4. Sampling

For high-traffic applications:

```typescript
{
  sampleRate: 0.1,  // Sample 10% of requests
  // Or dynamic sampling
  sampleRate: c => c.req.path.startsWith('/api/') ? 0.1 : 1.0,
}
```

### 5. Error Handling

Always handle analytics errors gracefully:

```typescript
try {
  await analytics.write(dataPoint);
} catch (error) {
  console.error('Analytics write failed:', error);
  // Don't let analytics failures break the app
}
```

## Performance Optimization Tips

1. **Use batch writes** for multiple metrics
2. **Configure appropriate flush intervals** based on your needs
3. **Use sampling** for high-frequency metrics
4. **Limit dimension cardinality** to avoid data explosion
5. **Set retention policies** to manage storage costs
6. **Use streaming** for real-time monitoring instead of polling

## Integration Examples

### With Event Bus

```typescript
eventBus.on('user:registered', async (event) => {
  await analytics.write({
    metric: 'user.registration',
    value: 1,
    dimensions: {
      source: event.source,
      plan: event.plan,
    },
  });
});
```

### With Queue Service

```typescript
// Process analytics asynchronously
await queueService.send('analytics-queue', {
  type: 'batch-write',
  dataPoints: metricsBuffer,
});
```

### With Cache Service

```typescript
// Cache query results
const cacheKey = `analytics:${JSON.stringify(queryOptions)}`;
const cached = await cache.get(cacheKey);

if (!cached) {
  const result = await analytics.query(queryOptions);
  await cache.set(cacheKey, result, { ttl: 300 }); // 5 minutes
  return result;
}
```

## Troubleshooting

### Common Issues

1. **No data returned**: Check time ranges and metric names
2. **High latency**: Reduce batch size or increase flush interval
3. **Memory issues**: Enable sampling or reduce retention
4. **Missing dimensions**: Ensure consistent dimension keys

### Debug Mode

```typescript
// Enable debug logging
const analytics = new MemoryAnalyticsService({
  debug: true,
});

// Or use event bus
eventBus.on('analytics:*', (event) => {
  console.log('Analytics event:', event);
});
```
