# Universal Notification System

A comprehensive notification system with retry logic, batch processing, and user preferences management.

## Features

- 🔄 **Retry Logic**: Automatic retry mechanism for failed notifications
- 📦 **Batch Processing**: Efficient batch sending for mass notifications
- ⚙️ **User Preferences**: Granular control over notification categories
- 🛡️ **Error Handling**: Graceful handling of blocked users and errors
- 📊 **Monitoring**: Built-in Sentry integration for error tracking
- 🌐 **Platform Agnostic**: Easy to adapt for different messaging platforms

## Components

### 1. NotificationService
Main service that manages notification templates and business logic.

**Key features:**
- Template-based message generation
- Support for multiple notification types
- Integration with user preferences
- Auction result notifications

### 2. NotificationConnector
Low-level connector that handles the actual message delivery.

**Key features:**
- Retry mechanism with exponential backoff
- Batch sending with configurable batch size
- Detection of blocked users
- Error tracking and reporting

### 3. User Preferences
Flexible system for managing user notification settings.

**Categories:**
- `auction` - Auction-related notifications
- `balance` - Balance change notifications
- `service` - Service status notifications
- `system` - System announcements

### 4. UI Components
Telegram-specific UI for managing notification settings.

**Features:**
- Toggle all notifications on/off
- Select specific notification categories
- Inline keyboard interface
- Real-time preference updates

## Usage Example

```typescript
// Initialize services
const notificationConnector = new NotificationConnector(telegramConnector);
const notificationService = new NotificationService(notificationConnector, userService);

// Send auction win notification
await notificationService.sendAuctionWinNotification(userId, {
  userId,
  serviceId,
  categoryId,
  position: 1,
  bidAmount: 100,
  roundId,
  timestamp: new Date(),
});

// Send batch notifications
await notificationService.sendBatchNotifications(
  [userId1, userId2, userId3],
  'System maintenance scheduled for tonight',
  'system'
);
```

## Integration Points

1. **Database Schema**
   - `users` table with `notification_enabled` and `notification_categories` columns
   - Support for JSON storage of category preferences

2. **Event System**
   - Integrates with auction processing events
   - Can be extended for other event types

3. **Error Monitoring**
   - Automatic Sentry integration
   - Detailed error context for debugging

## Testing

Comprehensive test suite covering:
- All notification types
- Retry logic
- Batch processing
- User preference management
- Error scenarios

## Migration Guide

To integrate this system into your project:

1. Copy the notification service and connector
2. Add notification columns to your users table
3. Implement the messaging connector interface
4. Add UI components for user preferences
5. Configure notification templates for your use case

## Future Enhancements

- [ ] Email notification support
- [ ] Push notification support
- [ ] Notification scheduling
- [ ] Rich media support
- [ ] Analytics and delivery reports