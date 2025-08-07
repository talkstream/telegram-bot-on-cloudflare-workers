# 🤖 Basic Telegram Bot Example

This example shows how to create a simple Telegram bot using the Wireframe v1.2 platform.

## Features

- ✅ Basic command handling (`/start`, `/help`)
- ✅ AI integration with multiple providers
- ✅ User session management
- ✅ Rate limiting
- ✅ Error tracking with Sentry

## Quick Start

### 1. Clone and Setup

```bash
# Clone the wireframe
git clone https://github.com/talkstream/typescript-wireframe-platform.git
cd typescript-wireframe-platform

# Install dependencies
npm install

# Copy this example
cp -r examples/telegram-bot my-bot
cd my-bot
```

### 2. Configure Environment

Create `.dev.vars` file:

```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret_here

# Optional AI Provider (choose one)
AI_PROVIDER=google-ai
GEMINI_API_KEY=your_gemini_key_here

# Optional Monitoring
SENTRY_DSN=your_sentry_dsn_here

# Environment
ENVIRONMENT=development
```

### 3. Create Cloudflare Resources

```bash
# Create D1 database
wrangler d1 create my-bot-db

# Create KV namespaces
wrangler kv:namespace create CACHE
wrangler kv:namespace create RATE_LIMIT
wrangler kv:namespace create SESSIONS

# Update wrangler.toml with the IDs
```

### 4. Run Locally

```bash
# Start development server
npm run dev

# Your bot is now running at http://localhost:8787
```

### 5. Deploy to Production

```bash
# Deploy to Cloudflare Workers
npm run deploy

# Set webhook
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-bot.workers.dev/webhook/<YOUR_SECRET>",
    "secret_token": "<YOUR_SECRET>"
  }'
```

## Project Structure

```
telegram-bot/
├── bot.ts              # Main bot file
├── commands/           # Custom commands
│   ├── start.ts        # /start command
│   └── help.ts         # /help command
├── wrangler.toml       # Cloudflare configuration
├── package.json        # Dependencies
└── README.md           # This file
```

## Customizing Your Bot

### Adding Commands

Create a new command in `commands/weather.ts`:

```typescript
import { CommandContext } from '../../src/types'

export async function handleWeatherCommand(ctx: CommandContext) {
  const city = ctx.args.join(' ') || 'London'

  // Use AI to generate weather info
  const response = await ctx.ai.complete({
    prompt: `What's the weather like in ${city}? Be brief and friendly.`,
    maxTokens: 100
  })

  await ctx.reply(response.content || "Sorry, I couldn't get the weather.")
}
```

Register it in `bot.ts`:

```typescript
bot.command('weather', handleWeatherCommand)
```

### Using Plugins

Add a reminder plugin:

```typescript
import { ReminderPlugin } from './plugins/reminder-plugin'

// Install plugin
bot.use(new ReminderPlugin())
```

### Multi-Platform Support

The same code can work on different cloud platforms:

```bash
# Deploy to AWS Lambda
CLOUD_PLATFORM=aws npm run deploy

# Deploy to Google Cloud Functions
CLOUD_PLATFORM=gcp npm run deploy
```

## Next Steps

- 📚 Read the [full documentation](../../README.md)
- 🔌 Explore [available plugins](../plugins/)
- 🌍 Learn about [multi-platform deployment](../../docs/CLOUD_PLATFORMS.md)
- 💡 Check [advanced examples](../advanced/)

## Support

- [GitHub Issues](https://github.com/talkstream/typescript-wireframe-platform/issues)
- [Telegram Group](https://t.me/your-support-group)
- [Documentation](../../docs/)
