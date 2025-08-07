# Wireframe Hello World Bot

A simple example demonstrating the power and simplicity of Wireframe v2.0 ecosystem.

## Features

- ✅ **4.1KB core** - Minimal bundle size
- ✅ **< 50ms cold start** - Lightning fast
- ✅ **Zero configuration** - Just works
- ✅ **AI-powered** - OpenAI integration
- ✅ **Type-safe** - 100% TypeScript

## Setup

1. **Install dependencies:**

```bash
npm install
```

2. **Configure environment:**

```bash
cp .env.example .env
# Edit .env with your credentials
```

3. **Get credentials:**
   - Telegram: Create bot with [@BotFather](https://t.me/botfather)
   - OpenAI: Get API key from [OpenAI Platform](https://platform.openai.com)

4. **Run the bot:**

```bash
npm run dev
```

## Code

The entire bot in just 30 lines:

```typescript
import { Wireframe } from '@wireframe/core'

const bot = await Wireframe.create({
  connectors: ['telegram', 'openai'],
  config: {
    telegram: { token: process.env.BOT_TOKEN },
    openai: { apiKey: process.env.OPENAI_API_KEY }
  }
})

bot.on('message', async message => {
  const response = await bot.ai.complete(message.text!)
  await message.reply(response)
})

await bot.start()
```

## Performance

- **Bundle size**: 4.1KB (core only)
- **Cold start**: < 50ms
- **Memory usage**: < 50MB
- **Response time**: < 100ms (excluding AI processing)

## Architecture

```
@wireframe/core (4.1KB)
├── EventBus (909 bytes)
├── Registry (765 bytes)
└── Plugins (857 bytes)

@wireframe/connector-telegram
└── Grammy integration (lazy loaded)

@wireframe/connector-openai
└── OpenAI SDK (lazy loaded)
```

## Learn More

- [Wireframe Documentation](https://docs.wireframe.dev)
- [Create your own bot](https://github.com/wireframe/core)
- [Join Discord](https://discord.gg/wireframe)
