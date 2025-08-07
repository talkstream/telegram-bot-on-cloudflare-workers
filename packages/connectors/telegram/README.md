# @wireframe/connector-telegram

Telegram Bot API connector for the Wireframe AI Assistant Ecosystem.

## Installation

```bash
npm install @wireframe/connector-telegram
```

## Features

- Full Telegram Bot API support via Grammy
- Webhooks and long polling
- Inline keyboards and custom keyboards
- File uploads and downloads
- Middleware support
- Rate limiting built-in
- TypeScript first

## Quick Start

```typescript
import { Wireframe } from '@wireframe/core'

const bot = await Wireframe.create({
  connectors: ['telegram'],
  config: {
    telegram: {
      token: process.env.BOT_TOKEN
    }
  }
})

bot.on('message', async message => {
  await message.reply('Hello from Wireframe!')
})

await bot.start()
```

## Configuration

```typescript
interface TelegramConfig {
  token: string // Bot token from @BotFather
  webhookUrl?: string // For webhook mode
  pollingTimeout?: number // For long polling (default: 30s)
  apiRoot?: string // Custom API endpoint
}
```

## Advanced Usage

### Custom Keyboards

```typescript
bot.on('message', async message => {
  await message.reply('Choose an option:', {
    keyboard: {
      buttons: [[{ text: 'Option 1' }, { text: 'Option 2' }], [{ text: 'Cancel' }]],
      resize: true
    }
  })
})
```

### Inline Keyboards

```typescript
bot.on('message', async message => {
  await message.reply('Click a button:', {
    keyboard: {
      inline: true,
      buttons: [
        [{ text: 'Click me!', callbackData: 'button_clicked' }],
        [{ text: 'Visit site', url: 'https://wireframe.dev' }]
      ]
    }
  })
})

bot.on('callback_query', async query => {
  if (query.data === 'button_clicked') {
    await query.answer('Button clicked!')
  }
})
```

### Commands

```typescript
bot.on('command:start', async message => {
  await message.reply('Welcome to the bot!')
})

bot.on('command:help', async message => {
  await message.reply('Available commands: /start, /help')
})
```

## API Reference

See [full documentation](https://docs.wireframe.dev/connectors/telegram).

## License

MIT © Wireframe Contributors
