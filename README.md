# 🚀 TypeScript Wireframe Platform

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
  <strong>Universal platform for building AI assistants and bots on any cloud with TypeScript</strong>
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

### Performance & Resilience

- **🚀 Connection Pooling** - Optimized resource management for Telegram and AI connectors
- **💾 Tiered Caching** - Multi-layer caching with TTL support and automatic promotion/demotion
- **📦 Bundle Optimization** - Tree-shaking improvements, reduced bundle size to ~560KB
- **🛡️ Circuit Breaker** - Automatic failure detection and recovery for external services
- **📊 Sentry Monitoring** - Comprehensive error tracking and performance monitoring
- **🔄 FieldMapper** - Type-safe database field transformations

### Production Patterns

- **Event-driven architecture** with EventBus for decoupled communication
- **Service connectors** for AI, Session, and Payment services
- **Plugin system** for extensible functionality
- **Request batching** for optimized API calls
- **Notification system** for multi-platform messaging (from Kogotochki bot)

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
- **📘 TypeScript** - 100% type safety with strict mode, zero `any` types
- **🤖 Universal Bot Framework** - Support for Telegram, Discord, Slack, WhatsApp
- **🧠 Multi-AI Support** - OpenAI, Anthropic, Google AI, local models
- **🗄️ Database Abstraction** - Works with D1, PostgreSQL, MySQL, SQLite
- **💾 Storage Solutions** - KV stores, object storage, caching layers

### Architecture Highlights

- **🔌 Connector Pattern** - Plug-and-play integrations for any service
- **📡 Event-Driven** - Decoupled components via EventBus
- **🔄 Resource Pooling** - Efficient connection management
- **🛡️ Resilience Patterns** - Circuit breakers, retries, fallbacks
- **📊 Observability** - Built-in monitoring and tracing
- **🚀 Performance First** - Optimized for edge computing

### Developer Experience

- **🎯 AI-First Development** - Optimized for Claude Code, Cursor, and AI assistants
- **📝 100% Type Safety** - No `any` types, full TypeScript strict mode
- **🔥 Hot Reload Support** - Live browser reload during development
- **🧪 Comprehensive Testing** - Unit, integration, and performance tests
- **📚 Rich Documentation** - Detailed guides and examples
- **🔧 CLI Tools** - Project generation and management
- **🎨 Clean Architecture** - SOLID principles, clean code

### Security & Performance

- **🔒 Global Rate Limiting** - Configurable policies for all endpoints
- **🛡️ DDoS Protection** - Burst limiting and traffic spike prevention
- **⚡ Edge Optimized** - Sub-10ms response times on Cloudflare Workers
- **📊 Resource Monitoring** - Built-in health checks and metrics

---

## 🚀 Quick Start (Manual Setup)

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account (free tier works)
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))

### 1. Clone and Install

```bash
git clone https://github.com/talkstream/typescript-wireframe-platform.git
cd typescript-wireframe-platform
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your bot token and settings
```

### 3. Set Up Database

```bash
# Create D1 database
npx wrangler d1 create wireframe-db

# Run migrations
npm run db:migrate
```

### 4. Start Development

```bash
# Local development
npm run dev

# Development with hot reload
npm run dev:hot

# Run tests
npm test

# Deploy to Cloudflare
npm run deploy
```

---

## 🏗️ Architecture

### Platform-Agnostic Design

```
┌─────────────────────────────────────────────┐
│            Application Layer                 │
│  (Your Bot Logic / Business Rules)          │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│           Wireframe Core                    │
│  (EventBus, Plugins, Services, Pools)       │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│           Connector Layer                   │
│  (Messaging, AI, Storage, Cloud)            │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│         Platform Providers                  │
│  (Telegram, OpenAI, Cloudflare, AWS...)     │
└─────────────────────────────────────────────┘
```

### Key Components

- **EventBus** - Central event system for decoupled communication
- **Connectors** - Adapters for external services (AI, messaging, storage)
- **Services** - Business logic containers (auth, sessions, payments)
- **Plugins** - Extensible functionality modules
- **Pools** - Resource management for connections

---

## 📚 Documentation

### Core Guides

- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Connector System](./docs/CONNECTORS.md)
- [Plugin Development](./docs/PLUGINS.md)
- [Event System](./docs/EVENTS.md)

### Performance & Optimization

- [Connection Pooling](./docs/CONNECTION_POOLING.md)
- [Caching Strategies](./docs/CACHING.md)
- [Bundle Optimization](./docs/BUNDLE_OPTIMIZATION.md)
- [Circuit Breaker Pattern](./docs/CIRCUIT_BREAKER.md)

### Production Patterns

- [Notification System](./docs/NOTIFICATION_SYSTEM.md)
- [Role-Based Access](./docs/RBAC.md)
- [Monitoring Setup](./docs/MONITORING.md)
- [Database Patterns](./docs/DATABASE_PATTERNS.md)

### Deployment

- [Cloudflare Workers](./docs/deploy/CLOUDFLARE.md)
- [AWS Lambda](./docs/deploy/AWS.md)
- [Google Cloud Functions](./docs/deploy/GCP.md)
- [Self-Hosted](./docs/deploy/SELF_HOSTED.md)

---

## 🗺️ Roadmap

### Current Focus (v1.3)

- ✅ Performance optimizations (pooling, caching)
- ✅ Resilience patterns (circuit breaker)
- ✅ Bundle size optimization
- ✅ Sentry monitoring integration

### Next (v1.4)

- 🔄 Health check endpoints
- 🔄 Interactive setup wizard
- 🔄 Hot reload support
- 🔄 95% test coverage

### Future

- 🎯 More messaging platforms (Discord, Slack, WhatsApp)
- 🎯 Additional AI providers (Anthropic, Cohere, local models)
- 🎯 Visual bot builder
- 🎯 Plugin marketplace
- 🎯 Enterprise features

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### How to Contribute

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Principles

- **Type Safety First** - No `any` types, full strict mode
- **Clean Code** - Follow SOLID principles
- **Test Coverage** - Write tests for new features
- **Documentation** - Update docs with changes
- **Performance** - Consider edge computing constraints

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [grammY](https://grammy.dev/) - Modern Telegram Bot Framework
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge Computing Platform
- [TypeScript](https://www.typescriptlang.org/) - Type-Safe JavaScript
- Community contributors and supporters

---

<p align="center">
  Made with ❤️ by the Wireframe Community
</p>

<p align="center">
  <a href="https://github.com/talkstream/typescript-wireframe-platform">GitHub</a> •
  <a href="https://t.me/wireframe_community">Telegram Community</a> •
  <a href="./docs">Documentation</a>
</p>
