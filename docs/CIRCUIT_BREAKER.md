# Circuit Breaker Pattern

## Overview

The Circuit Breaker pattern prevents cascading failures by temporarily blocking requests to failing services. This implementation provides automatic failure detection, recovery testing, and service resilience.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    CLOSED    │────>│     OPEN     │────>│  HALF_OPEN   │
│   (Normal)   │     │  (Blocking)  │     │  (Testing)   │
└──────────────┘     └──────────────┘     └──────────────┘
       ▲                                          │
       └──────────────────────────────────────────┘
                   (Recovery Success)
```

## States

### CLOSED (Normal Operation)

- All requests pass through
- Failures are counted
- Opens when failure threshold is reached

### OPEN (Failure Protection)

- All requests are rejected immediately
- No load on failing service
- Automatically transitions to HALF_OPEN after recovery timeout

### HALF_OPEN (Recovery Testing)

- Limited test requests allowed
- Success: Circuit closes
- Failure: Circuit reopens

## Usage

### Basic Circuit Breaker

```typescript
import { CircuitBreaker } from '@/core/resilience';

const breaker = new CircuitBreaker({
  failureThreshold: 5, // Open after 5 failures
  failureWindow: 60000, // Count failures in 1 minute window
  successThreshold: 0.8, // 80% success rate required
  recoveryTimeout: 30000, // Try recovery after 30 seconds
  halfOpenRequests: 3, // Allow 3 test requests
  name: 'api-service',
});

// Execute with protection
try {
  const result = await breaker.execute(async () => {
    return await fetchFromAPI();
  });
} catch (error) {
  if (error.message.includes('Circuit breaker is OPEN')) {
    // Service is down, use fallback
    return getFallbackData();
  }
  throw error;
}
```

### Circuit Breaker Manager

```typescript
import { CircuitBreakerManager } from '@/core/resilience';

const manager = CircuitBreakerManager.getInstance();

// Register service with custom config
manager.register({
  service: 'payment-api',
  failureThreshold: 3,
  recoveryTimeout: 60000,
});

// Execute with automatic breaker
const result = await manager.execute('payment-api', async () => {
  return await processPayment();
});

// Get health status
const health = manager.getHealth();
if (!health.healthy) {
  console.log('Unavailable services:', health.unavailable);
  console.log('Degraded services:', health.degraded);
}
```

### Resilient Connectors

Wrap any connector with circuit breaker protection:

```typescript
import { withResilience } from '@/core/resilience';
import { OpenAIConnector } from '@/connectors/ai';

// Wrap AI connector
const resilientAI = withResilience(new OpenAIConnector(config), {
  failureThreshold: 3,
  recoveryTimeout: 20000,
});

// Use normally - circuit breaker is transparent
const response = await resilientAI.generateResponse(prompt);
```

## Configuration

### Default Settings

```typescript
{
  failureThreshold: 5,      // Failures before opening
  failureWindow: 60000,      // 1 minute window
  successThreshold: 0.8,     // 80% success rate
  recoveryTimeout: 30000,    // 30 seconds recovery
  halfOpenRequests: 3        // Test requests
}
```

### Service-Specific Tuning

Different services need different settings:

#### External APIs

```typescript
{
  failureThreshold: 3,      // Low tolerance
  recoveryTimeout: 60000    // Longer recovery
}
```

#### Internal Services

```typescript
{
  failureThreshold: 10,     // Higher tolerance
  recoveryTimeout: 10000    // Quick recovery
}
```

#### Critical Services

```typescript
{
  failureThreshold: 5,
  halfOpenRequests: 5,      // More testing
  successThreshold: 0.95    // Higher bar
}
```

## Monitoring

### Statistics

```typescript
const stats = breaker.getStats();
console.log({
  state: stats.state,
  failures: stats.failures,
  successes: stats.successes,
  consecutiveFailures: stats.consecutiveFailures,
  totalRequests: stats.totalRequests,
});
```

### Events

Circuit breakers emit events through EventBus:

```typescript
eventBus.on('circuit:open', (data) => {
  // Alert: Service is down
  notifyOps(`Service ${data.name} circuit opened`);
});

eventBus.on('circuit:closed', (data) => {
  // Info: Service recovered
  notifyOps(`Service ${data.name} recovered`);
});

eventBus.on('circuit:half-open', (data) => {
  // Debug: Testing recovery
  logger.info(`Testing ${data.name} recovery`);
});
```

## Best Practices

### 1. Failure Thresholds

- Start conservative (5-10 failures)
- Adjust based on service reliability
- Consider request volume

### 2. Recovery Timeouts

- External services: 30-60 seconds
- Internal services: 10-30 seconds
- Critical paths: 5-15 seconds

### 3. Fallback Strategies

```typescript
async function fetchWithFallback() {
  try {
    return await breaker.execute(() => fetchFromPrimary());
  } catch (error) {
    if (breaker.isOpen()) {
      // Try secondary service
      return await fetchFromSecondary();
    }
    // Or return cached data
    return getCachedData();
  }
}
```

### 4. Manual Control

```typescript
// Force reset during maintenance
breaker.reset();

// Check state before critical operations
if (breaker.isOpen()) {
  await waitForRecovery();
}
```

## Integration Examples

### With Telegram Bot

```typescript
const telegramBreaker = manager.getOrCreate('telegram-api', {
  failureThreshold: 5,
  recoveryTimeout: 20000,
});

async function sendMessage(chatId: string, text: string) {
  return telegramBreaker.execute(async () => {
    await bot.api.sendMessage(chatId, text);
  });
}
```

### With AI Services

```typescript
const aiBreaker = manager.getOrCreate('openai', {
  failureThreshold: 3,
  recoveryTimeout: 30000,
});

async function generateResponse(prompt: string) {
  try {
    return await aiBreaker.execute(() => openai.generateResponse(prompt));
  } catch (error) {
    if (aiBreaker.isOpen()) {
      // Fallback to different model
      return await anthropic.generateResponse(prompt);
    }
    throw error;
  }
}
```

### With Database

```typescript
const dbBreaker = manager.getOrCreate('database', {
  failureThreshold: 10,
  recoveryTimeout: 5000,
});

async function queryDatabase(sql: string) {
  return dbBreaker.execute(async () => {
    const result = await db.execute(sql);
    return result;
  });
}
```

## Testing

```typescript
describe('Service with Circuit Breaker', () => {
  it('should handle service failures gracefully', async () => {
    const service = createServiceWithBreaker();

    // Simulate failures
    for (let i = 0; i < 5; i++) {
      mockAPI.fail();
      await service.call();
    }

    // Circuit should be open
    expect(service.breaker.isOpen()).toBe(true);

    // Requests should fail fast
    await expect(service.call()).rejects.toThrow('Circuit breaker is OPEN');

    // Advance time for recovery
    jest.advanceTimersByTime(30000);

    // Should attempt recovery
    mockAPI.succeed();
    await service.call();

    // Circuit should close
    expect(service.breaker.isClosed()).toBe(true);
  });
});
```

## Performance Impact

- **Overhead**: ~0.1ms per request
- **Memory**: ~1KB per circuit breaker
- **Benefits**: Prevents cascade failures, reduces load on failing services

## Troubleshooting

### Circuit Won't Close

- Check success threshold
- Verify recovery test requests succeed
- Review failure window settings

### Circuit Opens Too Often

- Increase failure threshold
- Extend failure window
- Check for transient network issues

### Circuit Never Opens

- Decrease failure threshold
- Ensure failures are counted correctly
- Verify error propagation

## References

- [Martin Fowler: Circuit Breaker](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Netflix Hystrix](https://github.com/Netflix/Hystrix/wiki)
- [Resilience4j](https://resilience4j.readme.io/)
