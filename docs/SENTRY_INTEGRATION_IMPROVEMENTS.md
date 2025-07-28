# Sentry Integration Improvements Plan

## Current State Analysis

### ✅ What's Already Working

1. **Monitoring Connector Pattern** - Platform-agnostic monitoring interface
2. **Sentry Connector Implementation** - Full-featured Sentry integration
3. **Mock Monitoring Connector** - For testing and demo mode
4. **Error Wrapping** - `wrapSentry()` captures uncaught exceptions
5. **Flush on Worker Termination** - Ensures events are sent

### 🔴 Areas for Improvement

1. **Limited Usage** - Sentry is only used for top-level error catching
2. **No User Context** - User context functions exist but aren't used
3. **No Command Tracking** - Bot commands aren't tracked
4. **No Performance Monitoring** - No transaction/span tracking
5. **No Custom Events** - Not tracking business-specific events
6. **No Integration with EventBus** - Missing opportunity for automatic tracking

## Improvement Plan

### 1. Enhanced Error Context

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
