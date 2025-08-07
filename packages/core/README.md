# @wireframe/core

Vendor-agnostic core for the Wireframe AI Assistant Ecosystem.

## Installation

```bash
npm install @wireframe/core
```

## Features

- **Zero vendor dependencies** - Pure TypeScript core
- **Event-driven architecture** - EventBus for all communication
- **Plugin system** - Extensible through plugins
- **Registry pattern** - Dynamic package discovery
- **Type-safe** - 100% TypeScript with strict mode
- **Tree-shakeable** - Only bundle what you use
- **< 100KB** - Minimal bundle size

## Quick Start

```typescript
import { Wireframe } from '@wireframe/core'

const bot = await Wireframe.create({
  connectors: ['telegram', 'openai'],
  plugins: ['analytics']
})

bot.on('message', async message => {
  const response = await bot.ai.complete(message.text)
  await message.reply(response)
})

await bot.start()
```

## Core Components

### Interfaces

Universal contracts for all extensions:

```typescript
import { Connector, Plugin, MessageHandler } from '@wireframe/core/interfaces'
```

### EventBus

Event-driven communication:

```typescript
import { EventBus } from '@wireframe/core/events'

const bus = new EventBus()
bus.on('user.created', data => {
  console.log('User created:', data)
})
```

### Registry

Package discovery and loading:

```typescript
import { Registry } from '@wireframe/core/registry'

const registry = new Registry()
await registry.load('telegram')
const connector = await registry.get('messaging')
```

### Plugin System

Extend functionality:

```typescript
import { createPlugin } from '@wireframe/core/plugins'

export default createPlugin({
  name: 'my-plugin',
  version: '1.0.0',
  initialize(bot) {
    bot.on('message', handler)
  }
})
```

## API Reference

See [full API documentation](https://docs.wireframe.dev/api/core).

## License

MIT © Wireframe Contributors
