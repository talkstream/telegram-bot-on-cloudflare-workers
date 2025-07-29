# Queue Service Pattern

This document describes the queue service implementation that provides a platform-agnostic way to handle asynchronous task processing with batch support and retry logic.

## Overview

The Queue Service pattern allows you to decouple time-consuming operations from your main application flow by processing them asynchronously through a message queue. This is particularly useful for:

- Sending notifications
- Processing payments
- Generating reports
- Handling webhooks
- Batch data processing
- Any operation that doesn't need immediate response

## Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Producer  │ ---> │    Queue    │ ---> │  Consumer   │
│  (sends)    │      │  (stores)   │      │ (processes) │
└─────────────┘      └─────────────┘      └─────────────┘
                            │
                            v
                     ┌─────────────┐
                     │   Adapter   │
                     │ (platform)  │
                     └─────────────┘
```

## Basic Usage

```typescript
import { QueueService } from '@/services/queue-service';
import { CloudflareQueueAdapter } from '@/services/queue-adapters/cloudflare-queue-adapter';

// Initialize queue service
const queueService = new QueueService({
  adapter: new CloudflareQueueAdapter(env.QUEUE),
  logger: logger,
  defaultRetryLimit: 3,
  defaultRetryDelay: 30,
});

// Register message handlers
queueService.registerHandler({
  type: 'send-email',
  handler: async (data, context) => {
    await emailService.send(data.to, data.subject, data.body);
    logger.info('Email sent', { messageId: context.messageId });
  },
});

// Send messages
await queueService.send('send-email', {
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Thanks for signing up!',
});
```

## Typed Queue Service

For better type safety, use the typed variant:

```typescript
// Define your message types
interface AppMessage {
  type: 'notification' | 'payment' | 'analytics';
  data: {
    notification?: { userId: string; message: string };
    payment?: { orderId: string; amount: number };
    analytics?: { event: string; properties: Record<string, any> };
  };
}

// Create typed service
const typedQueue = QueueService.typed<AppMessage>({
  adapter: new MemoryQueueAdapter(),
});

// Type-safe handler registration
typedQueue.registerTypedHandler('notification', async (data, context) => {
  // data is correctly typed as { notification?: {...} }
  if (data.notification) {
    await notifyUser(data.notification.userId, data.notification.message);
  }
});

// Type-safe message sending
await typedQueue.sendTyped({
  type: 'notification',
  data: {
    notification: {
      userId: '123',
      message: 'Your order is ready!',
    },
  },
});
```

## Batch Processing

Process multiple messages efficiently:

```typescript
// Send batch of messages
await queueService.sendBatch([
  { type: 'email', data: { to: 'user1@example.com', subject: 'Hello' } },
  { type: 'email', data: { to: 'user2@example.com', subject: 'Hello' } },
  { type: 'email', data: { to: 'user3@example.com', subject: 'Hello' } },
]);

// Process messages in batches
const result = await queueService.processMessages(10); // Process up to 10 messages
console.log(`Processed: ${result.processed}, Failed: ${result.failed}`);
```

## Retry Logic

Messages that fail processing are automatically retried:

```typescript
queueService.registerHandler({
  type: 'payment',
  handler: async (data, context) => {
    // Context provides retry information
    if (context.retryCount > 0) {
      logger.warn(`Retrying payment (attempt ${context.retryCount + 1})`);
    }

    try {
      await paymentGateway.charge(data.amount);
    } catch (error) {
      // Message will be retried automatically
      throw new Error(`Payment failed: ${error.message}`);
    }
  },
});
```

## Continuous Processing

For workers that continuously process messages:

```typescript
// Start continuous processing
const stop = await queueService.startProcessing({
  pollInterval: 5000, // Check for new messages every 5 seconds
  maxMessages: 10, // Process up to 10 messages per poll
  onError: (error) => {
    logger.error('Queue processing error', { error });
    // Could trigger alerts here
  },
});

// Stop processing when needed
process.on('SIGTERM', () => {
  stop();
  process.exit(0);
});
```

## Platform Adapters

### Cloudflare Queue Adapter

For Cloudflare Workers with Queues:

```typescript
// In your worker
export default {
  async queue(batch: MessageBatch, env: Env) {
    const queueService = new QueueService({
      adapter: new CloudflareQueueAdapter(env.QUEUE),
    });

    // Register handlers
    queueService.registerHandler({
      type: 'notification',
      handler: notificationHandler,
    });

    // Process the batch
    const handler = createCloudflareQueueHandler(queueService);
    await handler(batch);
  },
};
```

### Memory Queue Adapter

For testing and development:

```typescript
const adapter = new MemoryQueueAdapter();
const queueService = new QueueService({ adapter });

// Use in tests
await queueService.send('test', { value: 'data' });
const stats = adapter.getStats();
expect(stats.pending).toBe(1);
```

### Custom Adapters

Create adapters for other platforms:

```typescript
class SQSQueueAdapter implements QueueAdapter {
  constructor(
    private sqs: AWS.SQS,
    private queueUrl: string,
  ) {}

  async send(message: QueueMessage): Promise<void> {
    await this.sqs
      .sendMessage({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
      })
      .promise();
  }

  async receive(maxMessages: number): Promise<ReceivedMessage[]> {
    const result = await this.sqs
      .receiveMessage({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: maxMessages,
      })
      .promise();

    return (result.Messages || []).map(
      (msg) => new SQSReceivedMessage(msg, this.sqs, this.queueUrl),
    );
  }
}
```

## Error Handling

Comprehensive error handling with context:

```typescript
queueService.registerHandler({
  type: 'risky-operation',
  handler: async (data, context) => {
    try {
      await riskyOperation(data);
    } catch (error) {
      // Log with context
      logger.error('Operation failed', {
        error,
        messageId: context.messageId,
        retryCount: context.retryCount,
        data,
      });

      // Decide whether to retry
      if (error.code === 'RATE_LIMIT' && context.retryCount < 1) {
        throw error; // Will retry
      } else {
        // Don't retry, log and continue
        await deadLetterQueue.send('risky-operation-failed', {
          originalData: data,
          error: error.message,
          context,
        });
      }
    }
  },
});
```

## Monitoring and Statistics

Track queue performance:

```typescript
// Get processing statistics
const stats = queueService.getStats();
console.log({
  processed: stats.totalProcessed,
  failed: stats.totalFailed,
  retried: stats.totalRetried,
  successRate: (stats.totalProcessed / (stats.totalProcessed + stats.totalFailed)) * 100,
});

// Reset statistics periodically
setInterval(() => {
  const stats = queueService.getStats();
  await metricsService.record('queue.processed', stats.totalProcessed);
  await metricsService.record('queue.failed', stats.totalFailed);
  queueService.resetStats();
}, 60000);
```

## Best Practices

1. **Message Design**
   - Keep messages small and focused
   - Include all necessary data (don't rely on external state)
   - Use message types to categorize operations
   - Add metadata for tracking and debugging

2. **Handler Implementation**
   - Make handlers idempotent (safe to retry)
   - Handle partial failures gracefully
   - Log important steps with context
   - Set appropriate retry limits

3. **Performance**
   - Batch similar operations when possible
   - Use appropriate poll intervals
   - Monitor queue depth and processing time
   - Scale consumers based on queue metrics

4. **Error Handling**
   - Distinguish between retryable and non-retryable errors
   - Use dead letter queues for failed messages
   - Alert on high failure rates
   - Include context in error logs

## Integration with Wireframe

The queue service integrates seamlessly with Wireframe's architecture:

```typescript
import { PlatformContext } from '@/core/platform-context';
import { QueueService } from '@/services/queue-service';

export class NotificationService {
  private queue: QueueService;

  constructor(private ctx: PlatformContext) {
    this.queue = new QueueService({
      adapter: ctx.platform.getQueueAdapter(),
      logger: ctx.logger,
    });

    this.registerHandlers();
  }

  private registerHandlers() {
    this.queue.registerHandler({
      type: 'send-notification',
      handler: async (data, context) => {
        const connector = this.ctx.getMessagingConnector();
        await connector.sendMessage(data.userId, data.message);
      },
    });
  }

  async notifyUser(userId: string, message: string) {
    await this.queue.send('send-notification', { userId, message });
  }
}
```

## Migration Example

Migrating from synchronous to asynchronous processing:

```typescript
// Before - Synchronous
async function handleOrder(order: Order) {
  await validateOrder(order);
  await chargePayment(order);
  await sendConfirmationEmail(order); // Slow!
  await updateInventory(order);
  return { success: true };
}

// After - Asynchronous with queue
async function handleOrder(order: Order) {
  await validateOrder(order);
  await chargePayment(order);

  // Queue slow operations
  await queueService.sendBatch([
    { type: 'send-email', data: { orderId: order.id, type: 'confirmation' } },
    { type: 'update-inventory', data: { items: order.items } },
  ]);

  return { success: true };
}
```

The queue service provides a robust foundation for handling asynchronous operations across different platforms while maintaining consistency and reliability.
