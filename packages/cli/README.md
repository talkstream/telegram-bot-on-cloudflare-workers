# @wireframe/cli

Command-line interface for the Wireframe AI Assistant Ecosystem.

## Installation

```bash
npm install -g @wireframe/cli
```

## Commands

### `wireframe create [name]`

Create a new Wireframe bot with interactive setup.

```bash
wireframe create my-bot
```

Options:

- `-t, --template <template>` - Template to use (default: basic)
- `--no-install` - Skip npm install

The command will guide you through:

1. Selecting messaging platform (Telegram, Discord, Slack)
2. Choosing AI provider (OpenAI, Anthropic, Gemini)
3. Picking cloud platform (Cloudflare, AWS, Vercel)
4. TypeScript or JavaScript

### `wireframe add <packages...>`

Add packages to your bot.

```bash
# Add connectors
wireframe add telegram openai

# Add plugins
wireframe add --plugin analytics rate-limiter

# Add as dev dependency
wireframe add --dev prettier eslint
```

Options:

- `--plugin` - Add as plugin instead of connector
- `--dev` - Add as dev dependency

### Future Commands (Coming Soon)

- `wireframe dev` - Start development server
- `wireframe build` - Build for production
- `wireframe deploy` - Deploy to cloud
- `wireframe publish` - Publish a package

## Quick Start

1. Install the CLI:

```bash
npm install -g @wireframe/cli
```

2. Create a new bot:

```bash
wireframe create my-bot
cd my-bot
```

3. Start development:

```bash
npm run dev
```

## License

MIT © Wireframe Contributors
