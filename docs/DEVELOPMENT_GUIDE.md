# 🛠️ Development Guide

## Prerequisites

- **Node.js** 18.x or higher
- **npm** 8.x or higher
- **Git**
- **Telegram Bot Token** (from [@BotFather](https://t.me/botfather))
- **Cloudflare Account** (free tier is fine)

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/talkstream/typescript-wireframe-platform.git my-bot
cd my-bot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create `.dev.vars` for local development:

```bash
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBHOOK_SECRET=your-secret-string
ENVIRONMENT=development

# Optional
TIER=free
BOT_OWNER_IDS=123456789
SENTRY_DSN=your_sentry_dsn
GEMINI_API_KEY=your_gemini_key
```

### 4. Set Up Cloudflare Resources

#### Create KV Namespace (for sessions)

```bash
# Create namespace
wrangler kv:namespace create "SESSIONS"

# Add to wrangler.toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "your-namespace-id"
```

#### Create D1 Database (optional)

```bash
# Create database
wrangler d1 create telegram-bot-db

# Add to wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "telegram-bot-db"
database_id = "your-database-id"

# Run migrations
npm run db:apply:local
```

## Local Development

### Starting the Dev Server

```bash
npm run dev
```

This starts:

- Local Workers runtime
- HTTPS tunnel (via Wrangler)
- Hot reload on file changes

### Setting the Webhook

```bash
# Get your tunnel URL from wrangler output
# Example: https://abc123.ngrok.io

# Set webhook
curl "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://abc123.ngrok.io/webhook&secret_token=your-secret-string"
```

### Verifying Webhook

```bash
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo"
```

## Project Structure Deep Dive

### Core Components

#### `src/index.ts` - Entry Point

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Route handling
    if (url.pathname === '/webhook') {
      return handleWebhook(request, env, ctx)
    }
    // ... other routes
  }
}
```

#### `src/core/telegram-adapter.ts` - Main Logic

```typescript
export class TelegramAdapter {
  constructor(bot: Bot<BotContext>, env: Env) {
    this.setupMiddleware()
    this.registerCommands()
    this.registerCallbacks()
  }
}
```

### Adding New Commands

1. Create command file:

```typescript
// src/adapters/telegram/commands/weather.ts
import type { CommandHandler } from '@/types'

export const weatherCommand: CommandHandler = async ctx => {
  const city = ctx.match || 'London'

  // Fetch weather data
  const weather = await getWeather(city)

  // Send response
  await ctx.reply(`Weather in ${city}: ${weather.temp}°C`, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔄 Refresh', callback_data: `weather:refresh:${city}` },
          { text: '📍 Change City', callback_data: 'weather:change' }
        ]
      ]
    }
  })
}
```

2. Register in `src/adapters/telegram/commands/index.ts`:

```typescript
bot.command('weather', weatherCommand)
```

### Adding Callback Handlers

```typescript
// src/adapters/telegram/callbacks/weather.ts
bot.callbackQuery(/^weather:/, async ctx => {
  const [, action, city] = ctx.callbackQuery.data.split(':')

  switch (action) {
    case 'refresh':
      await updateWeather(ctx, city)
      break
    case 'change':
      await askForCity(ctx)
      break
  }

  await ctx.answerCallbackQuery()
})
```

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Writing Tests

```typescript
// src/__tests__/commands/weather.test.ts
import { describe, it, expect, vi } from 'vitest'
import { weatherCommand } from '@/adapters/telegram/commands/weather'
import { createMockContext } from '../utils/mock-context'

describe('Weather Command', () => {
  it('should return weather for specified city', async () => {
    const ctx = createMockContext()
    ctx.match = 'Paris'

    await weatherCommand(ctx)

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Weather in Paris'),
      expect.any(Object)
    )
  })
})
```

### Integration Testing

```typescript
// Test with real Telegram API (be careful with rate limits)
const testUpdate = {
  update_id: 1,
  message: {
    message_id: 1,
    from: { id: 123, first_name: 'Test' },
    chat: { id: 123, type: 'private' },
    text: '/weather Moscow'
  }
}

const response = await fetch('http://localhost:8787/webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Telegram-Bot-Api-Secret-Token': 'test-secret'
  },
  body: JSON.stringify(testUpdate)
})
```

## Debugging

### Using Wrangler Tail

```bash
# Stream logs from production
npm run tail

# Stream from staging
npm run tail:staging
```

### Local Debugging

1. **Console Logs**: Appear in terminal

```typescript
console.log('Update received:', update)
```

2. **Breakpoints**: Use VS Code debugger

```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Worker",
  "program": "node_modules/wrangler/bin/wrangler.js",
  "args": ["dev"],
  "env": {
    "NODE_ENV": "development"
  }
}
```

3. **Sentry Integration**: Automatic error tracking

```typescript
Sentry.captureException(error, {
  tags: { command: 'weather' },
  user: { id: ctx.from?.id }
})
```

### Common Issues

#### Webhook Not Receiving Updates

```bash
# Check webhook status
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# Common issues:
# - Wrong URL
# - Missing secret token
# - SSL certificate issues
```

#### Session Not Persisting

```typescript
// Ensure KV namespace is bound
console.log('KV available:', !!ctx.env.SESSIONS)

// Check TTL
await ctx.env.SESSIONS.put(key, value, {
  expirationTtl: 86400 // 24 hours
})
```

#### Database Queries Failing

```sql
-- Test query directly
wrangler d1 execute DB --local --command "SELECT * FROM users LIMIT 1"
```

## Performance Optimization

### 1. Minimize Cold Starts

```typescript
// Lazy load heavy dependencies
const getAIService = lazy(() => import('./services/ai-service'))
```

### 2. Batch Operations

```typescript
// Bad: Multiple API calls
for (const user of users) {
  await sendMessage(user.id, text)
}

// Good: Batch API calls
await Promise.all(users.map(user => sendMessage(user.id, text)))
```

### 3. Cache Strategically

```typescript
const cached = await cache.get(key)
if (cached) return cached

const result = await expensiveOperation()
await cache.put(key, result, { expirationTtl: 3600 })
return result
```

### 4. Use Lightweight Adapter for Free Tier

```typescript
if (env.TIER === 'free') {
  // Skip non-essential features
  return new LightweightAdapter(bot, env)
}
```

## Best Practices

### 1. Type Everything

```typescript
// Define custom types
interface WeatherData {
  temp: number
  description: string
  humidity: number
}

// Use throughout
async function getWeather(city: string): Promise<WeatherData> {
  // Implementation
}
```

### 2. Handle Errors Gracefully

```typescript
try {
  await riskyOperation()
} catch (error) {
  logger.error('Operation failed', { error })
  await ctx.reply('Sorry, something went wrong. Please try again.')
}
```

### 3. Validate Input

```typescript
const schema = z.object({
  city: z.string().min(1).max(100),
  units: z.enum(['celsius', 'fahrenheit']).optional()
})

const input = schema.parse(userInput)
```

### 4. Use Middleware

```typescript
// Rate limiting
bot.use(rateLimiter)

// Logging
bot.use(async (ctx, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  logger.info(`${ctx.updateType} processed in ${ms}ms`)
})
```

## Deployment Preparation

### 1. Environment Check

```bash
# Verify all secrets are set
wrangler secret list
```

### 2. Run Tests

```bash
npm test
npm run typecheck
npm run lint
```

### 3. Build Check

```bash
# Ensure it builds without errors
wrangler deploy --dry-run
```

### 4. Update Webhook for Production

```bash
# After deployment
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-bot.workers.dev/webhook"
```

## Advanced Topics

### Custom Inline Keyboards

```typescript
const keyboard = new InlineKeyboard()
  .text('Option 1', 'opt1')
  .text('Option 2', 'opt2')
  .row()
  .url('Visit Website', 'https://example.com')
  .row()
  .text('« Back', 'back')
```

### Conversation Flows

```typescript
// Using grammY conversations plugin
async function askName(conversation: Conversation, ctx: Context) {
  await ctx.reply('What is your name?')
  const { message } = await conversation.wait()
  return message?.text
}
```

### File Handling

```typescript
bot.on('message:document', async ctx => {
  const file = await ctx.getFile()
  const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`
  // Process file
})
```

## Resources

- [grammY Documentation](https://grammy.dev)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Project Issues](https://github.com/talkstream/typescript-wireframe-platform/issues)

---

_Happy coding! If you encounter issues, check the [Troubleshooting Guide](./TROUBLESHOOTING.md)._
