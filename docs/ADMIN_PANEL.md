# Admin Panel Pattern

A production-ready web-based admin panel for managing bots built with Wireframe. This pattern provides secure authentication, real-time statistics, and management capabilities through a responsive web interface.

## Overview

The Admin Panel pattern enables bot developers to add a professional web-based administration interface to their bots without external dependencies. It's designed specifically for Cloudflare Workers environment and supports multiple messaging platforms.

## Key Features

- 🔐 **Secure Authentication**: Platform-based 2FA using temporary tokens
- 🌐 **Web Interface**: Clean, responsive HTML interface (no build tools required)
- 📊 **Real-time Stats**: Monitor users, messages, and system health
- 🔌 **Platform Agnostic**: Works with Telegram, Discord, Slack, etc.
- 🎯 **Event-driven**: Full EventBus integration for audit logging
- 🚀 **Production Ready**: Battle-tested in real applications

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Browser   │────▶│  Admin Routes   │────▶│   KV Storage    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                         │
         │                       ▼                         │
         │              ┌─────────────────┐               │
         └─────────────▶│  Auth Service   │◀──────────────┘
                        └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Platform Adapter│
                        └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Bot (Telegram) │
                        └─────────────────┘
```

## Quick Start

### 1. Basic Setup

```typescript
import {
  createAdminPanel,
  TelegramAdminAdapter,
  type AdminPanelConfig,
} from '@/patterns/admin-panel';

// Configure admin panel
const adminConfig: AdminPanelConfig = {
  baseUrl: 'https://your-bot.workers.dev',
  sessionTTL: 86400, // 24 hours
  tokenTTL: 300, // 5 minutes
  maxLoginAttempts: 3,
  features: {
    dashboard: true,
    userManagement: true,
    analytics: true,
  },
};

// Create admin panel
const adminPanel = createAdminPanel({
  storage: kvStorage,
  database: d1Database,
  eventBus,
  logger,
  config: adminConfig,
  platformAdapter: telegramAdapter,
});
```

### 2. Integrate with Your Bot

```typescript
// Handle admin routes
app.all('/admin/*', async (c) => {
  return adminPanel.connector.handleRequest(c.req.raw);
});

// Register admin commands
telegramAdapter.registerCommands();
```

### 3. Authentication Flow

1. Admin uses `/admin` command in bot
2. Bot generates temporary 6-digit code
3. Admin visits web panel and enters credentials
4. Session created with 24-hour expiration

## Components

### Core Services

#### AdminPanelService

Main service coordinating all admin panel functionality:

- Route handling
- Session management
- Statistics gathering
- Event emission

#### AdminAuthService

Handles authentication and authorization:

- Token generation and validation
- Session creation and management
- Cookie handling
- Permission checking

#### AdminPanelConnector

EventBus integration for the admin panel:

- Lifecycle management
- Event routing
- Health monitoring
- Metrics collection

### Platform Adapters

Platform adapters handle platform-specific authentication and communication:

#### TelegramAdminAdapter

```typescript
const telegramAdapter = new TelegramAdminAdapter({
  bot,
  adminService,
  config,
  logger,
  adminIds: [123456789, 987654321], // Telegram user IDs
});
```

### Route Handlers

#### LoginHandler

- Displays login form
- Validates auth tokens
- Creates sessions

#### DashboardHandler

- Shows system statistics
- Displays quick actions
- Real-time monitoring

#### LogoutHandler

- Invalidates sessions
- Clears cookies
- Audit logging

### Template Engine

The template engine generates clean, responsive HTML without external dependencies:

```typescript
const templateEngine = new AdminTemplateEngine();

// Render dashboard
const html = templateEngine.renderDashboard(stats, adminUser);

// Render custom page
const customHtml = templateEngine.renderLayout({
  title: 'User Management',
  content: userListHtml,
  user: adminUser,
});
```

## Security

### Authentication

- Temporary tokens expire in 5 minutes
- One-time use tokens (deleted after validation)
- Max login attempts protection
- Platform-specific user verification

### Sessions

- Secure HTTP-only cookies
- Configurable TTL
- Automatic expiration
- Activity tracking

### Authorization

- Role-based permissions
- Wildcard support (`*` for full access)
- Per-route authorization
- Platform verification

## Customization

### Adding Custom Routes

```typescript
class UserManagementHandler implements IAdminRouteHandler {
  canHandle(path: string, method: string): boolean {
    return path.startsWith('/admin/users');
  }

  async handle(request: Request, context: AdminRouteContext): Promise<Response> {
    if (!context.adminUser) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Handle user management logic
    const users = await this.getUserList();
    const html = this.renderUserList(users);

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

// Register handler
adminService.registerRouteHandler('/admin/users', userHandler);
```

### Custom Statistics

```typescript
async getStats(): Promise<AdminPanelStats> {
  const stats = await adminService.getStats();

  // Add custom stats
  stats.customStats = {
    activeSubscriptions: await getActiveSubscriptionCount(),
    pendingPayments: await getPendingPaymentCount(),
    dailyRevenue: await getDailyRevenue(),
  };

  return stats;
}
```

### Styling

The template engine includes built-in responsive styles. To customize:

```typescript
const html = templateEngine.renderLayout({
  title: 'Custom Page',
  content: pageContent,
  styles: [
    `
    .custom-element {
      background: #f0f0f0;
      padding: 1rem;
    }
  `,
  ],
});
```

## Events

The admin panel emits various events for monitoring and audit logging:

```typescript
eventBus.on(AdminPanelEvent.AUTH_LOGIN_SUCCESS, (data) => {
  console.log('Admin logged in:', data.adminId);
});

eventBus.on(AdminPanelEvent.ACTION_PERFORMED, (data) => {
  await auditLog.record({
    userId: data.userId,
    action: data.action,
    resource: data.resource,
    timestamp: data.timestamp,
  });
});
```

### Available Events

- `AUTH_TOKEN_GENERATED` - Auth token created
- `AUTH_LOGIN_SUCCESS` - Successful login
- `AUTH_LOGIN_FAILED` - Failed login attempt
- `SESSION_CREATED` - New session started
- `SESSION_EXPIRED` - Session timed out
- `PANEL_ACCESSED` - Panel page viewed
- `ACTION_PERFORMED` - Admin action taken

## Database Schema

Recommended schema for statistics:

```sql
-- User tracking
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  platform_id TEXT UNIQUE NOT NULL,
  platform TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message logging
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Activity tracking
CREATE TABLE user_activity (
  user_id INTEGER PRIMARY KEY,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_activity_timestamp ON user_activity(last_activity);
```

## Testing

The pattern includes comprehensive tests:

```typescript
import { describe, it, expect } from 'vitest';
import { AdminAuthService } from '@/core/services/admin-auth-service';

describe('AdminAuthService', () => {
  it('should generate valid auth token', async () => {
    const token = await authService.generateAuthToken('123');
    expect(token).toMatch(/^[A-Z0-9]{6}$/);
  });
});
```

## Production Deployment

### Environment Variables

```toml
# wrangler.toml
[vars]
ADMIN_URL = "https://your-bot.workers.dev"
BOT_ADMIN_IDS = [123456789, 987654321]

[[kv_namespaces]]
binding = "KV"
id = "your-kv-id"

[[d1_databases]]
binding = "DB"
database_name = "bot-db"
database_id = "your-d1-id"
```

### Security Checklist

- [ ] Set strong `TELEGRAM_WEBHOOK_SECRET`
- [ ] Configure `BOT_ADMIN_IDS` with authorized users
- [ ] Use HTTPS for `ADMIN_URL`
- [ ] Enable CORS only for trusted origins
- [ ] Monitor failed login attempts
- [ ] Set up alerts for suspicious activity

## Troubleshooting

### Common Issues

**Auth token not working**

- Check token hasn't expired (5 min TTL)
- Verify admin ID matches
- Check KV storage is accessible

**Session not persisting**

- Verify cookies are enabled
- Check session TTL configuration
- Ensure KV namespace is bound

**Stats not showing**

- Verify D1 database is connected
- Check table schema matches
- Ensure queries have proper indexes

## Future Enhancements

- [ ] Multi-factor authentication
- [ ] Role management UI
- [ ] Log viewer interface
- [ ] Webhook management
- [ ] Backup/restore functionality
- [ ] API rate limiting dashboard

## Related Documentation

- [Notification System](./NOTIFICATION_SYSTEM.md) - Send admin alerts
- [Database Patterns](./patterns/002-database-field-mapping.md) - Type-safe DB access
- [Cloudflare Workers Guide](https://developers.cloudflare.com/workers/)

## Contributing

The Admin Panel pattern was contributed from production experience with the Kogotochki bot. To contribute improvements:

1. Test in a real bot implementation
2. Ensure platform independence
3. Add comprehensive tests
4. Update documentation
5. Submit PR with examples
