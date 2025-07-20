# Telegram Bot on Cloudflare Workers Example

This example demonstrates how to deploy a Telegram bot using the Cloudflare Workers wireframe.

## Quick Start

### 1. Prerequisites

- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)
- Telegram Bot Token from [@BotFather](https://t.me/botfather)

### 2. Setup

1. Clone the wireframe repository:

```bash
git clone https://github.com/talkstream/telegram-bot-on-cloudflare-workers.git
cd telegram-bot-on-cloudflare-workers
npm install
```

2. Navigate to the example:

```bash
cd examples/telegram-bot
```

3. Configure your bot:

```bash
# Set your Telegram Bot Token
wrangler secret put TELEGRAM_BOT_TOKEN
# Enter your bot token when prompted

# Set webhook secret (generate a random string)
wrangler secret put TELEGRAM_WEBHOOK_SECRET
# Enter a secure random string

# Set admin user ID (your Telegram user ID)
wrangler secret put ADMIN_USER_ID
# Enter your Telegram user ID

# Optional: Set Gemini API key for AI features
wrangler secret put GEMINI_API_KEY
```

4. Create KV namespaces:

```bash
wrangler kv:namespace create "KV_CACHE"
wrangler kv:namespace create "USER_SESSIONS"
wrangler kv:namespace create "STARS_STORE"
```

5. Update `wrangler.toml` with your namespace IDs from the output above.

### 3. Deploy

```bash
# Deploy to Cloudflare Workers
wrangler deploy

# The command will output your worker URL, e.g.:
# https://telegram-bot-example.your-subdomain.workers.dev
```

### 4. Set Webhook

```bash
# Set the webhook URL for your bot
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://telegram-bot-example.your-subdomain.workers.dev/telegram-webhook",
    "secret_token": "<YOUR_WEBHOOK_SECRET>"
  }'
```

### 5. Test Your Bot

Open Telegram and search for your bot by its username. Send `/start` to begin!

## Available Commands

- `/start` - Start the bot and see the main menu
- `/help` - Show available commands
- `/hello` - Get a friendly greeting
- `/weather [location]` - Get weather information
- `/echo [text]` - Echo your message
- `/status` - Check bot status
- `/crypto [coin]` - Get cryptocurrency price
- `/settings` - Open settings menu

## Features Demonstrated

- ✅ Command handling
- ✅ Inline keyboards
- ✅ Callback queries
- ✅ Inline queries
- ✅ Scheduled tasks
- ✅ KV storage integration
- ✅ Error handling
- ✅ TypeScript support

## Customization

### Adding New Commands

Edit `bot.ts` and add your command to the `customCommands` object:

```typescript
const customCommands = {
  yourcommand: async (ctx: Context) => {
    await ctx.reply('Your response here!');
  },
};
```

### Adding Scheduled Tasks

Edit the `scheduled` handler in `bot.ts`:

```typescript
async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  if (event.cron === '0 */6 * * *') { // Every 6 hours
    // Your scheduled task logic
  }
}
```

Add the schedule to `wrangler.toml`:

```toml
[[triggers]]
crons = ["0 */6 * * *"]
```

## Production Considerations

1. **Rate Limiting**: The wireframe includes built-in rate limiting
2. **Error Handling**: Comprehensive error handling is implemented
3. **Logging**: Use `wrangler tail` to view real-time logs
4. **Monitoring**: Set up Cloudflare Analytics for monitoring
5. **Secrets**: Never commit secrets to version control

## Troubleshooting

### Bot not responding?

- Check webhook is set correctly: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
- View logs: `wrangler tail`

### Deployment errors?

- Ensure all secrets are set
- Check KV namespace IDs in wrangler.toml
- Verify Node.js compatibility flag is enabled

## Next Steps

- Implement database storage with D1
- Add AI features with Gemini integration
- Implement payment processing with Telegram Stars
- Add multi-language support
- Create admin dashboard

## Support

For issues and questions:

- GitHub: [telegram-bot-on-cloudflare-workers](https://github.com/talkstream/telegram-bot-on-cloudflare-workers)
- Documentation: [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- Telegram API: [Telegram Bot API](https://core.telegram.org/bots/api)
