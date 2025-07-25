# 🚀 Create Wireframe CLI

Create a new Wireframe bot project with a single command!

## Quick Start

```bash
npx create-wireframe my-awesome-bot
```

Or install globally:

```bash
npm install -g typescript-wireframe-platform
create-wireframe my-awesome-bot
```

## Features

- 🎯 **Interactive Setup** - Guided project creation
- 🤖 **Multi-Platform** - Telegram, Discord, Slack, WhatsApp
- ☁️ **Multi-Cloud** - Cloudflare, AWS, GCP, Azure
- 🧠 **AI Providers** - OpenAI, Anthropic, Google, Local models
- 📦 **Feature Selection** - Database, Payments, i18n, and more
- 🚀 **Ready to Deploy** - Production-ready configuration

## Usage

### Interactive Mode (Recommended)

```bash
create-wireframe
```

You'll be prompted to:

1. Enter project name
2. Choose messaging platform
3. Select cloud provider
4. Pick AI provider
5. Select additional features
6. Configure options

### Non-Interactive Mode

```bash
create-wireframe my-bot -y \
  --platform telegram \
  --cloud cloudflare \
  --ai openai
```

### Options

```
Arguments:
  project-name              Name of your project

Options:
  -t, --template <template> Project template (default: "telegram-cloudflare")
  -p, --platform <platform> Messaging platform (telegram, discord, slack, whatsapp)
  -c, --cloud <cloud>       Cloud platform (cloudflare, aws, gcp, azure)
  -a, --ai <ai>            AI provider (openai, anthropic, google, local)
  --no-git                 Skip git initialization
  --no-install             Skip dependency installation
  -y, --yes                Skip interactive prompts
  -h, --help               Display help
  -V, --version            Display version
```

## Platform Combinations

### Telegram + Cloudflare Workers

The most battle-tested combination with full support:

```bash
create-wireframe telegram-bot \
  --platform telegram \
  --cloud cloudflare \
  --ai openai
```

### Discord + AWS Lambda

Enterprise-ready Discord bot:

```bash
create-wireframe discord-bot \
  --platform discord \
  --cloud aws \
  --ai anthropic
```

### Slack + Google Cloud

Corporate Slack integration:

```bash
create-wireframe slack-bot \
  --platform slack \
  --cloud gcp \
  --ai google
```

## Features Selection

When creating a project, you can select additional features:

- **💾 Database** - User sessions and data persistence
- **💳 Payments** - Payment processing integration
- **📊 Analytics** - Usage tracking and metrics
- **🌍 i18n** - Multi-language support
- **🔌 Plugins** - Extensible plugin system
- **🎨 Admin Panel** - Web-based administration
- **📝 Monitoring** - Logging and error tracking
- **🧪 Testing** - Test setup with Vitest

## Project Structure

The CLI creates a well-organized project:

```
my-bot/
├── src/
│   ├── index.ts          # Entry point
│   ├── bot.ts            # Bot setup
│   ├── commands/         # Command handlers
│   ├── platform/         # Platform-specific code
│   ├── cloud/            # Cloud-specific code
│   ├── services/         # Business logic
│   └── features/         # Selected features
├── tests/                # Test files
├── docs/                 # Documentation
├── .env.example          # Environment template
├── tsconfig.json         # TypeScript config
├── wrangler.toml         # Cloudflare config (if applicable)
├── package.json          # Dependencies
└── README.md            # Project documentation
```

## Generated Files

### Entry Point (src/index.ts)

- Cloud-specific handler (Cloudflare Worker, Lambda, etc.)
- Bot initialization
- Error handling

### Bot Setup (src/bot.ts)

- Platform connector setup
- Event bus configuration
- Service initialization
- Command registration

### Commands

- `/start` - Welcome message
- `/help` - Available commands
- Custom commands based on features

### Platform Connector

- Messaging platform integration
- Webhook handling
- Message sending/receiving

### Cloud Setup

- Storage initialization
- Environment configuration
- Platform-specific optimizations

## Environment Configuration

The CLI generates an `.env.example` with all required variables:

```env
# Platform Configuration
BOT_TOKEN=your_bot_token
WEBHOOK_SECRET=generate_random_secret

# Cloud Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key

# AI Configuration
OPENAI_API_KEY=sk-your-key

# Feature Configuration
DATABASE_URL=your_database_url
SENTRY_DSN=your_sentry_dsn
```

## Post-Creation Steps

After creating your project:

1. **Navigate to project**

   ```bash
   cd my-bot
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Install dependencies** (if skipped)

   ```bash
   npm install
   ```

4. **Start development**

   ```bash
   npm run dev
   ```

5. **Run tests**

   ```bash
   npm test
   ```

6. **Deploy**
   ```bash
   npm run deploy
   ```

## Examples

### Minimal Bot

```bash
create-wireframe simple-bot -y
```

### Full-Featured Bot

```bash
create-wireframe super-bot \
  --platform telegram \
  --cloud cloudflare \
  --ai multi
```

Then select all features in interactive mode.

### Enterprise Bot

```bash
create-wireframe enterprise-bot \
  --platform slack \
  --cloud aws \
  --ai anthropic
```

With database, monitoring, and admin panel.

## Troubleshooting

### Installation Issues

- Ensure Node.js >= 20.0.0
- Try with `--no-install` flag and install manually

### Platform-Specific Issues

- **Telegram**: Ensure bot token is valid
- **Discord**: Need application ID and public key
- **Slack**: Requires app configuration
- **WhatsApp**: Business account needed

### Cloud-Specific Issues

- **Cloudflare**: Wrangler CLI required
- **AWS**: AWS CLI and credentials needed
- **GCP**: gcloud CLI setup required
- **Azure**: Azure CLI installation

## Contributing

To contribute to the CLI tool:

1. Fork the repository
2. Create feature branch
3. Add new templates or features
4. Submit pull request

## License

MIT
