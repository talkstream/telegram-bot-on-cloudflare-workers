# Sentry Integration Guide

## Overview

Wireframe provides comprehensive Sentry integration for error tracking, performance monitoring, and observability across all platforms.

## Features

### 🎯 Core Capabilities

- **Automatic Error Tracking**: Capture all exceptions with context
- **Performance Monitoring**: Track operation latency and throughput
- **Event-Driven Integration**: Automatic tracking via EventBus
- **User Context**: Automatic user identification and tracking
- **Custom Events & Metrics**: Track business-specific metrics
- **Platform Agnostic**: Works on Cloudflare, AWS, Node.js, and browsers

### 🔌 Integration Points

1. **MonitoringPlugin**: Automatic EventBus integration
2. **MonitoringContextMiddleware**: HTTP request tracking
3. **MonitoredAIConnector**: AI provider monitoring
4. **MonitoredPerformanceMonitor**: Performance metrics reporting
5. **MonitoredCommand**: Command execution tracking

## Quick Start

### 1. Basic Setup

```typescript
import { SentryConnector } from '@/connectors/monitoring/sentry';
import { EventBus } from '@/core/events/event-bus';
import { createMonitoringPlugin } from '@/core/plugins/monitoring-plugin';

// Initialize Sentry
const monitoring = new SentryConnector();
await monitoring.initialize({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,
  platform: 'cloudflare', // or 'aws', 'node', 'browser'
});

// Create EventBus with monitoring
const eventBus = new EventBus();
const monitoringPlugin = createMonitoringPlugin(monitoring, eventBus);
```

### 2. HTTP Middleware Setup

```typescript
import { Hono } from 'hono';
import { createMonitoringContextMiddleware } from '@/middleware/monitoring-context';

const app = new Hono();

// Add monitoring middleware
app.use(
  '*',
  createMonitoringContextMiddleware({
    monitoring,
    eventBus,
    getUserId: (ctx) => ctx.get('userId'),
    getUserContext: (ctx) => ({
      username: ctx.get('username'),
      plan: ctx.get('userPlan'),
    }),
  }),
);
```

### 3. Telegram Bot Setup

```typescript
import { Bot } from 'grammy';
import { createGrammyMonitoringMiddleware } from '@/middleware/monitoring-context';

const bot = new Bot(token);

// Add monitoring to Grammy
bot.use(createGrammyMonitoringMiddleware(monitoring, eventBus));
```

## Advanced Features

### AI Provider Monitoring

Automatically track AI completion latency, token usage, and costs:

```typescript
import { MonitoredAIConnector } from '@/connectors/ai/monitored-ai-connector';
import { OpenAIConnector } from '@/connectors/ai/openai';

// Wrap any AI connector with monitoring
const aiConnector = new MonitoredAIConnector(
  new OpenAIConnector(config),
  monitoring,
  eventBus
);

// All AI operations are now tracked automatically
const response = await aiConnector.complete({
  model: 'gpt-4',
  messages: [...],
});

// Automatically tracks:
// - Latency (ai_completion_latency)
// - Token usage (ai_tokens_used)
// - Costs (ai_completion_cost)
// - Errors with full context
```

### Performance Monitoring Integration

Track operation performance with automatic Sentry reporting:

```typescript
import { createMonitoredPerformance } from '@/middleware/monitored-performance';

const performanceMonitor = createMonitoredPerformance(monitoring, eventBus, {
  reportThreshold: 100, // Report operations slower than 100ms
  reportErrors: true, // Report all errors to Sentry
  reportPercentiles: true, // Track p50, p95, p99
});

// Track any operation
await performanceMonitor.trackOperation('database.query', async () => {
  return await db.query('SELECT * FROM users');
});

// Start periodic aggregated reporting
performanceMonitor.startPeriodicReporting(60000); // Every minute
```

### Command Monitoring

Automatically track command execution:

```typescript
import { createMonitoredCommand } from '@/helpers/monitored-command';

const startCommand = createMonitoredCommand({
  command: {
    command: 'start',
    describe: 'Start the bot',
    handler: async (ctx) => {
      await ctx.reply('Welcome!');
    },
  },
  monitoring,
  eventBus,
  trackPerformance: true,
  trackUserContext: true,
});

// Command execution is now tracked with:
// - Duration metrics
// - Success/failure rates
// - User context
// - Error details
```

### Using Decorators

```typescript
class CommandHandler {
  @MonitorCommand('user.profile')
  async handleProfile(ctx: CommandContext) {
    // Automatically tracked
    return await this.userService.getProfile(ctx.userId);
  }

  @TrackPerformance('database.save')
  async saveUser(user: User) {
    // Performance tracked automatically
    return await this.db.save(user);
  }
}
```

## Event Tracking

### Automatic Event Tracking

The MonitoringPlugin automatically tracks these events:

#### Performance Events

- `request_started` / `request_completed`
- `ai_completion_success` / `ai_completion_failed`
- `payment_completed` / `payment_failed`

#### Error Events

- All exceptions with stack traces
- Failed operations with context
- Plugin errors

#### Custom Events

- `user_registered` / `user_logged_in`
- `plugin_loaded` / `plugin_error`
- `session_created`
- `cache_hit` / `cache_miss`

### Manual Event Tracking

```typescript
// Track custom events
monitoring.trackEvent('feature_used', {
  feature: 'dark_mode',
  userId: user.id,
  timestamp: Date.now(),
});

// Track metrics
monitoring.trackMetric('api_latency', 250, {
  endpoint: '/api/users',
  method: 'GET',
});

// Add breadcrumbs for context
monitoring.addBreadcrumb({
  message: 'User clicked button',
  category: 'ui',
  level: 'info',
  data: { buttonId: 'submit' },
});
```

## Configuration

### Environment Variables

```env
# Required
SENTRY_DSN=https://your-key@sentry.io/project-id

# Optional
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=1.0.0
SENTRY_SAMPLE_RATE=1.0
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### Advanced Configuration

```typescript
await monitoring.initialize({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,
  platform: 'cloudflare',
  sampleRate: 1.0, // Capture 100% of errors
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  beforeSend: (event) => {
    // Filter sensitive data
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    return event;
  },
  integrations: [
    // Add custom integrations
  ],
});
```

### Plugin Configuration

```typescript
const monitoringPlugin = new MonitoringPlugin({
  monitoring,
  eventBus,
  trackPerformance: true, // Track performance metrics
  trackErrors: true, // Capture exceptions
  trackCustomEvents: true, // Track custom events
  excludeEvents: [
    // Exclude specific events
    'system:heartbeat',
    'cache:hit',
  ],
});
```

## Best Practices

### 1. Set User Context Early

```typescript
// In authentication middleware
app.use(async (ctx, next) => {
  const user = await authenticate(ctx);
  if (user) {
    monitoring.setUserContext(user.id, {
      username: user.username,
      email: user.email,
      plan: user.subscription,
    });
  }
  await next();
});
```

### 2. Use Scoped Monitoring

```typescript
// Create scoped monitors for different services
const dbMonitor = performanceMonitor.scope('database');
const apiMonitor = performanceMonitor.scope('api');

await dbMonitor.trackOperation('query', async () => {
  // Database operations
});

await apiMonitor.trackOperation('fetch', async () => {
  // API calls
});
```

### 3. Track Business Metrics

```typescript
// Track business-specific events
monitoring.trackEvent('subscription_upgraded', {
  userId: user.id,
  fromPlan: 'free',
  toPlan: 'pro',
  revenue: 29.99,
});

// Track conversion funnel
monitoring.trackEvent('funnel_step', {
  step: 'checkout',
  userId: user.id,
  cartValue: 99.99,
});
```

### 4. Handle Sensitive Data

```typescript
// Filter sensitive data before sending
monitoring.initialize({
  beforeSend: (event) => {
    // Remove sensitive fields
    if (event.extra?.password) {
      delete event.extra.password;
    }
    if (event.user?.email) {
      event.user.email = '***';
    }
    return event;
  },
});
```

### 5. Use Proper Error Levels

```typescript
// Use appropriate severity levels
monitoring.captureMessage('Configuration missing', 'warning');
monitoring.captureMessage('Payment processed', 'info');
monitoring.captureMessage('Critical system failure', 'error');
```

## Platform-Specific Setup

### Cloudflare Workers

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const monitoring = new SentryConnector();
    await monitoring.initialize({
      dsn: env.SENTRY_DSN,
      platform: 'cloudflare',
      environment: env.ENVIRONMENT,
    });

    try {
      return await handleRequest(request, env);
    } catch (error) {
      monitoring.captureException(error);
      throw error;
    } finally {
      // Ensure events are sent before worker terminates
      await monitoring.flush(2000);
    }
  },
};
```

### AWS Lambda

```typescript
export const handler = async (event: APIGatewayEvent) => {
  const monitoring = new SentryConnector();
  await monitoring.initialize({
    dsn: process.env.SENTRY_DSN,
    platform: 'aws',
  });

  try {
    return await processEvent(event);
  } catch (error) {
    monitoring.captureException(error);
    throw error;
  } finally {
    await monitoring.flush();
  }
};
```

### Node.js

```typescript
const monitoring = new SentryConnector();
await monitoring.initialize({
  dsn: process.env.SENTRY_DSN,
  platform: 'node',
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  monitoring.captureException(error);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason) => {
  monitoring.captureException(new Error(String(reason)));
});
```

## Testing

### Mock Monitoring in Tests

```typescript
import { vi } from 'vitest';

const mockMonitoring = {
  initialize: vi.fn(),
  isAvailable: vi.fn(() => true),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  trackEvent: vi.fn(),
  trackMetric: vi.fn(),
  setUserContext: vi.fn(),
  clearUserContext: vi.fn(),
  addBreadcrumb: vi.fn(),
  flush: vi.fn(() => Promise.resolve(true)),
};

// Use in tests
const plugin = new MonitoringPlugin({
  monitoring: mockMonitoring,
  eventBus: new EventBus(),
});

// Verify tracking
expect(mockMonitoring.trackEvent).toHaveBeenCalledWith(
  'user_action',
  expect.objectContaining({ userId: '123' }),
);
```

## Troubleshooting

### Events Not Appearing in Sentry

1. **Check DSN**: Ensure SENTRY_DSN is correctly set
2. **Verify Initialization**: Check `monitoring.isAvailable()` returns true
3. **Flush Events**: Always call `await monitoring.flush()` before process terminates
4. **Check Sample Rate**: Ensure sampleRate is not 0
5. **Network Issues**: Verify network connectivity to Sentry

### High Event Volume

1. **Adjust Sample Rate**: Lower sampleRate in production
2. **Filter Events**: Use beforeSend to filter unnecessary events
3. **Exclude Events**: Configure excludeEvents in MonitoringPlugin
4. **Rate Limiting**: Implement rate limiting for high-frequency events

### Performance Impact

1. **Async Processing**: Events are sent asynchronously
2. **Batching**: Sentry batches events automatically
3. **Sampling**: Use tracesSampleRate to sample performance data
4. **Selective Tracking**: Only track critical operations

## Migration Guide

### From Console Logging

```typescript
// Before
console.error('Payment failed:', error);

// After
monitoring.captureException(error, {
  context: 'payment',
  userId: user.id,
  amount: payment.amount,
});
```

### From Custom Metrics

```typescript
// Before
customMetrics.record('api_latency', duration);

// After
monitoring.trackMetric('api_latency', duration, {
  endpoint: request.path,
  method: request.method,
});
```

## Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [Cloudflare Workers SDK](https://docs.sentry.io/platforms/javascript/guides/cloudflare/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Custom Instrumentation](https://docs.sentry.io/platforms/javascript/guides/cloudflare/performance/instrumentation/custom-instrumentation/)
