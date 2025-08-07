# 📡 API Reference

## Telegram Webhook Types

### Core Update Type

```typescript
interface TelegramUpdate {
  update_id: number
  message?: Message
  edited_message?: Message
  channel_post?: Message
  edited_channel_post?: Message
  callback_query?: CallbackQuery
  inline_query?: InlineQuery
  chosen_inline_result?: ChosenInlineResult
  shipping_query?: ShippingQuery
  pre_checkout_query?: PreCheckoutQuery
  poll?: Poll
  poll_answer?: PollAnswer
  my_chat_member?: ChatMemberUpdated
  chat_member?: ChatMemberUpdated
}
```

### Message Type

```typescript
interface Message {
  message_id: number
  from?: User
  date: number
  chat: Chat
  text?: string
  entities?: MessageEntity[]
  reply_to_message?: Message
  // ... 40+ more fields
}
```

## Webhook Request/Response Flow

### Incoming Webhook Request

```http
POST /webhook
Content-Type: application/json
X-Telegram-Bot-Api-Secret-Token: your-secret-token

{
  "update_id": 123456789,
  "message": {
    "message_id": 1,
    "from": {
      "id": 123456789,
      "is_bot": false,
      "first_name": "John",
      "username": "johndoe"
    },
    "chat": {
      "id": 123456789,
      "first_name": "John",
      "username": "johndoe",
      "type": "private"
    },
    "date": 1699564800,
    "text": "/start"
  }
}
```

### Expected Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "method": "sendMessage",
  "chat_id": 123456789,
  "text": "Welcome! I'm your bot assistant.",
  "parse_mode": "HTML",
  "reply_markup": {
    "inline_keyboard": [[
      {"text": "Get Started", "callback_data": "start"},
      {"text": "Help", "callback_data": "help"}
    ]]
  }
}
```

## Command Handling

### Command Registration

```typescript
// In src/adapters/telegram/commands/index.ts
bot.command('start', startCommand)
bot.command('help', helpCommand)
bot.command('settings', settingsCommand)

// Admin commands
bot.command('admin', requireAdmin, adminCommand)
bot.command('stats', requireAdmin, statsCommand)

// Owner commands
bot.command('debug', requireOwner, debugCommand)
bot.command('info', requireOwner, infoCommand)
```

### Command Handler Interface

```typescript
type CommandHandler = (ctx: BotContext) => Promise<void>

interface BotContext extends Context {
  env: Env
  session: SessionData
  i18n: (key: string, params?: Record<string, any>) => string
}
```

## Callback Query Handling

### Callback Data Format

```typescript
// Format: "action:subaction:id:params"
// Examples:
'menu:main'
'settings:language:ru'
'access:approve:123456'
'page:2:search:telegram'
```

### Callback Handler

```typescript
bot.callbackQuery(/^menu:/, menuCallback)
bot.callbackQuery(/^settings:/, settingsCallback)
bot.callbackQuery(/^access:/, accessCallback)
```

## Error Handling

### Error Response Format

```typescript
interface ErrorResponse {
  ok: false
  error_code: number
  description: string
}
```

### Common Error Codes

| Code | Description       | Solution                            |
| ---- | ----------------- | ----------------------------------- |
| 400  | Bad Request       | Check request format and parameters |
| 401  | Unauthorized      | Verify bot token                    |
| 403  | Forbidden         | Check bot permissions in chat       |
| 404  | Not Found         | Verify chat/user exists             |
| 409  | Conflict          | Webhook already set, unset first    |
| 429  | Too Many Requests | Implement rate limiting             |

### Error Handling Example

```typescript
try {
  await ctx.reply('Hello!')
} catch (error) {
  if (error.error_code === 403) {
    // Bot was blocked by user
    await markUserAsBlocked(ctx.from.id)
  } else if (error.error_code === 429) {
    // Rate limited
    await addToRetryQueue(ctx)
  } else {
    // Unknown error
    throw error
  }
}
```

## Rate Limiting

### Telegram API Limits

- **Global**: 30 messages/second
- **Per Chat**: 1 message/second
- **Per Chat Burst**: 20 messages/minute
- **Bulk Messages**: 50 messages/request

### Implementation

```typescript
// Built-in rate limiter
const limiter = createRateLimiter({
  windowMs: 1000,
  max: 30,
  keyGenerator: ctx => ctx.from?.id || 'anonymous'
})

bot.use(limiter)
```

## Environment Variables

### Required Variables

```typescript
interface Env {
  // Core
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_WEBHOOK_SECRET?: string
  ENVIRONMENT: 'development' | 'staging' | 'production'

  // Storage
  SESSIONS: KVNamespace
  DB?: D1Database
  CACHE?: DurableObjectNamespace

  // Features
  TIER?: 'free' | 'paid'
  SENTRY_DSN?: string
  BOT_OWNER_IDS?: string
  BOT_ADMIN_IDS?: string

  // AI Providers
  GEMINI_API_KEY?: string
  OPENAI_API_KEY?: string
  XAI_API_KEY?: string
  DEEPSEEK_API_KEY?: string
}
```

### Validation with Zod

```typescript
const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  ENVIRONMENT: z.enum(['development', 'staging', 'production']),
  TIER: z.enum(['free', 'paid']).default('free')
  // ... more validations
})
```

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  is_blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Access Control Tables

```sql
CREATE TABLE user_roles (
  user_id INTEGER PRIMARY KEY,
  role TEXT CHECK(role IN ('owner', 'admin', 'user')),
  granted_by TEXT,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE access_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  resolved_by INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Session Management

### Session Structure

```typescript
interface SessionData {
  userId?: number
  username?: string
  languageCode?: string
  lastCommand?: string
  lastActivity?: number
  customData?: Record<string, any>
}
```

### KV Operations

```typescript
// Save session
await ctx.env.SESSIONS.put(
  `session:${userId}`,
  JSON.stringify(sessionData),
  { expirationTtl: 86400 } // 24 hours
)

// Load session
const data = await ctx.env.SESSIONS.get(`session:${userId}`)
const session = data ? JSON.parse(data) : createNewSession()

// Delete session
await ctx.env.SESSIONS.delete(`session:${userId}`)
```

## Webhook Security

### Validation Method

```typescript
function validateWebhookSecret(request: Request, secret: string): boolean {
  const token = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
  return token === secret
}
```

### IP Whitelisting (Optional)

```typescript
const TELEGRAM_IPS = [
  '149.154.160.0/20',
  '91.108.4.0/22'
  // ... more ranges
]

function validateTelegramIP(ip: string): boolean {
  return TELEGRAM_IPS.some(range => isInRange(ip, range))
}
```

## Testing Webhooks

### Local Development

```bash
# Wrangler provides a tunnel
npm run dev

# Your webhook URL will be:
# https://[random].ngrok.io/webhook
```

### Manual Testing

```bash
# Send test update
curl -X POST http://localhost:8787/webhook \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: test-secret" \
  -d '{
    "update_id": 1,
    "message": {
      "message_id": 1,
      "from": {"id": 123, "first_name": "Test"},
      "chat": {"id": 123, "type": "private"},
      "date": 1234567890,
      "text": "/start"
    }
  }'
```

## Best Practices

1. **Always validate webhook data** with Zod schemas
2. **Handle all error cases** gracefully
3. **Respect rate limits** with built-in limiters
4. **Use transactions** for database operations
5. **Cache aggressively** but with TTLs
6. **Log important events** to Sentry
7. **Test webhook handlers** thoroughly

---

_For the complete Telegram Bot API documentation, visit [core.telegram.org/bots/api](https://core.telegram.org/bots/api)_
