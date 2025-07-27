# Universal Notification System

A robust, platform-agnostic notification system with retry logic, batch processing, and user preferences support.

## Features

- 🔄 **Automatic Retry Logic**: Exponential backoff with jitter for failed notifications
- 📦 **Batch Processing**: Efficient handling of bulk notifications
- ⚙️ **User Preferences**: Granular control over notification categories
- 🛡️ **Error Handling**: Graceful handling of blocked users and network errors
- 📊 **Event-driven**: Integration with EventBus for monitoring
- 🌐 **Platform Agnostic**: Easy to adapt for different messaging platforms

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│ NotificationService │────▶│ NotificationConnector│────▶│ Platform Adapter    │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
         │                           │                            │
         │                           ▼                            ▼
         │                   ┌─────────────────┐        ┌─────────────────┐
         └──────────────────▶│   EventBus      │        │ Telegram/Discord │
                             └─────────────────┘        └─────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
npm install grammy  # For Telegram adapter
```

### 2. Basic Setup

```typescript
import { NotificationService } from '@/core/services/notification-service';
import { NotificationConnector } from '@/connectors/notification-connector';
import { TelegramNotificationAdapter } from '@/adapters/telegram/notification-adapter';
import { Bot } from 'grammy';

// Create Telegram bot
const bot = new Bot(process.env.BOT_TOKEN);

// Create adapter
const adapter = new TelegramNotificationAdapter({ bot });

// Create connector with retry logic
const connector = new NotificationConnector({
  adapter,
  storage: env.KV, // Optional: for storing notification status
  logger,
  eventBus,
  retryConfig: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 60000,
    backoffMultiplier: 2,
  },
});

// Create service
const notificationService = new NotificationService({
  connector,
  userPreferenceService, // Optional: for user preferences
  logger,
  eventBus,
});
```

### 3. Send Notifications

```typescript
// Simple notification
await notificationService.send(
  '123456789', // recipientId
  'welcome',   // template
  {
    type: 'user_welcome',
    data: {
      username: 'John',
      service: 'Premium',
    },
  },
  'system', // category
);

// Batch notification
await notificationService.sendBatch(
  ['123456789', '987654321'], // recipientIds
  'announcement',
  {
    type: 'system_announcement',
    data: {
      title: 'New Feature',
      message: 'Check out our new feature!',
    },
  },
  {
    batchSize: 50,
    delayBetweenBatches: 1000,
  },
);
```

## Components

### NotificationService

High-level service for sending notifications with business logic:
- User preference checking
- Template selection
- Event emission

### NotificationConnector

Low-level connector handling:
- Retry logic with exponential backoff
- Batch processing
- Status tracking
- Error handling

### Platform Adapters

Implement `INotificationAdapter` for your platform:

```typescript
export interface INotificationAdapter {
  deliver(recipientId: string, message: FormattedMessage): Promise<void>;
  checkReachability(recipientId: string): Promise<boolean>;
  getUserInfo(recipientId: string): Promise<UserInfo>;
  formatMessage(
    template: NotificationTemplate,
    params: Record<string, any>,
    locale: string,
  ): Promise<FormattedMessage>;
  isRetryableError(error: unknown): boolean;
}
```

## User Preferences

Implement `IUserPreferenceService` to support user preferences:

```typescript
class UserPreferenceService implements IUserPreferenceService {
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    // Fetch from database
    return {
      enabled: true,
      categories: {
        system: true,
        transaction: true,
        marketing: false,
        // ...
      },
    };
  }
}
```

## Events

The system emits events for monitoring:

```typescript
eventBus.on('notification:sent', (data) => {
  console.log('Notification sent:', data);
});

eventBus.on('notification:failed', (data) => {
  console.log('Notification failed:', data);
});

eventBus.on('notification:batch:completed', (data) => {
  console.log('Batch completed:', data);
});
```

## Templates

Create notification templates:

```typescript
const templates: Record<string, NotificationTemplate> = {
  welcome: {
    id: 'welcome',
    name: 'User Welcome',
    category: 'system',
    content: {
      en: {
        body: 'Welcome {{username}}! Your {{service}} is now active.',
        parseMode: 'HTML',
        buttons: [[
          { text: 'Get Started', url: 'https://example.com/start' },
        ]],
      },
      es: {
        body: '¡Bienvenido {{username}}! Tu {{service}} está activo.',
        parseMode: 'HTML',
      },
    },
  },
};
```

## Error Handling

The system handles various error scenarios:

1. **User Blocked**: Marked as `BLOCKED` status, no retry
2. **Network Errors**: Automatic retry with backoff
3. **Rate Limits**: Respects platform rate limits
4. **Invalid Recipients**: Logged and skipped

## Testing

```typescript
import { createMockAdapter } from '@/test-utils';

const mockAdapter = createMockAdapter({
  deliver: vi.fn().mockResolvedValue(undefined),
  checkReachability: vi.fn().mockResolvedValue(true),
});

// Test retry logic
mockAdapter.deliver.mockRejectedValueOnce(new Error('Network error'));
mockAdapter.isRetryableError.mockReturnValue(true);

// Should retry and succeed
await connector.send(message);
expect(mockAdapter.deliver).toHaveBeenCalledTimes(2);
```

## Production Considerations

1. **Rate Limiting**: Implement rate limiting in adapters
2. **Monitoring**: Use EventBus events for metrics
3. **Storage**: Use KV/Database for notification history
4. **Scaling**: Batch processing for large recipient lists
5. **Localization**: Support multiple languages in templates

## Contributing

When adding new platform adapters:
1. Implement `INotificationAdapter` interface
2. Handle platform-specific errors
3. Support platform features (buttons, media, etc.)
4. Add comprehensive tests
5. Document platform-specific considerations