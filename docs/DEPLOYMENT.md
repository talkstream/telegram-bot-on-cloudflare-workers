# 🚀 Deployment Guide

## Prerequisites

Before deploying, ensure you have:

- ✅ Cloudflare account
- ✅ Telegram bot token from [@BotFather](https://t.me/botfather)
- ✅ All tests passing (`npm test`)
- ✅ Environment variables configured
- ✅ Cloudflare API token (for CI/CD)

## Deployment Environments

### Development (Local)

- URL: `http://localhost:8787` (with tunnel)
- Resources: Local KV, D1
- Logging: Console output
- Hot reload: Enabled

### Staging

- URL: `https://bot-staging.<your-subdomain>.workers.dev`
- Resources: Separate KV, D1 instances
- Logging: Wrangler tail
- Purpose: Pre-production testing

### Production

- URL: `https://bot.<your-subdomain>.workers.dev`
- Resources: Production KV, D1
- Logging: Sentry + Wrangler tail
- Purpose: Live bot serving users

## Step-by-Step Deployment

### 1. Prepare Cloudflare Resources

#### Create KV Namespaces

```bash
# Production
wrangler kv:namespace create "SESSIONS"
# Note the ID: abcd1234...

# Staging
wrangler kv:namespace create "SESSIONS" --env staging
# Note the ID: efgh5678...
```

#### Create D1 Databases

```bash
# Production
wrangler d1 create telegram-bot-db
# Note the ID: xxxx-xxxx-xxxx

# Staging
wrangler d1 create telegram-bot-db-staging
# Note the ID: yyyy-yyyy-yyyy
```

### 2. Update wrangler.toml

```toml
name = "telegram-bot"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[env.staging]
name = "telegram-bot-staging"
vars = { ENVIRONMENT = "staging" }

[[env.staging.kv_namespaces]]
binding = "SESSIONS"
id = "efgh5678..."

[[env.staging.d1_databases]]
binding = "DB"
database_name = "telegram-bot-db-staging"
database_id = "yyyy-yyyy-yyyy"

[env.production]
name = "telegram-bot"
vars = { ENVIRONMENT = "production" }

[[env.production.kv_namespaces]]
binding = "SESSIONS"
id = "abcd1234..."

[[env.production.d1_databases]]
binding = "DB"
database_name = "telegram-bot-db"
database_id = "xxxx-xxxx-xxxx"
```

### 3. Set Secrets

#### Required Secrets

```bash
# Set for production
wrangler secret put TELEGRAM_BOT_TOKEN --env production
wrangler secret put TELEGRAM_WEBHOOK_SECRET --env production

# Set for staging
wrangler secret put TELEGRAM_BOT_TOKEN --env staging
wrangler secret put TELEGRAM_WEBHOOK_SECRET --env staging
```

#### Optional Secrets

```bash
# Production only
wrangler secret put SENTRY_DSN --env production
wrangler secret put GEMINI_API_KEY --env production
wrangler secret put OPENAI_API_KEY --env production
wrangler secret put BOT_OWNER_IDS --env production
wrangler secret put BOT_ADMIN_IDS --env production
```

### 4. Run Database Migrations

```bash
# Staging
npm run db:apply:remote -- --env staging

# Production (be careful!)
npm run db:apply:remote -- --env production
```

### 5. Deploy to Staging First

```bash
# Deploy
npm run deploy:staging

# Output:
# Published telegram-bot-staging
# https://telegram-bot-staging.your-subdomain.workers.dev
```

### 6. Set Webhook for Staging

```bash
curl "https://api.telegram.org/bot<STAGING_TOKEN>/setWebhook?url=https://telegram-bot-staging.your-subdomain.workers.dev/webhook&secret_token=<STAGING_SECRET>"
```

### 7. Test Staging Thoroughly

- ✅ Send test commands
- ✅ Check error handling
- ✅ Verify database operations
- ✅ Test all features

### 8. Deploy to Production

```bash
# Final deployment
npm run deploy

# Output:
# Published telegram-bot
# https://telegram-bot.your-subdomain.workers.dev
```

### 9. Set Production Webhook

```bash
curl "https://api.telegram.org/bot<PRODUCTION_TOKEN>/setWebhook?url=https://telegram-bot.your-subdomain.workers.dev/webhook&secret_token=<PRODUCTION_SECRET>"
```

### 10. Verify Deployment

```bash
# Check webhook
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# Monitor logs
npm run tail
```

## CI/CD with GitHub Actions

### 1. Get Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Create token with permissions:
   - Account: Cloudflare Workers Scripts:Edit
   - Account: Account Settings:Read
   - Zone: Zone Settings:Read

### 2. Set GitHub Secrets

In your repository settings:

- `CLOUDFLARE_API_TOKEN`: Your API token
- `CLOUDFLARE_ACCOUNT_ID`: Your account ID

### 3. GitHub Actions Workflow

The included workflow (`.github/workflows/deploy.yml`) automatically:

1. Runs tests on every push
2. Deploys to staging on `develop` branch
3. Deploys to production on `main` branch

```yaml
name: Deploy

on:
  push:
    branches: [main, develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          environment: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
```

## Custom Domain Setup

### 1. Add Custom Domain

```bash
# In Cloudflare Dashboard
Workers & Pages > Your Worker > Settings > Domains & Routes
Add Custom Domain: bot.yourdomain.com
```

### 2. Update Webhook

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://bot.yourdomain.com/webhook"
```

## Monitoring & Maintenance

### Real-time Logs

```bash
# Production logs
wrangler tail --env production

# Filter by status
wrangler tail --env production --status error

# Search logs
wrangler tail --env production --search "user:123456"
```

### Sentry Dashboard

Monitor errors and performance:

1. Go to [Sentry](https://sentry.io)
2. Select your project
3. View issues, performance, and user feedback

### Health Checks

```bash
# Manual health check
curl https://bot.yourdomain.com/health

# Response:
{
  "status": "healthy",
  "version": "1.1.0",
  "uptime": 3600,
  "environment": "production",
  "services": {
    "database": "connected",
    "kv": "connected",
    "telegram": "webhook_set"
  }
}
```

### Automated Monitoring

Set up uptime monitoring:

1. Use Cloudflare Analytics
2. Set up external monitors (UptimeRobot, Pingdom)
3. Configure alerts for downtime

## Rollback Procedures

### Quick Rollback

```bash
# List deployments
wrangler deployments list

# Rollback to previous
wrangler rollback [deployment-id]
```

### Emergency Procedures

1. **Immediate Stop**:

```bash
# Remove webhook
curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
```

2. **Revert Code**:

```bash
git revert HEAD
git push origin main
```

3. **Deploy Previous Version**:

```bash
git checkout <previous-tag>
npm run deploy
```

## Cost Optimization

### Free Tier Limits

- 100,000 requests/day
- 10ms CPU time per request
- 1MB worker size

### Optimization Tips

1. **Use Lightweight Adapter**:

```toml
[env.production]
vars = { TIER = "free" }
```

2. **Enable Caching**:

```typescript
return new Response(data, {
  headers: {
    'Cache-Control': 'public, max-age=300'
  }
})
```

3. **Minimize Dependencies**:

```bash
# Check bundle size
wrangler deploy --dry-run --outdir dist
ls -la dist/
```

## Security Checklist

- [ ] Webhook secret is set and validated
- [ ] All secrets use `wrangler secret put`
- [ ] No hardcoded tokens in code
- [ ] Input validation with Zod
- [ ] Rate limiting enabled
- [ ] Error messages don't leak sensitive info
- [ ] Sentry configured without PII
- [ ] Admin commands protected

## Troubleshooting Deployment

### Common Issues

#### "Script too large"

```bash
# Check size
npm run build
# Optimize imports, remove unused code
```

#### "KV namespace not found"

```bash
# Verify binding in wrangler.toml
# Check namespace ID is correct
```

#### "Webhook not working"

```bash
# Check webhook info
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
# Verify URL and secret match
```

## Post-Deployment

### 1. Announce to Users

```typescript
// Send announcement
await notifyUsers('🎉 Bot updated with new features!')
```

### 2. Monitor Metrics

- Response times
- Error rates
- User engagement

### 3. Gather Feedback

- User reports
- Performance data
- Feature requests

## Deployment Checklist

- [ ] All tests pass
- [ ] Environment variables set
- [ ] Secrets configured
- [ ] Database migrated
- [ ] Staging tested
- [ ] Webhook updated
- [ ] Monitoring active
- [ ] Rollback plan ready

---

_For issues during deployment, see the [Troubleshooting Guide](./TROUBLESHOOTING.md)._
