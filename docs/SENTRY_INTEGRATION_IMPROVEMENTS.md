# Sentry Integration Improvements

## Implementation Status

### ✅ Completed Improvements (July 28, 2025)

1. **EventBus Integration** - Created `MonitoringPlugin` for automatic event tracking
2. **User Context Tracking** - Implemented `MonitoringContextMiddleware` for all requests
3. **AI Provider Monitoring** - Created `MonitoredAIConnector` wrapper with full metrics
4. **Command Performance Tracking** - Added `createMonitoredCommand` helper
5. **Enhanced Error Context** - All errors now include user and request context
6. **Performance Monitoring** - Transaction and span support throughout the system

### 🟢 What's Now Working

1. **Comprehensive Monitoring** - All layers of the application are monitored
2. **Automatic User Context** - Every request includes user information
3. **AI Cost Tracking** - Token usage and costs are tracked for all AI calls
4. **Performance Insights** - Command execution times are measured
5. **Error Diagnosis** - Rich context for debugging production issues
6. **Event Correlation** - Breadcrumbs provide full request history

## Implementation Details

### 1. MonitoringPlugin for EventBus

Created a plugin that automatically tracks all events:

```typescript
// src/plugins/monitoring-plugin.ts
export class MonitoringPlugin implements IEventBusPlugin {
  - Tracks error events automatically
  - Monitors performance-critical operations
  - Sanitizes sensitive data
  - Collects event statistics
}
```

### 2. User Context Middleware

Automatic user tracking for all requests:

```typescript
// src/middleware/monitoring-context.ts
export function createMonitoringContextMiddleware() {
  - Sets user context on every request
  - Adds breadcrumbs for messages and callbacks
  - Filters out undefined values
  - Provides helper functions for command tracking
}
```

### 3. AI Provider Monitoring

Comprehensive AI usage tracking:

```typescript
// src/connectors/ai/monitored-ai-connector.ts
export class MonitoredAIConnector {
  - Tracks generation time and token usage
  - Reports costs for each operation
  - Monitors streaming operations
  - Captures errors with full context
}
```

## Original Implementation Plan (Now Completed)

### 1. Enhanced Error Context ✅

Add more context to all errors:

```typescript
// In telegram-adapter.ts
try {
  await handleCommand(ctx);
} catch (error) {
  captureException(error, {
    user: {
      id: ctx.from?.id,
      username: ctx.from?.username,
    },
    command: ctx.message?.text,
    chatType: ctx.chat?.type,
    timestamp: new Date().toISOString(),
  });
  throw error;
}
```

### 2. User Context Tracking

Implement user context in command handlers:

```typescript
// In command handlers
export async function handleCommand(ctx: Context) {
  // Set user context for this request
  setUserContext(ctx.from.id, {
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    languageCode: ctx.from.language_code,
    isPremium: ctx.from.is_premium,
  });

  try {
    // Handle command
  } finally {
    clearUserContext();
  }
}
```

### 3. Command Performance Tracking

Add transaction tracking for commands:

```typescript
// In telegram-adapter.ts
const transaction = monitoringConnector?.startTransaction({
  name: `command.${commandName}`,
  op: 'command',
  data: {
    userId: ctx.from?.id,
    chatId: ctx.chat?.id,
  },
});

try {
  await handleCommand(ctx);
  transaction?.setStatus('ok');
} catch (error) {
  transaction?.setStatus('internal_error');
  throw error;
} finally {
  transaction?.finish();
}
```

### 4. EventBus Integration

Create a monitoring plugin for EventBus:

```typescript
// monitoring-plugin.ts
export class MonitoringPlugin implements IEventBusPlugin {
  constructor(private monitoring: IMonitoringConnector) {}

  async onEvent(event: Event): Promise<void> {
    // Track important events
    if (event.type.includes('error')) {
      this.monitoring.captureMessage(`Event: ${event.type}`, 'error', event.data);
    }

    // Track performance-critical events
    if (event.type.includes('ai.') || event.type.includes('db.')) {
      this.monitoring.addBreadcrumb({
        message: event.type,
        category: 'event',
        level: 'info',
        data: event.data,
      });
    }
  }
}
```

### 5. AI Provider Monitoring

Track AI usage and errors:

```typescript
// In AI connectors
async complete(prompt: string, options?: CompletionOptions): Promise<string> {
  const span = this.monitoring?.startSpan({
    op: 'ai.complete',
    description: `${this.provider} completion`,
  });

  try {
    const result = await this.doComplete(prompt, options);

    // Track token usage
    this.monitoring?.captureMessage('AI completion', 'info', {
      provider: this.provider,
      model: options?.model,
      tokensUsed: result.usage?.totalTokens,
      duration: span?.endTime - span?.startTime,
    });

    return result.text;
  } catch (error) {
    this.monitoring?.captureException(error, {
      provider: this.provider,
      model: options?.model,
      prompt: prompt.substring(0, 100), // First 100 chars only
    });
    throw error;
  } finally {
    span?.finish();
  }
}
```

### 6. Database Query Monitoring

Track slow queries and errors:

```typescript
// In database operations
async executeQuery(query: string, params?: unknown[]): Promise<unknown> {
  const span = this.monitoring?.startSpan({
    op: 'db.query',
    description: query.substring(0, 50),
  });

  const startTime = Date.now();

  try {
    const result = await this.db.prepare(query).bind(...params).all();

    const duration = Date.now() - startTime;
    if (duration > 1000) { // Slow query threshold
      this.monitoring?.captureMessage('Slow query detected', 'warning', {
        query,
        duration,
        rowCount: result.length,
      });
    }

    return result;
  } catch (error) {
    this.monitoring?.captureException(error, {
      query,
      params,
    });
    throw error;
  } finally {
    span?.finish();
  }
}
```

### 7. Rate Limiting Alerts

Track rate limit violations:

```typescript
// In rate limiter middleware
if (isRateLimited) {
  captureMessage('Rate limit exceeded', 'warning', {
    userId: ctx.from?.id,
    endpoint: ctx.url,
    limit: rateLimit,
    window: rateLimitWindow,
  });
}
```

### 8. Health Monitoring

Add health check tracking:

```typescript
// In scheduled handler
export async function healthCheck(env: Env): Promise<void> {
  const monitoring = getMonitoringConnector();

  try {
    // Check database
    const dbHealth = await checkDatabase(env);

    // Check external services
    const aiHealth = await checkAIProvider(env);

    if (!dbHealth.healthy || !aiHealth.healthy) {
      monitoring?.captureMessage('Health check failed', 'error', {
        database: dbHealth,
        ai: aiHealth,
      });
    }
  } catch (error) {
    monitoring?.captureException(error, {
      context: 'health_check',
    });
  }
}
```

## Implementation Priority

1. **High Priority**
   - EventBus integration (automatic tracking)
   - User context in commands
   - AI provider monitoring

2. **Medium Priority**
   - Command performance tracking
   - Database query monitoring
   - Rate limiting alerts

3. **Low Priority**
   - Health monitoring
   - Custom business events
   - Dashboard creation

## Benefits

- **Better Error Diagnosis** - Rich context for debugging
- **Performance Insights** - Identify bottlenecks
- **User Experience** - Track and improve user flows
- **Cost Optimization** - Monitor AI token usage
- **Proactive Monitoring** - Catch issues before users report them

## Next Steps

1. Create `MonitoringPlugin` for EventBus
2. Add user context to all command handlers
3. Implement AI provider monitoring wrapper
4. Add performance tracking to critical paths
5. Create monitoring dashboard in Sentry
