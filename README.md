# 🚀 Universal Bot Platform Wireframe

<p align="center">
  <b>English</b> | <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Cloudflare%20Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram" />
  <img src="https://img.shields.io/badge/Type%20Safety-100%25-brightgreen?style=for-the-badge" alt="Type Safety: 100%" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License: MIT" />
</p>

<p align="center">
  <strong>Production-ready wireframe for creating any bots (Telegram, Discord, Slack) on any cloud platform (Cloudflare Workers, AWS Lambda, Google Cloud) with TypeScript 100% strict mode</strong>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-deployment">Deployment</a> •
  <a href="#-documentation">Documentation</a> •
  <a href="#-roadmap">Roadmap</a>
</p>

---

## 🆕 What's New in v1.3

### 🤖 Automated Contribution System

- **Interactive CLI tool** - `npm run contribute` for streamlined contributions
- **Auto-detection** - Identifies valuable patterns from your changes
- **Git worktree support** - Perfect for parallel development
- **Test generation** - Automatically creates appropriate tests

### 🌐 Namespace-based i18n Architecture

- **Organized translations** - Migrated from flat keys to namespaces
- **Platform formatters** - Telegram, Discord, Slack specific formatting
- **Multiple providers** - Static JSON and dynamic KV storage
- **Performance optimized** - Works within Cloudflare free tier limits

### 🎯 Universal Platform Architecture

- **Multi-cloud support** - Deploy on Cloudflare, AWS, GCP, or any cloud
- **Multi-messenger support** - Telegram, Discord, Slack, WhatsApp ready
- **ResourceConstraints** - Platform-agnostic resource management
- **Platform abstraction** - Zero code changes when switching providers
- **Event-driven architecture** with EventBus for decoupled communication
- **Service connectors** for AI, Session, and Payment services
- **Plugin system** for extensible functionality

### Breaking Changes

- No backward compatibility with v1.x
- TelegramAdapter replaced with TelegramConnector
- All services now communicate through EventBus
- Direct Cloudflare dependencies replaced with platform interfaces

## ⚡ Quick Start with Claude Code

<p align="center">
  <a href="https://claude.ai"><img src="https://img.shields.io/badge/Claude%20Code-Ready-5865F2?style=for-the-badge&logo=anthropic&logoColor=white" alt="Claude Code Ready" /></a>
  <a href="./CLAUDE_SETUP.md"><img src="https://img.shields.io/badge/AI-Friendly-10a37f?style=for-the-badge&logo=openai&logoColor=white" alt="AI Friendly" /></a>
</p>

Start your bot with one command:

```bash
Clone and setup github.com/talkstream/typescript-wireframe-platform
```

Claude Code will guide you through:

- ✅ Installing dependencies
- ✅ Setting up MCP servers if needed
- ✅ Creating your Telegram bot
- ✅ Configuring Cloudflare resources
- ✅ Running tests and starting locally

[Full AI Setup Instructions](./CLAUDE_SETUP.md) | [Manual Setup](#-quick-start-manual-setup)

---

## 💫 Support the Project

This wireframe is crafted with passion and care, drawing from decades of experience in IT communities and modern technical ecosystems. It's built by someone who believes that great tools should be both powerful and delightful to use.

Every architectural decision here reflects a deep understanding of what developers need — not just technically, but experientially. This is code that respects your time and intelligence.

If this wireframe resonates with your vision of what development tools should be, consider supporting its continued evolution:

**Cryptocurrency:**

- **TON**: `UQCASJtr_1FfSjcLW_mnx8WuKxT18fXEv5zHrfHhkrwQj2lT`
- **USDT (BEP20)**: `0x16DD8C11BFF0D85D934789C25f77a1def24772F1`
- **USDT (TRC20)**: `TR333FszR3b7crQR4mNufw56vRWxbTTTxS`

_Your support is invested thoughtfully into making this project even better. Thank you for being part of this journey._

---

## 🌟 Features

### Core Technologies

- **☁️ Multi-Cloud** - Deploy on Cloudflare, AWS, GCP, Azure, or any cloud
- **📘 TypeScript** - Full type safety with strict mode
- **🤖 grammY** - Modern Telegram Bot framework (extensible to Discord, Slack, etc.)
- **🗄️ SQL Database** - Platform-agnostic database interface (D1, RDS, Cloud SQL)
- **💾 KV Storage** - Universal key-value storage abstraction
- **🧠 Multi-Provider AI** - Support for Google Gemini, OpenAI, xAI Grok, DeepSeek, Cloudflare AI
- **🔍 Sentry** - Error tracking and performance monitoring
- **🔌 Plugin System** - Extend with custom functionality

### Developer Experience

- **📦 Zero-config setup** - Start developing immediately
- **🧪 Testing suite** - Unit and integration tests with Vitest
- **🔧 Hot reload** - Instant feedback during development
- **📝 100% Type safety** - No `any` types, full TypeScript strict mode
- **🎯 ESLint + Prettier** - Consistent code style with ESLint v9
- **🚀 CI/CD Pipeline** - GitHub Actions ready
- **☁️ Istanbul Coverage** - Compatible with Cloudflare Workers runtime

### Security & Performance

- **🔒 Webhook validation** - Secure token-based authentication
- **⚡ Rate limiting** - Distributed rate limiting with KV
- **🛡️ Security headers** - Best practices implemented
- **📊 Health checks** - Monitor all dependencies
- **🔄 Session management** - Persistent user sessions
- **💰 Telegram Stars** - Payment integration ready
- **🎨 Provider Abstraction** - Switch AI providers without code changes
- **💸 Cost Tracking** - Monitor AI usage and costs across providers

### Cloudflare Workers Tier Optimization

- **🆓 Cloudflare Workers Free Plan** - Optimized for 10ms CPU limit
- **💎 Cloudflare Workers Paid Plan** - Full features with extended timeouts
- **🚀 Auto-scaling** - Tier-aware resource management
- **⚡ Request Batching** - Reduce API overhead
- **🔄 Smart Caching** - Multi-layer cache system
- **⏱️ Timeout Protection** - Configurable API timeouts

## 🎯 Cloudflare Workers Performance Tiers

> **📌 Important**: This wireframe is **100% free and open-source**. The tiers below refer to **Cloudflare Workers plans**, not our wireframe. You can use this wireframe for free forever, regardless of which Cloudflare plan you choose.

### Cloudflare Workers Free Plan (10ms CPU limit)

- **Lightweight mode** - Minimal features for fast responses
- **Aggressive caching** - Reduce KV operations (1K writes/day limit)
- **Request batching** - Optimize Telegram API calls
- **Limited AI features** - Disabled by default to save processing time
- **Sequential operations** - Avoid parallel processing overhead

### Cloudflare Workers Paid Plan (30s CPU limit)

- **Full feature set** - All capabilities enabled
- **AI integration** - Multiple LLM providers with smart retries
- **Parallel processing** - Concurrent health checks & operations
- **Advanced caching** - Edge cache + KV + memory layers
- **Extended timeouts** - Configurable per operation type

### Tier Configuration

```bash
# Set your Cloudflare Workers plan in .dev.vars or wrangler.toml
TIER="free"  # for Cloudflare Workers Free Plan
TIER="paid"  # for Cloudflare Workers Paid Plan
```

The wireframe automatically optimizes based on your Cloudflare Workers plan:

- **Free Plan**: Fast responses, limited features (optimized for 10ms CPU limit)
- **Paid Plan**: Full functionality, better reliability (up to 30s CPU time)

## 🌩️ Choose Your Cloud Platform

Wireframe v1.2 supports multiple cloud platforms out of the box:

```bash
# Set your preferred cloud platform
CLOUD_PLATFORM=cloudflare  # Default: Cloudflare Workers
CLOUD_PLATFORM=aws         # AWS Lambda + DynamoDB
CLOUD_PLATFORM=gcp         # Google Cloud Functions
```

[Learn more about multi-cloud deployment →](docs/CLOUD_PLATFORMS.md)

## 🚀 Quick Start (Manual Setup)

> **📖 Need detailed setup instructions?** Check out our comprehensive [Setup Guide](SETUP.md) for step-by-step configuration with screenshots and troubleshooting.

### One-Command Deploy

```bash
# Clone and deploy a working Telegram bot in 5 minutes
git clone https://github.com/talkstream/typescript-wireframe-platform.git
cd typescript-wireframe-platform
npm install
npm run setup:bot  # Interactive setup wizard
```

The setup wizard will:

- ✅ Create your Telegram bot via @BotFather
- ✅ Configure all required secrets
- ✅ Create KV namespaces and D1 database
- ✅ Deploy to Cloudflare Workers
- ✅ Set up webhook automatically

### Prerequisites

- Node.js 20+ and npm 10+
- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Telegram Bot Token](https://t.me/botfather)
- AI Provider API Key (optional) - [Google Gemini](https://makersuite.google.com/app/apikey), [OpenAI](https://platform.openai.com/api-keys), [xAI](https://console.x.ai), [DeepSeek](https://platform.deepseek.com), or Cloudflare AI
- [Wrangler CLI](https://developers.cloudflare.com/workers/cli-wrangler/install-update)

### 1. Clone and Install

```bash
git clone https://github.com/talkstream/typescript-wireframe-platform.git
cd typescript-wireframe-platform
npm install

# Verify setup
npm run setup:check
```

### 2. Configure Environment

```bash
# Copy example configuration
cp .dev.vars.example .dev.vars
cp wrangler.toml.example wrangler.toml

# Edit .dev.vars with your values
# TELEGRAM_BOT_TOKEN=your_bot_token_here
# TELEGRAM_WEBHOOK_SECRET=your_secret_here
# AI_PROVIDER=google-ai  # Options: google-ai, openai, xai, deepseek, cloudflare-ai
# GEMINI_API_KEY=your_gemini_key_here  # For Google Gemini
# See .dev.vars.example for more AI provider options
```

### 3. Create D1 Database

```bash
# Create database
wrangler d1 create your-bot-db

# Update wrangler.toml with the database ID
# Run migrations
npm run db:apply:local
```

### 4. Create KV Namespaces

```bash
wrangler kv:namespace create CACHE
wrangler kv:namespace create RATE_LIMIT
wrangler kv:namespace create SESSIONS
```

### 5. Start Development

```bash
npm run dev
```

Your bot is now running locally! Set the webhook URL to test:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://localhost:8787/webhook/<YOUR_SECRET>"}'
```

## 🏗️ Architecture

### Connector-Based Architecture (v1.2)

Wireframe v1.2 introduces a revolutionary connector-based architecture that decouples services from platforms:

```
src/
├── connectors/         # Platform & Service Connectors
│   ├── messaging/      # Messaging platform connectors
│   │   └── telegram/   # Telegram implementation
│   ├── ai/             # AI service connector
│   ├── session/        # Session management connector
│   └── payment/        # Payment service connector
├── core/               # Core framework components
│   ├── events/         # Event bus for decoupled communication
│   ├── plugins/        # Plugin system
│   └── interfaces/     # Core interfaces
├── services/           # Business logic services
│   ├── ai-service.ts   # AI processing logic
│   ├── session-service.ts # Session management
│   └── payment-service.ts # Payment handling
├── plugins/            # Extensible plugins
│   ├── start-plugin.ts # Start command handler
│   ├── ai-plugin.ts    # AI commands plugin
│   └── settings-plugin.ts # User settings plugin
└── index.ts            # Application entry point

examples/
├── telegram-bot/       # Basic Telegram bot example
│   ├── bot.ts          # Complete working bot
│   ├── wrangler.toml   # Deployment configuration
│   └── README.md       # Quick start guide
└── telegram-plugin/    # Plugin system example
    ├── reminder-plugin.ts    # Example reminder plugin
    └── bot-with-plugins.ts   # Bot with plugin integration
```

### Key Design Patterns

- **Connector Pattern** - Platform-agnostic service integration
- **Event-Driven Architecture** - All communication through EventBus
- **Plugin System** - Hot-swappable feature modules
- **Service Abstraction** - Business logic separated from connectors
- **Request/Response Events** - Async service communication
- **Batch Processing** - Optimized API calls
- **Repository Pattern** - Clean data access layer
- **TypeScript Strict Mode** - 100% type safety

## 📦 Examples

### Event-Driven Command

```typescript
// Using the new event-driven architecture
import { Plugin, PluginContext } from './core/plugins/plugin';

export class MyPlugin implements Plugin {
  id = 'my-plugin';

  async install(context: PluginContext) {
    // Register command through plugin system
    context.commands.set('hello', {
      name: 'hello',
      description: 'Greet the user',
      handler: async (args, ctx) => {
        await ctx.reply('👋 Hello from Wireframe v1.2!');

        // Emit custom event
        context.eventBus.emit('greeting:sent', {
          userId: ctx.sender.id,
          timestamp: Date.now(),
        });
      },
    });
  }
}
```

### Service Integration Example

```typescript
// Integrate with AI service through events
context.eventBus.emit('ai:complete', {
  prompt: 'What is the weather today?',
  requestId: 'req_123',
  options: { maxTokens: 500 },
});

// Listen for response
context.eventBus.once('ai:complete:success', (event) => {
  console.log('AI Response:', event.payload.response.content);
});
```

### Connector Communication

```typescript
// Services communicate through standardized events
// Payment example:
context.eventBus.emit('payment:create_invoice', {
  playerId: 123,
  invoiceType: 'premium_upgrade',
  starsAmount: 100,
});

// Session management:
context.eventBus.emit('session:get', {
  userId: 'user123',
  requestId: 'req_456',
});
```

## 🚀 Deployment

### Deploy to Production

```bash
# Deploy to Cloudflare Workers
npm run deploy

# Or deploy to staging first
npm run deploy:staging
```

### Set Production Webhook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-bot.workers.dev/webhook/<YOUR_SECRET>",
    "secret_token": "<YOUR_SECRET>"
  }'
```

### Environment Configuration

Configure secrets for production:

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_WEBHOOK_SECRET
wrangler secret put SENTRY_DSN

# AI Provider Secrets (add only what you need)
wrangler secret put GEMINI_API_KEY      # Google Gemini
wrangler secret put OPENAI_API_KEY      # OpenAI
wrangler secret put XAI_API_KEY         # xAI Grok
wrangler secret put DEEPSEEK_API_KEY    # DeepSeek
wrangler secret put CLOUDFLARE_AI_ACCOUNT_ID
wrangler secret put CLOUDFLARE_AI_API_TOKEN

# Owner configuration
wrangler secret put BOT_OWNER_IDS
```

## 📚 Best Practices

### 1. **Content Management**

All user-facing text should be managed through the content system:

```typescript
const message = contentManager.format('welcome_message', { name: userName });
```

### 2. **Error Handling**

Comprehensive error handling with proper logging:

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', { error, context });
  await ctx.reply('An error occurred. Please try again.');
}
```

### 3. **Rate Limiting**

Apply appropriate rate limits to prevent abuse:

```typescript
app.post('/webhook/:token', rateLimiter({ maxRequests: 20, windowMs: 60000 }), handler);
```

### 4. **Type Safety**

Leverage TypeScript's strict mode for maximum safety:

```typescript
// Always define types for your data structures
interface UserData {
  id: number;
  telegramId: number;
  username?: string; // Use optional properties appropriately
}
```

### 5. **Testing**

Write tests for critical functionality:

```typescript
describe('StartCommand', () => {
  it('should create new user on first interaction', async () => {
    // Test implementation
  });
});
```

**Important Note for Coverage**: This wireframe uses Istanbul coverage provider instead of V8 due to Cloudflare Workers compatibility. The V8 coverage provider relies on `node:inspector` which is not available in the Workers runtime. Istanbul works by instrumenting code at build time, making it compatible with Workers.

## 💡 Perfect Use Cases

This wireframe is **ideal** for:

### 1. **🛍️ E-commerce Bots**

- Product catalogs with D1 database
- Payment processing with Telegram Stars
- Order tracking with KV sessions
- Global edge deployment for fast responses

### 2. **🎮 Gaming & Entertainment Bots**

- Real-time game state in KV storage
- Leaderboards with D1 queries
- In-game purchases via Telegram Stars
- Low-latency gameplay worldwide

### 3. **📊 Analytics & Monitoring Bots**

- Data aggregation and reporting
- Scheduled tasks for regular updates
- Webhook integrations
- Rich interactive dashboards

### 4. **🤝 Customer Support Bots**

- AI-powered responses with Gemini
- Ticket management system
- Multi-language support
- Integration with existing CRM systems

### 5. **📚 Educational & Content Bots**

- Course management with structured content
- Progress tracking in database
- Premium content via payments
- Interactive quizzes and assessments

## ❌ When to Use Different Tools

This wireframe might **not** be the best choice for:

### 1. **📹 Heavy Media Processing**

- **Why not**: Cloudflare Workers have CPU time limits (10ms free / 30s paid)
- **Alternative**: Use traditional servers with FFmpeg or cloud functions with longer timeouts

### 2. **🔄 Long-Running Tasks**

- **Why not**: Workers timeout after 30 seconds
- **Alternative**: Use AWS Lambda, Google Cloud Functions, or traditional servers

### 3. **📦 Large File Storage**

- **Why not**: Workers have memory limits and no persistent file system
- **Alternative**: Combine with R2/S3 for file storage or use traditional hosting

### 4. **🔌 WebSocket Connections**

- **Why not**: Workers don't support persistent WebSocket connections for bots
- **Alternative**: Use Node.js with libraries like node-telegram-bot-api

### 5. **🏛️ Legacy System Integration**

- **Why not**: May require specific libraries or protocols not available in Workers
- **Alternative**: Traditional servers with full OS access or containerized solutions

## 🛠️ Development

### Available Scripts

```bash
npm run dev              # Start local development
npm run test             # Run tests
npm run test:coverage    # Run tests with coverage
npm run lint             # Lint code
npm run typecheck        # Type check
npm run format           # Format code
npm run deploy           # Deploy to production
npm run tail             # View production logs
```

### CI/CD with GitHub Actions

The repository includes GitHub Actions workflows:

- **Test Workflow** - Automatically runs on every push and PR
- **Deploy Workflow** - Optional, requires Cloudflare setup (disabled by default)

To enable automatic deployment:

1. Set up GitHub secrets (see [Setup Guide](SETUP.md))
2. Edit `.github/workflows/deploy.yml` to enable push trigger
3. Ensure all Cloudflare resources are created

### Project Structure

- **Commands** - Add new commands in `src/adapters/telegram/commands/`
- **Callbacks** - Handle button clicks in `src/adapters/telegram/callbacks/`
- **Services** - Business logic in `src/services/`
- **AI Providers** - LLM adapters in `src/lib/ai/adapters/`
- **Database** - Migrations in `migrations/`
- **Tests** - Test files in `src/__tests__/`

### AI Provider System

The wireframe includes a sophisticated multi-provider AI system:

- **🎨 Provider Abstraction** - Switch between AI providers without code changes
- **💰 Cost Tracking** - Monitor usage and costs across all providers
- **🔄 Automatic Fallback** - Failover to backup providers on errors
- **🔔 Smart Selection** - Automatically choose the best available provider
- **🧪 Mock Provider** - Test your bot without API costs

Supported providers:

- Google Gemini (default)
- OpenAI (GPT-4o, GPT-3.5)
- xAI Grok
- DeepSeek
- Cloudflare Workers AI

### Access Control System

The wireframe includes a comprehensive role-based access control system:

- **🔐 Three-tier roles** - Owner, Admin, and User levels
- **📝 Access requests** - Users can request access through the bot
- **✅ Request management** - Admins can approve/reject requests
- **🐛 Debug mode** - Owners can enable tiered debug visibility
- **🌍 Internationalization** - Full i18n support for all messages

#### Role Hierarchy

1. **Owner** (configured via `BOT_OWNER_IDS`)
   - Full bot control and configuration
   - Can manage administrators
   - Access to technical information and debug mode
   - Example commands: `/info`, `/admin`, `/debug`

2. **Admin** (granted by owners)
   - Can review and process access requests
   - See debug messages when enabled (level 2+)
   - Example command: `/requests`

3. **User** (default role)
   - Basic bot functionality
   - Must request access if bot is restricted
   - Example commands: `/start`, `/help`, `/ask`

#### Configuration

```bash
# Required in .dev.vars or secrets
BOT_OWNER_IDS=123456789,987654321  # Comma-separated Telegram user IDs
```

#### Access Request Flow

1. New user starts bot with `/start`
2. If access is restricted, user sees "Request Access" button
3. Admin receives notification and reviews with `/requests`
4. User gets notified when request is approved/rejected
5. Approved users gain full bot functionality

#### Debug Mode

Owners can control debug visibility:

- **Level 1**: Only owners see debug messages
- **Level 2**: Owners and admins see debug messages
- **Level 3**: Everyone sees debug messages

```bash
/debug on 2   # Enable debug for owners and admins
/debug off    # Disable debug mode
/debug status # Check current debug status
```

## 🔒 Security

### Security Best Practices

This wireframe implements multiple layers of security:

1. **Webhook Validation**
   - URL token validation
   - X-Telegram-Bot-Api-Secret-Token header validation (required)
   - Request payload validation with Zod

2. **Rate Limiting**
   - Built-in rate limiting for all endpoints
   - Distributed rate limiting using KV storage

3. **Security Headers**
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - X-XSS-Protection: 1; mode=block
   - Strict Referrer Policy
   - Restrictive Permissions Policy

4. **Data Validation**
   - All input validated with Zod schemas
   - SQL injection prevention with parameterized queries
   - Type-safe data handling throughout

5. **Logging Security**
   - Sensitive headers automatically redacted
   - No PII in logs by default
   - Structured logging with request IDs

### Responsible Disclosure

Found a security vulnerability? Please report it responsibly:

1. **DO NOT** create a public GitHub issue
2. Email security details to: `security@your-domain.com`
3. Include: description, steps to reproduce, potential impact
4. Allow reasonable time for a fix before public disclosure

We appreciate your help in keeping this project secure!

## 🎯 Framework Features

### Plugin System

Extend your bot with modular plugins:

- **🔌 Hot-swappable** - Install/uninstall plugins at runtime
- **📦 Self-contained** - Each plugin manages its own state
- **🔔 Event-driven** - Plugins communicate via event bus
- **💾 Persistent storage** - KV-backed storage per plugin
- **⚡ Lifecycle hooks** - Control plugin behavior

### Event Bus

Decoupled communication between components:

- **📡 Global events** - System-wide notifications
- **🎯 Scoped events** - Plugin-specific namespaces
- **⏱️ Event history** - Track and replay events
- **🔍 Filtering** - Subscribe to specific event types
- **⚡ Async/sync** - Choose your handling strategy

### Multi-Platform Support

The framework is designed for multiple platforms:

- **Telegram** - Full implementation included
- **Discord** - Connector interface ready
- **Slack** - Connector interface ready
- **WhatsApp** - Connector interface ready
- **Custom** - Easy to add new platforms

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- **No `any` types** - Maintain 100% type safety
- **Test coverage** - Write tests for new features
- **Documentation** - Update docs for API changes
- **Security first** - Consider security implications

## 🔧 Recommended MCP Servers

### Accelerate Development with Model Context Protocol

[MCP (Model Context Protocol)](https://modelcontextprotocol.io/) servers enable AI assistants like Claude to interact with your development tools. Here are the recommended MCP servers for this project:

#### Essential MCP Servers

1. **Cloudflare MCP Servers** - [Official Documentation](https://github.com/cloudflare/mcp-server-cloudflare)
   - **Remote servers available at:**
     - Observability: `https://observability.mcp.cloudflare.com/sse`
     - Workers Bindings: `https://bindings.mcp.cloudflare.com/sse`
   - Manage Workers, KV, D1, R2 resources
   - Deploy and configure services
   - Monitor logs and analytics
   - Handle secrets and environment variables

2. **Git MCP Server (GitMCP)** - [GitMCP.io](https://gitmcp.io)
   - **Remote server for this project:** `https://gitmcp.io/talkstream/typescript-wireframe-platform`
   - Access any GitHub repository content instantly
   - No installation required - just use the URL format
   - Read-only access to public repositories
   - Perfect for exploring codebases and documentation

3. **Sentry MCP Server** - [Official Repository](https://github.com/getsentry/sentry-mcp)
   - **Remote server available at:** `https://mcp.sentry.dev`
   - Official server maintained by Sentry
   - Retrieve and analyze error reports
   - Performance monitoring with 16 different tool calls
   - OAuth support for secure authentication
   - Built on Cloudflare's remote MCP infrastructure

#### How These Servers Help This Project

- **Cloudflare Server**: Essential for managing all Cloudflare resources (Workers, KV, D1) used by this bot
- **Git Server**: Access and explore repository content directly without leaving your development environment
- **Sentry Server**: Quickly diagnose production issues reported by your bot users with official Sentry integration

These MCP servers significantly accelerate development by enabling natural language interactions with your tools, reducing context switching, and automating repetitive tasks.

## ⚡ Performance & Cloudflare Plans

### Understanding Cloudflare Workers Limits

This wireframe works on both Free and Paid Cloudflare plans. Here's how different plans affect your bot's capabilities:

#### Free Plan Limits

- **CPU Time**: 10ms per request
- **Daily Requests**: 100,000
- **KV Operations**: 100,000 reads, 1,000 writes per day
- **D1 Database**: 5M reads, 100k writes per day

**Works well for:**

- Simple command bots
- Quick responses without heavy processing
- Bots with up to ~3,000 active daily users
- Basic database operations

#### Paid Plan ($5/month) Benefits

- **CPU Time**: 30 seconds per request (3000x more!)
- **Daily Requests**: 10 million included
- **Queues**: Available for async processing
- **Workers Logs**: 10M events/month with filtering
- **Trace Events**: Advanced debugging capabilities

**Enables advanced features:**

- Complex AI text generation
- Image/file processing
- Bulk operations and broadcasts
- Heavy computational tasks
- Async job processing with Queues
- Advanced analytics and debugging

### Choosing the Right Plan

Most bots work perfectly on the **Free plan**. Consider the **Paid plan** when:

- Your bot uses AI for lengthy text generation
- You need to process files or images
- You're broadcasting to thousands of users
- Your commands involve complex calculations
- You need detailed logs and debugging tools

The wireframe automatically adapts to available resources and will work reliably on both plans.

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[Project Overview](docs/PROJECT_OVERVIEW.md)** - Architecture, technology stack, and quick start guide
- **[Development Guide](docs/DEVELOPMENT_GUIDE.md)** - Local setup, testing, and debugging
- **[Architecture Decisions](docs/ARCHITECTURE_DECISIONS.md)** - Key design choices and rationale
- **[API Reference](docs/API_REFERENCE.md)** - Telegram API types and webhook handling
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment and configuration
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

### Code Patterns

Reusable patterns for common tasks:

- **[Webhook Validation](docs/patterns/webhook-validation.js)** - Secure webhook handling
- **[Error Handling](docs/patterns/error-handling.js)** - Robust error management
- **[Command Router](docs/patterns/command-router.js)** - Flexible command routing
- **[Access Control](docs/patterns/access-control.js)** - Role-based permissions

## 🚀 Roadmap

### Phase 1: Core Enhancements (Days or Hours)

- [ ] Plugin system for modular features
- [ ] Database migrations toolkit
- [ ] Advanced caching strategies
- [ ] WebSocket support for real-time features

### Phase 2: Developer Tools (Days or Hours)

- [ ] CLI tool for scaffolding commands
- [ ] Visual bot flow designer
- [ ] Automated performance profiler
- [ ] Integration test framework

### Phase 3: Ecosystem (Days or Hours)

- [ ] Plugin marketplace
- [ ] Starter templates gallery
- [ ] Community middleware
- [ ] Video tutorials series

### Phase 4: Enterprise Features (Days or Hours)

- [ ] Multi-tenant architecture
- [ ] Advanced analytics dashboard
- [ ] A/B testing framework
- [ ] Compliance tools (GDPR, etc.)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Cloudflare Workers](https://workers.cloudflare.com/) for the amazing edge platform
- [grammY](https://grammy.dev/) for the excellent Telegram bot framework
- [Telegram Bot API](https://core.telegram.org/bots/api) for the powerful bot platform

---

<p align="center">
  Made with ❤️ for the Telegram bot developer community
</p>

<p align="center">
  <a href="https://t.me/nafigator">Contact Author</a> •
  <a href="https://t.me/nafigator">Get Support</a>
</p>
