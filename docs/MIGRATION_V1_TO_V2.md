# Migration Guide: v1.x to v2.0 Ecosystem

## Overview

Wireframe v2.0 transforms from a monolithic framework into a modular ecosystem. This guide helps you migrate existing v1.x projects.

## Key Changes

### 1. Package Structure

**v1.x (Monolithic)**

```typescript
import { Bot, TelegramConnector, OpenAIConnector } from 'wireframe'
```

**v2.0 (Modular)**

```typescript
import { Wireframe } from '@wireframe/core'
import telegram from '@wireframe/connector-telegram'
import openai from '@wireframe/connector-openai'
```

### 2. Configuration

**v1.x**

```typescript
const bot = new Bot({
  telegram: { token: process.env.BOT_TOKEN },
  openai: { apiKey: process.env.OPENAI_KEY }
})
```

**v2.0**

```typescript
const bot = await Wireframe.create({
  connectors: ['telegram', 'openai'],
  config: {
    telegram: { token: process.env.BOT_TOKEN },
    openai: { apiKey: process.env.OPENAI_KEY }
  }
})
```

### 3. Vendor Dependencies

All vendor-specific code moved to connectors:

- `@sentry/cloudflare` → `@wireframe/connector-sentry`
- Direct Cloudflare APIs → `@wireframe/connector-cloudflare`
- Telegram Bot API → `@wireframe/connector-telegram`

## Migration Steps

### Step 1: Install New Packages

```bash
# Remove old monolithic package
npm uninstall wireframe

# Install modular packages
npm install @wireframe/core
npm install @wireframe/connector-telegram
npm install @wireframe/connector-openai
npm install @wireframe/connector-cloudflare
```

### Step 2: Update Imports

```typescript
// Old
import { Bot, TelegramConnector, CloudflareKVAdapter, OpenAIProvider } from 'wireframe'

// New
import { Wireframe } from '@wireframe/core'
// Connectors loaded dynamically via registry
```

### Step 3: Update Configuration

Create `wireframe.config.ts`:

```typescript
import { defineConfig } from '@wireframe/core'

export default defineConfig({
  connectors: {
    messaging: 'telegram',
    ai: 'openai',
    cloud: 'cloudflare'
  },
  plugins: ['analytics', 'admin-panel']
})
```

### Step 4: Update Bot Initialization

```typescript
// Old
const bot = new Bot(config)
await bot.start()

// New
const bot = await Wireframe.create()
await bot.start()
```

### Step 5: Update Event Handlers

```typescript
// Old
bot.on('message', async ctx => {
  await ctx.reply('Hello')
})

// New - Same API, works identically
bot.on('message', async ctx => {
  await ctx.reply('Hello')
})
```

## Features Mapping

| v1.x Feature        | v2.0 Package                    |
| ------------------- | ------------------------------- |
| TelegramConnector   | @wireframe/connector-telegram   |
| OpenAIProvider      | @wireframe/connector-openai     |
| CloudflareKVAdapter | @wireframe/connector-cloudflare |
| RateLimiter         | @wireframe/plugin-rate-limiter  |
| AdminPanel          | @wireframe/plugin-admin-panel   |
| I18n                | @wireframe/plugin-i18n          |
| Analytics           | @wireframe/plugin-analytics     |

## Breaking Changes

1. **No direct vendor imports** - All vendor code in connectors
2. **Async initialization** - `Wireframe.create()` is async
3. **Registry-based loading** - Packages loaded dynamically
4. **Environment variables** - Use config file instead

## Compatibility Mode

For gradual migration, use compatibility wrapper:

```typescript
import { createV1Compat } from '@wireframe/compat'

// Works with old v1 code
const bot = createV1Compat(oldConfig)
```

## Performance Improvements

v2.0 brings significant performance gains:

- **50% smaller bundle** - Only load what you use
- **3x faster cold start** - Lazy loading and optimizations
- **Better tree-shaking** - Modular architecture

## Getting Help

- [Migration Examples](https://github.com/wireframe/migration-examples)
- [Discord Community](https://discord.gg/wireframe)
- [Migration Service](https://wireframe.dev/migration)

## Timeline

- **v1.3.0** - Current stable (supported until July 2025)
- **v2.0.0-alpha** - Available now for testing
- **v2.0.0** - GA release (March 2025)
- **v1.x EOL** - December 2025
