# 🚀 Quick Start: Deploy Your Bot in 5 Minutes

## Prerequisites

- Node.js 20+ and npm 10+
- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works!)
- Account on your chosen platform (Telegram, Discord, etc.)

## 🎯 Two Ways to Start

### Option 1: Enhanced Setup Wizard (Recommended)

```bash
# Clone and setup with full wizard
git clone https://github.com/talkstream/typescript-wireframe-platform.git
cd typescript-wireframe-platform
npm install
npm run setup:wizard
```

The enhanced wizard supports:

- 🌐 Multiple platforms (Telegram, Discord, Slack, WhatsApp)
- ☁️ Multiple clouds (Cloudflare, AWS, GCP, Azure)
- 🧠 AI provider selection with configuration
- 📚 Auto-generated CLAUDE.md and INIT.md documentation
- 💾 State saving (resume if interrupted)

### Option 2: Quick Telegram Setup

```bash
# For Telegram-only quick setup
npm run setup:bot
```

The setup wizard will:

- ✅ Help you create a Telegram bot via @BotFather
- ✅ Configure all required secrets
- ✅ Create Cloudflare resources (KV, D1)
- ✅ Deploy to Cloudflare Workers
- ✅ Set up webhook automatically

## What You Get

### Out of the Box

- 🤖 Working Telegram bot with commands
- 💾 Database and KV storage configured
- 🔒 Security best practices implemented
- ⚡ Rate limiting enabled
- 📊 Health monitoring
- 🌍 Global edge deployment

### Example Commands

Your bot will have these commands ready:

- `/start` - Welcome message with menu
- `/help` - Show available commands
- `/hello` - Friendly greeting
- `/weather [location]` - Weather info
- `/status` - Bot status
- `/crypto [coin]` - Crypto prices

## Next Steps

### 1. Customize Your Bot

Edit `src/adapters/telegram/commands/` to add your own commands:

```typescript
// src/adapters/telegram/commands/mycommand.ts
export const myCommand = async (ctx: Context) => {
  await ctx.reply('Your custom response!')
}
```

### 2. Enable AI Features (Optional)

Add AI capabilities:

```bash
# Set your AI provider key
wrangler secret put GEMINI_API_KEY  # For Google Gemini
# or
wrangler secret put OPENAI_API_KEY   # For OpenAI
```

Update `.dev.vars`:

```env
AI_PROVIDER=google-ai  # or openai, xai, deepseek
```

### 3. Add Payment Processing (Optional)

Enable Telegram Stars payments:

```typescript
// In your command handler
await ctx.reply('Premium feature! 💎', {
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: 'Pay 100 Stars ⭐',
          callback_data: 'pay_100_stars'
        }
      ]
    ]
  }
})
```

## Deploy Updates

After making changes:

```bash
npm run deploy
```

## Monitor Your Bot

View real-time logs:

```bash
npm run tail
```

Check bot health:

```
https://your-bot.workers.dev/health
```

## Troubleshooting

### Bot not responding?

```bash
# Check webhook status
curl https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo

# View logs
npm run tail
```

### Need to update configuration?

```bash
# Update secrets
wrangler secret put TELEGRAM_BOT_TOKEN

# Update code and redeploy
npm run deploy
```

## Learn More

- [Full Documentation](./README.md)
- [Architecture Guide](./docs/ARCHITECTURE_DECISIONS.md)
- [Plugin System](./examples/telegram-plugin/)
- [AI Integration](./docs/AI_PROVIDERS.md)

---

🎉 **Congratulations!** You now have a production-ready Telegram bot running on Cloudflare's global network!
