# Queue Service Migration Guide

## Overview

This guide helps you migrate from the old `QueueService` (with 7 `any` types) to the new fully typed `TypedQueueService` with zero `any` types and complete type safety.

## Key Improvements

### Before (Old Queue Service)

```typescript
// Loose typing, any types allowed
const service = new QueueService(config)
service.registerHandler({
  type: 'user.created',
  handler: async (data: any) => {
    // No type safety
    console.log(data.userId) // Could be undefined
  }
})
```

### After (New Typed Queue Service)

```typescript
// Full type safety with message registry
interface MyMessages extends MessageTypeRegistry {
  'user.created': { userId: string; email: string }
}

const service = createTypedQueueService<MyMessages>(config)
service.registerHandler('user.created', {
  handler: async data => {
    // TypeScript knows the shape!
    console.log(data.userId) // Guaranteed to exist
  }
})
```

## Migration Steps

### Step 1: Define Your Message Registry

Create a centralized type registry for all your queue messages:

```typescript
// src/types/queue-messages.ts
import type { MessageTypeRegistry } from '../services/queue-service-typed'

export interface AppMessageRegistry extends MessageTypeRegistry {
  // User events
  'user.created': {
    userId: string
    email: string
    username: string
    createdAt: Date
  }

  'user.updated': {
    userId: string
    changes: Record<string, unknown>
    updatedBy: string
  }

  // Order events
  'order.placed': {
    orderId: string
    userId: string
    items: Array<{
      productId: string
      quantity: number
      price: number
    }>
    total: number
  }

  // Email events
  'email.send': {
    to: string
    subject: string
    body: string
    template?: string
    variables?: Record<string, unknown>
  }

  // Notification events
  'notification.push': {
    userId: string
    title: string
    body: string
    data?: Record<string, unknown>
  }
}
```

### Step 2: Update Service Initialization

Replace old service creation with typed version:

```typescript
// Before
import { QueueService } from './services/queue-service'

const queueService = new QueueService({
  adapter: cloudflareAdapter,
  logger
})

// After
import { createTypedQueueService } from './services/queue-service-typed'
import { createCloudflareQueueAdapter } from './services/queue-adapters/typed-cloudflare-adapter'
import type { AppMessageRegistry } from './types/queue-messages'

const queueService = createTypedQueueService<AppMessageRegistry>({
  adapter: createCloudflareQueueAdapter({
    queue: env.QUEUE,
    dlqQueue: env.DLQ_QUEUE,
    logger
  }),
  logger,
  enableDLQ: true,
  defaultRetryLimit: 3,
  dlqBackoffStrategy: 'exponential'
})
```

### Step 3: Update Message Handlers

Convert loose handlers to typed handlers:

```typescript
// Before
queueService.registerHandler({
  type: 'user.created',
  handler: async (data: any, context) => {
    // No type safety
    const userId = data.userId // Could be undefined
    await sendWelcomeEmail(data.email) // Runtime error possible
  }
})

// After
queueService.registerHandler('user.created', {
  handler: async (data, context) => {
    // Full type safety - TypeScript knows data shape
    const { userId, email, username } = data
    await sendWelcomeEmail(email) // Compile-time type checking

    // Context is also typed
    logger.info('User created', {
      messageId: context.messageId,
      userId,
      retryCount: context.retryCount
    })
  },
  onError: async (error, data, context) => {
    // Error handler also gets typed data
    logger.error('Failed to process user creation', {
      userId: data.userId,
      error: error.message,
      retryCount: context.retryCount
    })
  },
  retryable: true,
  maxRetries: 3
})
```

### Step 4: Update Message Sending

Replace untyped sends with typed versions:

```typescript
// Before
await queueService.send('user.created', {
  userId: '123',
  email: 'test@example.com'
  // Missing fields not caught
})

// After
await queueService.send('user.created', {
  userId: '123',
  email: 'test@example.com',
  username: 'testuser',
  createdAt: new Date()
  // TypeScript enforces all required fields
})

// Batch sending with type safety
await queueService.sendBatch([
  {
    type: 'email.send',
    data: {
      to: 'user1@example.com',
      subject: 'Welcome!',
      body: 'Welcome to our service'
    }
  },
  {
    type: 'notification.push',
    data: {
      userId: '123',
      title: 'New message',
      body: 'You have a new message'
    }
  }
])
```

### Step 5: Add DLQ Handling

The new service includes built-in DLQ support:

```typescript
// Configure DLQ in service
const queueService = createTypedQueueService<AppMessageRegistry>({
  adapter,
  enableDLQ: true,
  dlqMaxRetries: 5,
  dlqBackoffStrategy: 'exponential'
})

// Process DLQ messages
const dlqResult = await queueService.processDLQ()
console.log(`Reprocessed ${dlqResult.processed} messages from DLQ`)

// Monitor DLQ statistics
const dlqStats = await queueService.getDLQStats()
console.log(`DLQ contains ${dlqStats?.messageCount} messages`)
console.log('Messages by type:', dlqStats?.messagesByType)
```

### Step 6: Update Tests

Replace test implementations with typed versions:

```typescript
// Before
import { QueueService } from '../queue-service'

const mockAdapter = {
  send: vi.fn(),
  receive: vi.fn().mockResolvedValue([])
  // ...
}

const service = new QueueService({ adapter: mockAdapter })

// After
import { createTypedQueueService } from '../queue-service-typed'
import { createMemoryQueueAdapter } from '../queue-adapters/typed-memory-adapter'
import type { AppMessageRegistry } from '../../types/queue-messages'

const adapter = createMemoryQueueAdapter<AppMessageRegistry>({
  simulateLatency: 10,
  maxQueueSize: 100
})

const service = createTypedQueueService<AppMessageRegistry>({
  adapter,
  enableDLQ: true
})

// Type-safe test assertions
await service.send('user.created', {
  userId: '123',
  email: 'test@test.com',
  username: 'testuser',
  createdAt: new Date()
})

const stats = adapter.getStats()
expect(stats.queueSize).toBe(1)
```

## Common Patterns

### Pattern 1: Conditional Message Handling

```typescript
// Define discriminated union messages
interface AppMessageRegistry extends MessageTypeRegistry {
  'payment.process': {
    type: 'credit_card' | 'paypal' | 'crypto'
    amount: number
    currency: string
    metadata: Record<string, unknown>
  }
}

service.registerHandler('payment.process', {
  handler: async data => {
    switch (data.type) {
      case 'credit_card':
        await processCreditCard(data)
        break
      case 'paypal':
        await processPayPal(data)
        break
      case 'crypto':
        await processCrypto(data)
        break
      // TypeScript ensures exhaustive handling
    }
  }
})
```

### Pattern 2: Message Enrichment

```typescript
service.registerHandler('user.created', {
  handler: async (data, context) => {
    // Enrich and forward message
    await queueService.send('email.send', {
      to: data.email,
      subject: 'Welcome!',
      body: await renderTemplate('welcome', {
        username: data.username,
        userId: data.userId
      }),
      template: 'welcome',
      variables: {
        messageId: context.messageId,
        originalTimestamp: context.timestamp
      }
    })
  }
})
```

### Pattern 3: Dead Letter Queue Monitoring

```typescript
// Set up periodic DLQ monitoring
setInterval(async () => {
  const stats = await queueService.getDLQStats()

  if (stats && stats.messageCount > 0) {
    // Alert on DLQ messages
    await alerting.send({
      level: 'warning',
      message: `${stats.messageCount} messages in DLQ`,
      details: stats.messagesByType
    })

    // Attempt to reprocess old messages
    if (stats.oldestMessage) {
      const age = Date.now() - stats.oldestMessage.getTime()
      if (age > 3600000) {
        // 1 hour
        await queueService.processDLQ(10) // Process up to 10 messages
      }
    }
  }
}, 60000) // Check every minute
```

## Gradual Migration Strategy

If you can't migrate everything at once:

### 1. Run Both Services in Parallel

```typescript
// Keep old service for existing code
const oldQueueService = new QueueService(config)

// Use new service for new features
const newQueueService = createTypedQueueService<AppMessageRegistry>(config)

// Gradually migrate handlers
export const queueService = {
  // Proxy methods to appropriate service
  send: (type: string, data: unknown) => {
    if (isNewMessageType(type)) {
      return newQueueService.send(type as any, data)
    }
    return oldQueueService.send(type, data)
  }
}
```

### 2. Migrate by Feature

Start with less critical features:

1. **Phase 1**: Migrate notification messages (low risk)
2. **Phase 2**: Migrate email messages (medium risk)
3. **Phase 3**: Migrate payment messages (high risk)

### 3. Add Type Guards

Create type guards for runtime validation during migration:

```typescript
import { z } from 'zod'

const UserCreatedSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  username: z.string(),
  createdAt: z.date()
})

function isUserCreatedMessage(data: unknown): data is AppMessageRegistry['user.created'] {
  return UserCreatedSchema.safeParse(data).success
}

// Use in mixed environment
if (isUserCreatedMessage(data)) {
  // Type-safe handling
  await handleUserCreated(data)
}
```

## Performance Considerations

The new typed queue service has minimal performance overhead:

- **Type checking**: Compile-time only, no runtime cost
- **Memory usage**: Similar to old service
- **Processing speed**: Same or better due to optimizations
- **DLQ overhead**: Only active when enabled

## Troubleshooting

### Issue: TypeScript Compilation Errors

```typescript
// Error: Type 'string' is not assignable to type 'user.created'
service.send(messageType, data) // messageType is string variable
```

**Solution**: Use type assertions or conditionals:

```typescript
// Option 1: Type assertion (if you're certain)
service.send(messageType as keyof AppMessageRegistry, data)

// Option 2: Type guard
if (messageType === 'user.created') {
  service.send(messageType, data) // TypeScript narrows type
}
```

### Issue: Missing Message Types

```typescript
// Error: Property 'order.cancelled' does not exist
service.send('order.cancelled', data)
```

**Solution**: Add to message registry:

```typescript
interface AppMessageRegistry extends MessageTypeRegistry {
  // ... existing types
  'order.cancelled': {
    orderId: string
    reason: string
    cancelledBy: string
  }
}
```

### Issue: Handler Type Mismatch

```typescript
// Error: Types of parameters 'data' and 'data' are incompatible
service.registerHandler('user.created', {
  handler: oldHandler // From old service
})
```

**Solution**: Wrap old handlers:

```typescript
service.registerHandler('user.created', {
  handler: async (data, context) => {
    // Adapt to old handler signature
    await oldHandler(data, {
      messageId: context.messageId,
      retryCount: context.retryCount,
      timestamp: context.timestamp,
      metadata: context.metadata
    })
  }
})
```

## Benefits After Migration

1. **Type Safety**: Catch errors at compile time
2. **IntelliSense**: Full IDE support for message structures
3. **DLQ Support**: Built-in dead letter queue handling
4. **Better Testing**: Type-safe memory adapter for tests
5. **Performance**: Optimized message processing
6. **Maintainability**: Clear message contracts
7. **Zero `any` Types**: Full type coverage

## Next Steps

After migrating to the typed queue service:

1. Remove old `queue-service.ts` file
2. Update documentation with message registry
3. Add monitoring for DLQ metrics
4. Set up alerts for failed messages
5. Create message schema documentation
6. Add integration tests for critical flows

## Questions?

For questions or issues with migration, check:

- [Queue Service API Docs](./api/queue-service.md)
- [Message Registry Examples](./examples/message-registry.md)
- [DLQ Best Practices](./best-practices/dlq.md)
