# Wireframe Notification System

Universal notification system for the Wireframe platform with support for multiple messaging platforms.

## Features

- **Platform-agnostic design** - Works with any messaging platform
- **Retry logic** - Automatic retry with exponential backoff
- **Batch processing** - Efficient bulk notifications
- **User preferences** - Respect user notification settings
- **Event-driven** - Full event tracking for monitoring
- **TypeScript 100% strict** - Type-safe implementation

## Architecture

The notification system consists of three main components:

1. **NotificationService** - High-level business logic
2. **NotificationConnector** - Handles delivery, retries, and batching
3. **NotificationAdapter** - Platform-specific implementation

```
┌─────────────────────┐
│ NotificationService │ (Business Logic)
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│NotificationConnector│ (Delivery & Retry)
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ NotificationAdapter │ (Platform-Specific)
└─────────────────────┘
```

## Installation

```bash
npm install @wireframe/notification-system
```

## Quick Start

### 1. Implement a Platform Adapter

```typescript
import { INotificationAdapter } from '@wireframe/notification-system';

class MyPlatformAdapter implements INotificationAdapter {
  async formatMessage(template, params, locale) {
    // Format message for your platform
  }

  async deliver(recipientId, message) {
    // Send message via your platform
  }

  async checkReachability(recipientId) {
    // Check if user is reachable
  }

  isRetryableError(error) {
    // Determine if error should trigger retry
  }

  async getUserInfo(recipientId) {
    // Get user locale/timezone/preferences
  }
}
```

### 2. Create Notification Service

```typescript
import {
  NotificationService,
  NotificationConnector,
  EventBus,
} from '@wireframe/notification-system';

const eventBus = new EventBus();
const adapter = new MyPlatformAdapter();

const connector = new NotificationConnector({
  adapter,
  logger: console,
  eventBus,
  retryConfig: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 60000,
    backoffMultiplier: 2,
  },
});

const notificationService = new NotificationService({
  connector,
  logger: console,
  eventBus,
});
```

### 3. Send Notifications

```typescript
// Single notification
await notificationService.send(
  'user123',
  'welcome',
  {
    type: 'user_onboarding',
    data: { username: 'John' },
  },
  NotificationCategory.SYSTEM,
);

// Batch notifications
await notificationService.sendBatch(
  ['user1', 'user2', 'user3'],
  'announcement',
  {
    type: 'product_update',
    data: { feature: 'Dark Mode' },
  },
  { batchSize: 50, delayBetweenBatches: 1000 },
);
```

## Platform Adapters

### Telegram Adapter

See [examples/telegram-notifications.ts](examples/telegram-notifications.ts) for a complete example.

```typescript
import { TelegramNotificationAdapter } from '@wireframe/notification-system/adapters/telegram';

const adapter = new TelegramNotificationAdapter({
  bot: grammyBot,
  defaultLocale: 'en',
});
```

## Events

The notification system emits the following events:

- `notification:sent` - Successfully sent notification
- `notification:failed` - Failed to send notification
- `notification:blocked` - User blocked or unreachable
- `notification:batch:started` - Batch processing started
- `notification:batch:progress` - Batch processing progress
- `notification:batch:completed` - Batch processing completed

```typescript
eventBus.on('notification:sent', (event) => {
  console.log('Sent to:', event.recipientId);
});

eventBus.on('notification:failed', (event) => {
  console.error('Failed:', event.error);
});
```

## User Preferences

Integrate with your user preference service:

```typescript
class MyUserPreferenceService implements IUserPreferenceService {
  async getNotificationPreferences(userId) {
    return {
      enabled: true,
      categories: {
        [NotificationCategory.SYSTEM]: true,
        [NotificationCategory.MARKETING]: false,
      },
      quiet_hours: {
        enabled: true,
        start: '22:00',
        end: '08:00',
        timezone: 'UTC',
      },
    };
  }
}

const notificationService = new NotificationService({
  connector,
  userPreferenceService: new MyUserPreferenceService(),
  logger,
  eventBus,
});
```

## Templates

Define notification templates with localization:

```typescript
const template: NotificationTemplate = {
  id: 'welcome',
  name: 'Welcome Message',
  category: NotificationCategory.SYSTEM,
  content: {
    en: {
      subject: 'Welcome!',
      body: 'Welcome {{username}}! Thanks for joining.',
      actions: [
        {
          type: 'button',
          label: 'Get Started',
          url: '/tutorial',
        },
      ],
    },
    es: {
      subject: '¡Bienvenido!',
      body: '¡Bienvenido {{username}}! Gracias por unirte.',
      actions: [
        {
          type: 'button',
          label: 'Comenzar',
          url: '/tutorial',
        },
      ],
    },
  },
  variables: [
    {
      name: 'username',
      type: 'string',
      required: true,
    },
  ],
};
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint

# Build
npm run build
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Write tests for your changes
4. Ensure all tests pass and no TypeScript errors
5. Submit a pull request

## License

MIT
