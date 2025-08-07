# Telegram Connector Example

This example demonstrates how to use the new TelegramConnector with Wireframe v1.2's connector architecture.

## Features

- ✅ Event-driven architecture with EventBus
- ✅ Unified message format
- ✅ Command handling through plugin system
- ✅ Callback query handling
- ✅ Full TypeScript support

## Setup

1. Copy `.env.example` to `.env` and fill in your bot token:

```bash
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret_here
```

2. Install dependencies:

```bash
npm install
```

3. Run locally:

```bash
npm run dev
```

## Architecture

```
TelegramConnector
├── Message Converters (Telegram ↔ UnifiedMessage)
├── Command Handler (Plugin-based commands)
├── Callback Handler (Inline keyboard handling)
└── Event Bus Integration
```

## Adding Commands

Commands are now plugins that can be easily added:

```typescript
const myCommand: PluginCommand = {
  name: 'mycommand',
  description: 'My custom command',
  handler: async (args, ctx) => {
    await ctx.reply('Hello from my command!')
  }
}

// Register with command handler
commandHandler.commands.set('mycommand', myCommand)
```

## Handling Events

Use the EventBus to handle various events:

```typescript
eventBus.on(CommonEventType.MESSAGE_RECEIVED, event => {
  const message = event.payload.message as UnifiedMessage
  console.log('Received message:', message.content.text)
})
```

## Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```
