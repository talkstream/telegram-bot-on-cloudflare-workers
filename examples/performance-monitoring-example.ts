import { Hono } from 'hono';
import { serve } from '@hono/node-server';

import { performanceMonitoring, metricsEndpoint } from '../src/middleware/performance';
import {
  PerformanceMonitor,
  ConsoleMonitoringProvider,
  CloudflareAnalyticsProvider,
  StatsDProvider,
} from '../src/core/services/performance-monitor';

/**
 * Example: Performance Monitoring System
 *
 * This example demonstrates comprehensive performance monitoring
 * for a Cloudflare Workers application.
 */

// Simulated environment variables
const env = {
  ENVIRONMENT: 'development',
  CF_ACCOUNT_ID: 'your-account-id',
  CF_API_TOKEN: 'your-api-token',
  STATSD_HOST: 'localhost',
  STATSD_PORT: '8125',
  DEBUG: 'true',
};

// Create performance monitor with multiple providers
const monitor = new PerformanceMonitor({
  providers: [
    // Console provider for development
    new ConsoleMonitoringProvider(),

    // Cloudflare Analytics Engine (production)
    ...(env.CF_ACCOUNT_ID && env.CF_API_TOKEN
      ? [
          new CloudflareAnalyticsProvider(
            env.CF_ACCOUNT_ID,
            env.CF_API_TOKEN,
            'performance-metrics',
          ),
        ]
      : []),

    // StatsD provider
    ...(env.STATSD_HOST
      ? [new StatsDProvider(env.STATSD_HOST, parseInt(env.STATSD_PORT), `app.${env.ENVIRONMENT}`)]
      : []),
  ],
  defaultTags: {
    environment: env.ENVIRONMENT,
    region: 'us-east-1',
    version: '1.0.0',
  },
  flushInterval: 5000, // Flush every 5 seconds
  maxBufferSize: 100, // Flush when 100 metrics buffered
  debug: env.DEBUG === 'true',
});

// Create Hono app
const app = new Hono();

// Add performance monitoring middleware
app.use(
  '*',
  performanceMonitoring({
    monitor,
    detailed: true, // Enable detailed metrics
    sampleRate: 1, // Sample 100% in development
    skipPaths: ['/health', '/metrics', '/favicon.ico'],
    tagGenerator: (c) => ({
      method: c.req.method,
      path: c.req.routePath || c.req.path,
      user_agent: parseUserAgent(c.req.header('user-agent')),
      country: c.req.header('cf-ipcountry') || 'unknown',
    }),
  }),
);

// Helper to parse user agent
function parseUserAgent(ua?: string): string {
  if (!ua) return 'unknown';
  if (ua.includes('Mobile')) return 'mobile';
  if (ua.includes('Tablet')) return 'tablet';
  return 'desktop';
}

// Health check endpoint (skipped by monitoring)
app.get('/health', (c) => c.text('OK'));

// Metrics debugging endpoint
app.get('/metrics', metricsEndpoint(monitor));

// Example API endpoints with custom metrics
app.get('/api/users', async (c) => {
  // Start a custom timer
  const timer = monitor.startTimer('db.query', { table: 'users' });

  // Simulate database query
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

  // Simulate results
  const users = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
  }));

  // End timer with additional tags
  timer.end({ rows: users.length, cached: false });

  // Business metric
  monitor.increment('api.users.list', 1, { cached: false });

  return c.json({ users });
});

app.get('/api/users/:id', async (c) => {
  const id = c.req.param('id');

  // Track cache hit/miss
  const cacheKey = `user:${id}`;
  const cached = Math.random() > 0.5; // Simulate cache hit 50% of the time

  if (cached) {
    monitor.increment('cache.hit', 1, { key: cacheKey });
  } else {
    monitor.increment('cache.miss', 1, { key: cacheKey });

    // Simulate database query
    const timer = monitor.startTimer('db.query', { table: 'users', operation: 'findOne' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    timer.end();
  }

  return c.json({
    id: parseInt(id),
    name: `User ${id}`,
    email: `user${id}@example.com`,
    cached,
  });
});

app.post('/api/users', async (c) => {
  // Parse request body
  const body = await c.req.json<{ name: string; email: string }>();

  // Validation metrics
  if (!body.name || !body.email) {
    monitor.increment('validation.error', 1, { endpoint: '/api/users' });
    return c.json({ error: 'Invalid input' }, 400);
  }

  // Track request size
  const requestSize = JSON.stringify(body).length;
  monitor.histogram('request.size', requestSize, { endpoint: '/api/users' });

  // Simulate user creation
  const timer = monitor.startTimer('business.user.create');
  await new Promise((resolve) => setTimeout(resolve, 100));

  const user = {
    id: Math.floor(Math.random() * 1000),
    ...body,
  };

  timer.end({ success: true });

  // Business metrics
  monitor.increment('users.created', 1);
  monitor.gauge('users.total', 100 + Math.floor(Math.random() * 50));

  return c.json(user, 201);
});

// Simulate an endpoint with errors
app.get('/api/flaky', async (c) => {
  const shouldFail = Math.random() > 0.7; // Fail 30% of the time

  if (shouldFail) {
    monitor.increment('api.flaky.error', 1);
    throw new Error('Random failure');
  }

  monitor.increment('api.flaky.success', 1);
  return c.json({ status: 'ok' });
});

// Long-running endpoint
app.get('/api/slow', async (c) => {
  const duration = 500 + Math.random() * 2000; // 500-2500ms

  const timer = monitor.startTimer('api.slow.processing');
  await new Promise((resolve) => setTimeout(resolve, duration));
  timer.end();

  // Track slow requests
  if (duration > 1000) {
    monitor.increment('slow.requests', 1, {
      endpoint: '/api/slow',
      duration_bucket: duration > 2000 ? '>2s' : '1-2s',
    });
  }

  return c.json({ duration });
});

// External API call simulation
app.get('/api/external', async (c) => {
  const services = ['payment', 'shipping', 'inventory'];
  const service = services[Math.floor(Math.random() * services.length)];

  const timer = monitor.startTimer('external.api.call', { service });

  // Simulate API call
  const latency = 100 + Math.random() * 400; // 100-500ms
  await new Promise((resolve) => setTimeout(resolve, latency));

  const success = Math.random() > 0.1; // 90% success rate
  timer.end({ success: success.toString() });

  if (!success) {
    monitor.increment('external.api.error', 1, { service });
    return c.json({ error: `${service} service unavailable` }, 503);
  }

  monitor.increment('external.api.success', 1, { service });
  return c.json({ service, latency });
});

// Global error handler
app.onError((err, c) => {
  // Track unhandled errors
  monitor.increment('errors.unhandled', 1, {
    error: err.name,
    message: err.message.substring(0, 50), // Truncate for tag
    path: c.req.path,
  });

  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

// 404 handler
app.notFound((c) => {
  monitor.increment('errors.not_found', 1, {
    path: c.req.path,
    method: c.req.method,
  });

  return c.json({ error: 'Not Found' }, 404);
});

// Export for Cloudflare Workers
export default app;

// Local development server
if (process.env.NODE_ENV !== 'production') {
  const port = 3001;

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await monitor.stop();
    process.exit(0);
  });

  console.log(`
🚀 Performance Monitoring Example
   Running at http://localhost:${port}

📊 Available Endpoints:
   - GET  /health              Health check (not monitored)
   - GET  /metrics             View basic metrics
   
   API Endpoints (all monitored):
   - GET  /api/users           List users (with DB timing)
   - GET  /api/users/:id       Get user (with cache tracking)
   - POST /api/users           Create user (with validation)
   - GET  /api/flaky           Flaky endpoint (30% error rate)
   - GET  /api/slow            Slow endpoint (500-2500ms)
   - GET  /api/external        External API simulation
   
💡 Monitoring Features:
   - Automatic request duration tracking
   - Status code distribution
   - Error rate monitoring
   - Custom business metrics
   - Cache hit/miss tracking
   - External API latency
   - Detailed request metrics
   
🔍 Check console for metric logs
   Metrics flush every 5 seconds
  `);

  serve({
    fetch: app.fetch,
    port,
  });
}
