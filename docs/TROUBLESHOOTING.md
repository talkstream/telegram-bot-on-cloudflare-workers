# 🔧 Troubleshooting Guide

## Common Issues and Solutions

### Webhook Issues

#### Problem: Bot not receiving messages

```bash
# Check webhook status
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

**Solutions:**

1. **URL incorrect**: Ensure webhook URL matches your worker
2. **Secret mismatch**: Verify `TELEGRAM_WEBHOOK_SECRET` matches
3. **SSL issues**: Cloudflare handles SSL, but check domain settings
4. **Bot blocked**: User may have blocked the bot

#### Problem: "Webhook was not set" error

```json
{
  "ok": false,
  "error_code": 401,
  "description": "Unauthorized"
}
```

**Solution:** Check bot token is correct:

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
```

#### Problem: Duplicate updates

**Symptoms:** Same message processed multiple times

**Solutions:**

1. Enable deduplication in adapter:

```typescript
const adapter = new TelegramAdapter(bot, env, {
  deduplicationWindow: 60 // seconds
})
```

2. Check response time (must be < 60s)

### Performance Issues

#### Problem: "CPU time limit exceeded" on free tier

```
Error: Worker exceeded CPU time limit
```

**Solutions:**

1. Use free tier adapter for Cloudflare Workers:

```typescript
import { createTierAwareBot } from '@/adapters/telegram/cloudflare-workers'

// Automatically selects adapter based on TIER env variable
const bot = await createTierAwareBot(env)
```

2. Optimize heavy operations:

```typescript
// Cache expensive computations
const cached = await cache.get(key)
if (cached) return cached
```

3. Defer non-critical work:

```typescript
ctx.executionContext.waitUntil(
  logAnalytics(update) // Don't block response
)
```

#### Problem: Slow response times

**Symptoms:** Users experience delays

**Diagnostic steps:**

```bash
# Check worker metrics
wrangler tail --format pretty

# Measure response time
time curl https://your-bot.workers.dev/health
```

**Solutions:**

1. Enable KV caching
2. Optimize database queries
3. Use regional hints for AI providers

### Storage Issues

#### Problem: Sessions not persisting

**Symptoms:** Bot "forgets" user state

**Debug steps:**

```typescript
// Check KV binding
console.log('KV available:', !!env.SESSIONS)

// Verify write
const result = await env.SESSIONS.put(key, value)
console.log('Write result:', result)

// Check TTL
await env.SESSIONS.put(key, value, {
  expirationTtl: 86400 // 24 hours
})
```

**Solutions:**

1. Verify KV namespace binding in `wrangler.toml`
2. Check namespace ID is correct
3. Ensure TTL is set appropriately

#### Problem: Database queries failing

```
D1_ERROR: no such table: users
```

**Solutions:**

1. Run migrations:

```bash
npm run db:apply:local  # Local
npm run db:apply:remote # Production
```

2. Verify database binding:

```toml
[[d1_databases]]
binding = "DB"
database_id = "your-id-here"
```

3. Check SQL syntax:

```bash
wrangler d1 execute DB --local --command "SELECT 1"
```

### Development Issues

#### Problem: Local development not working

**Symptoms:** `npm run dev` fails or webhook unreachable

**Solutions:**

1. Check Node version (>= 18):

```bash
node --version
```

2. Clear wrangler cache:

```bash
rm -rf .wrangler/
npm run dev
```

3. Verify `.dev.vars` exists and has required variables

#### Problem: TypeScript errors

```
Type error: Property 'X' does not exist on type 'Y'
```

**Solutions:**

1. Regenerate types:

```bash
npm run typecheck
```

2. Update dependencies:

```bash
npm update
npm install
```

3. Check `tsconfig.json` includes all source files

### Deployment Issues

#### Problem: "Script too large" error

```
Error: Script size exceeds limit (1MB)
```

**Solutions:**

1. Check bundle size:

```bash
npm run build
ls -la .wrangler/dist/
```

2. Remove unused dependencies:

```bash
npm prune --production
```

3. Use dynamic imports:

```typescript
const heavyModule = await import('./heavy-module')
```

#### Problem: Secrets not available

**Symptoms:** `undefined` values for secrets

**Solutions:**

1. List secrets:

```bash
wrangler secret list
```

2. Re-add secrets:

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
```

3. Check environment:

```bash
wrangler secret list --env production
```

### Bot-Specific Issues

#### Problem: Commands not working

**Symptoms:** Bot doesn't respond to commands

**Debug steps:**

```typescript
// Add logging
bot.command('test', async ctx => {
  console.log('Command received:', ctx.message?.text)
  await ctx.reply('Test command works!')
})
```

**Solutions:**

1. Check command registration order
2. Verify middleware isn't blocking
3. Ensure commands are set with BotFather:

```bash
/setcommands
```

#### Problem: Inline keyboards not working

**Symptoms:** Buttons don't trigger callbacks

**Solutions:**

1. Check callback data length (< 64 bytes):

```typescript
const data = 'action:' + id // Keep it short
```

2. Verify callback handler:

```typescript
bot.callbackQuery(/^action:/, async ctx => {
  console.log('Callback:', ctx.callbackQuery.data)
  await ctx.answerCallbackQuery()
})
```

#### Problem: Media uploads failing

**Symptoms:** Photos/documents don't send

**Solutions:**

1. Check file size limits:
   - Photos: 10MB
   - Documents: 50MB

2. Use proper method:

```typescript
// For URLs
await ctx.replyWithPhoto('https://example.com/photo.jpg')

// For buffers
await ctx.replyWithDocument(new InputFile(buffer, 'file.pdf'))
```

### Error Handling

#### Problem: Errors not logged to Sentry

**Solutions:**

1. Verify Sentry DSN:

```bash
wrangler secret put SENTRY_DSN
```

2. Check initialization:

```typescript
if (env.SENTRY_DSN) {
  Sentry.init({ dsn: env.SENTRY_DSN })
}
```

3. Test with manual error:

```typescript
Sentry.captureException(new Error('Test error'))
```

#### Problem: Generic error messages

**Symptoms:** Users see unhelpful errors

**Solution:** Implement proper error handling:

```typescript
bot.catch(err => {
  const ctx = err.ctx
  console.error('Error:', err.error)

  if (err.error.code === 403) {
    return ctx.reply('I cannot send messages to you. Please check your privacy settings.')
  }

  return ctx.reply('An error occurred. Please try again later.')
})
```

### AI Integration Issues

#### Problem: AI provider timeouts

**Symptoms:** AI commands fail or timeout

**Solutions:**

1. Implement timeout wrapper:

```typescript
const response = await withTimeout(
  aiService.generate(prompt),
  29000 // 29s for 30s Worker limit
)
```

2. Use streaming responses:

```typescript
const stream = await aiService.stream(prompt)
for await (const chunk of stream) {
  await ctx.reply(chunk)
}
```

3. Implement fallback providers:

```typescript
const providers = ['gemini', 'openai', 'cloudflare-ai']
for (const provider of providers) {
  try {
    return await useProvider(provider)
  } catch (error) {
    continue
  }
}
```

### Rate Limiting Issues

#### Problem: "Too Many Requests" errors

```json
{
  "error_code": 429,
  "description": "Too Many Requests: retry after X"
}
```

**Solutions:**

1. Implement exponential backoff:

```typescript
async function retryWithBackoff(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (error.error_code === 429) {
        await sleep(Math.pow(2, i) * 1000)
        continue
      }
      throw error
    }
  }
}
```

2. Use request batching:

```typescript
const batcher = new TelegramBatcher(bot.api)
await batcher.add(userId, message)
await batcher.flush() // Sends all at once
```

## Diagnostic Commands

Add these commands for debugging:

```typescript
// Health check command
bot.command('health', async ctx => {
  const health = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: env.ENVIRONMENT,
    version: pkg.version
  }
  await ctx.reply(`\`\`\`json\n${JSON.stringify(health, null, 2)}\n\`\`\``, {
    parse_mode: 'MarkdownV2'
  })
})

// Debug command (owner only)
bot.command('debug', requireOwner, async ctx => {
  const debug = {
    from: ctx.from,
    chat: ctx.chat,
    session: ctx.session,
    env: Object.keys(env)
  }
  await ctx.reply(`\`\`\`json\n${JSON.stringify(debug, null, 2)}\n\`\`\``, {
    parse_mode: 'MarkdownV2'
  })
})
```

## Getting Help

If you're still stuck:

1. **Check existing issues**: [GitHub Issues](https://github.com/talkstream/typescript-wireframe-platform/issues)
2. **Create detailed bug report** with:
   - Error messages
   - Steps to reproduce
   - Environment details
   - Relevant code snippets
3. **Join community**: Telegram group for discussions
4. **Review docs**: Double-check all documentation

## Emergency Contacts

- **Cloudflare Status**: https://cloudflarestatus.com
- **Telegram Status**: https://telegram.org/blog/telegram-status
- **Sentry Status**: https://status.sentry.io

---

_Remember: Most issues have simple solutions. Check the basics first!_
