# Wireframe Packages

This directory contains all Wireframe ecosystem packages following a monorepo structure.

## Package Structure

```
packages/
├── core/                    # @wireframe/core - Vendor-agnostic core
├── connectors/             # Platform connectors
│   ├── telegram/          # @wireframe/connector-telegram
│   ├── discord/           # @wireframe/connector-discord
│   ├── openai/            # @wireframe/connector-openai
│   └── cloudflare/        # @wireframe/connector-cloudflare
├── plugins/                # Feature plugins
│   ├── analytics/         # @wireframe/plugin-analytics
│   ├── admin-panel/       # @wireframe/plugin-admin-panel
│   └── rate-limiter/      # @wireframe/plugin-rate-limiter
├── templates/              # Bot templates
│   ├── basic/            # @wireframe/template-basic
│   └── enterprise/       # @wireframe/template-enterprise
├── sdk/                    # @wireframe/sdk - Package development SDK
└── cli/                    # @wireframe/cli - Command-line tool
```

## Development

Each package is independently versioned and published to npm.

### Creating a New Package

```bash
wireframe create-package connector-whatsapp
wireframe create-package plugin-payments
```

### Package Requirements

1. **TypeScript** - 100% TypeScript with strict mode
2. **Tests** - Comprehensive test coverage
3. **Docs** - Clear README and API documentation
4. **License** - MIT for open source, proprietary for premium
5. **Version** - Semantic versioning (semver)

### Publishing

```bash
cd packages/connectors/telegram
npm version patch
npm publish --access public
```

## Core Principles

- **Zero vendor lock-in** - Core never imports vendor code
- **Tree-shakeable** - Only bundle what's used
- **Type-safe** - Full TypeScript support
- **Lazy-loadable** - Dynamic imports for performance
- **Well-tested** - 95%+ coverage target
