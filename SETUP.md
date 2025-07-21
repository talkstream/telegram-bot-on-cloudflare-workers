# 🔧 Telegram Bot Cloudflare Workers - Setup Guide

## Prerequisites

Before you start, make sure you have:

1. **Cloudflare Account** - [Sign up here](https://dash.cloudflare.com/sign-up)
2. **GitHub Account** - For repository and CI/CD
3. **Telegram Bot Token** - Get from [@BotFather](https://t.me/botfather)
4. **Node.js 20+** and **npm 10+** installed
5. **Wrangler CLI** - Install with `npm install -g wrangler`

## Understanding Cloudflare Workers Limits

### Free Plan (Default)

The Free plan is perfectly suitable for most Telegram bots:

- **10ms CPU time per request** - Enough for simple commands and quick responses
- **100,000 requests/day** - Supports ~3,000 active users
- **D1 Database**: 5M reads, 100K writes per day
- **KV Storage**: 100K reads, 1K writes per day

### When to Consider Paid Plan ($5/month)

Upgrade to the Paid plan if your bot needs:

- **Long-running operations** (AI generation, file processing) - 30s CPU time
- **High traffic** - 10M requests/month included
- **Async processing** - Queues for background jobs
- **Advanced debugging** - Trace Events and enhanced logging
- **Bulk operations** - Broadcasting to thousands of users

💡 **Note**: This wireframe is optimized to work efficiently within Free plan limits. Most bots won't need to upgrade unless they're doing heavy processing or serving thousands of concurrent users.

## Step 1: Fork/Clone Repository

```bash
git clone https://github.com/talkstream/typescript-wireframe-platform.git
cd typescript-wireframe-platform
npm install
```

## Step 2: Cloudflare Setup

### 2.1 Get Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template
4. Configure permissions:
   - Account > Cloudflare Workers:Edit
   - Account > Account Settings:Read
   - Zone > Workers Routes:Edit (if using custom domain)
5. Copy the generated token

### 2.2 Get Account ID

1. Go to any domain in your Cloudflare account
2. On the right sidebar, find "Account ID"
3. Copy it

## Step 3: Create Cloudflare Resources

### 3.1 Create D1 Database

```bash
# Create database
wrangler d1 create telegram-bot-db

# Copy the database_id from output
# Update wrangler.toml with this ID
```

### 3.2 Create KV Namespaces

```bash
# Create KV namespaces
wrangler kv:namespace create CACHE
wrangler kv:namespace create RATE_LIMIT
wrangler kv:namespace create SESSIONS

# Copy each namespace ID from output
# Update wrangler.toml with these IDs
```

### 3.3 Run Database Migrations

```bash
# Apply migrations locally
npm run db:apply:local

# Apply to production (after setting up secrets)
npm run db:apply:remote
```

## Step 4: GitHub Secrets Setup

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

| Secret Name               | Description                      | Where to Get                                                 |
| ------------------------- | -------------------------------- | ------------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`    | Cloudflare API token             | Step 2.1                                                     |
| `CLOUDFLARE_ACCOUNT_ID`   | Your Cloudflare account ID       | Step 2.2                                                     |
| `TELEGRAM_BOT_TOKEN`      | Your Telegram bot token          | [@BotFather](https://t.me/botfather)                         |
| `TELEGRAM_WEBHOOK_SECRET` | Random string for webhook        | Generate with `openssl rand -base64 32`                      |
| `GEMINI_API_KEY`          | Google Gemini API key (optional) | [Google AI Studio](https://makersuite.google.com/app/apikey) |
| `SENTRY_DSN`              | Sentry error tracking (optional) | [Sentry.io](https://sentry.io)                               |

## Step 5: Local Development Setup

### 5.1 Create `.dev.vars` file

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret_here
GEMINI_API_KEY=your_gemini_api_key_here
SENTRY_DSN=your_sentry_dsn_here
ENVIRONMENT=development
```

### 5.2 Create `wrangler.toml`

```bash
cp wrangler.toml.example wrangler.toml
```

Update with your IDs from Step 3.

## Step 6: Test Locally

```bash
# Run tests
npm test

# Start development server
npm run dev

# Your bot will be available at http://localhost:8787
```

## Step 7: Deploy

### 7.1 First Deployment

```bash
# Deploy to production
npm run deploy

# Get your worker URL
# It will be something like: https://telegram-bot-wireframe.YOUR-SUBDOMAIN.workers.dev
```

### 7.2 Set Webhook

```bash
# Set webhook (replace with your values)
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-worker.workers.dev/webhook/<YOUR_WEBHOOK_SECRET>",
    "secret_token": "<YOUR_WEBHOOK_SECRET>"
  }'
```

### 7.3 Set Production Secrets

```bash
wrangler secret put TELEGRAM_BOT_TOKEN --env production
wrangler secret put TELEGRAM_WEBHOOK_SECRET --env production
wrangler secret put GEMINI_API_KEY --env production  # Optional
wrangler secret put SENTRY_DSN --env production      # Optional
```

## Step 8: Verify Deployment

1. Check worker logs:

   ```bash
   npm run tail
   ```

2. Test your bot:
   - Open Telegram
   - Search for your bot
   - Send `/start` command

3. Check health endpoint:
   ```bash
   curl https://your-worker.workers.dev/health
   ```

## Troubleshooting

### Bot not responding?

1. Check webhook status:

   ```bash
   curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
   ```

2. Check worker logs:

   ```bash
   wrangler tail --env production
   ```

3. Verify secrets are set:
   ```bash
   wrangler secret list --env production
   ```

### Database errors?

1. Ensure migrations are applied:

   ```bash
   npm run db:apply:remote
   ```

2. Check D1 database exists:
   ```bash
   wrangler d1 list
   ```

### Rate limiting issues?

KV namespaces might need time to propagate. Wait a few minutes after creation.

### Test coverage issues?

This project uses Istanbul coverage provider instead of V8. If you encounter coverage errors with `node:inspector`, ensure you have `@vitest/coverage-istanbul` installed (not `@vitest/coverage-v8`). This is due to Cloudflare Workers runtime limitations.

## Next Steps

- Customize bot commands in `src/adapters/telegram/commands/`
- Add new features in `src/services/`
- Configure monitoring with Sentry
- Set up custom domain (optional)

## Support

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [grammY Documentation](https://grammy.dev/)
- [GitHub Issues](https://github.com/yourusername/typescript-wireframe-platform/issues)
