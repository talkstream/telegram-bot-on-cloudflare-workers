## Current Version: v2.0.0

## 🚨 CRITICAL: VENDOR-AGNOSTIC ECOSYSTEM TRANSFORMATION IN PROGRESS

### ⚠️ DO NOT REVERT TO OLD PATTERNS!

**Wireframe is NO LONGER a framework - it's becoming a vendor-agnostic ECOSYSTEM**

**MANDATORY READING BEFORE ANY WORK**:

1. 📖 [WIREFRAME_ECOSYSTEM_VISION.md](./WIREFRAME_ECOSYSTEM_VISION.md) - The new vision and strategy
2. 🏗️ [docs/ECOSYSTEM_ARCHITECTURE.md](./docs/ECOSYSTEM_ARCHITECTURE.md) - Technical architecture

### Core Principles Moving Forward:

- **NO vendor-specific code in core** - Everything vendor-related goes in connectors
- **Package-first development** - Every feature is a package (@wireframe/core, @wireframe/connector-telegram, etc.)
- **Registry pattern** - All extensions loaded through registry, not imports
- **Marketplace mindset** - Build for reusability and monetization
- **NEVER suppress warnings** - Always refactor properly instead of using eslint-disable
- **Performance-first architecture** - 145x bundle size reduction achieved

## Current Version: v2.0.0-alpha.1 (Ecosystem Transformation Complete)

## Project Context: Wireframe Ecosystem

### What is Wireframe NOW?

Wireframe is transforming into a **vendor-agnostic ecosystem** - a universal platform for building AI assistants. It provides:

- Deploy AI assistants on ANY messaging platform (Telegram, Discord, Slack, WhatsApp)
- Run on ANY cloud provider (Cloudflare, AWS, GCP, Azure)
- Support ANY AI model (OpenAI, Anthropic, Google, local models)
- Maintain 100% platform independence through connector architecture

### Current Implementation Status (v2.0.0-alpha.1)

- **Ecosystem Architecture**: Vendor-agnostic modular package system
- **Core Bundle**: 4.1KB ultra-lightweight core (@wireframe/core)
- **Cold Start Performance**: 47ms average startup time
- **Package Structure**: Modular connectors (@wireframe/connector-telegram, @wireframe/connector-openai)
- **Registry Pattern**: Dynamic extension loading without build-time imports
- **EventBus Architecture**: 100% event-driven communication
- **Performance Metrics**: 145x bundle size reduction from monolith architecture
- **TypeScript**: Strict mode, NO any types, all warnings fixed
- **Testing**: Vitest with Istanbul coverage (Cloudflare-compatible)
- **Mock Connectors**: AI and Telegram mock connectors for demo mode deployment
- **Type Guards**: Safe environment variable access with env-guards.ts
- **CI/CD**: GitHub Actions fully working with all checks passing
- **Demo Mode**: Full support for deployment without real credentials

### Key Architecture Decisions (v2.0 Ecosystem)

1. **Registry Pattern**: All extensions loaded through registry, eliminating build-time imports
2. **EventBus Architecture**: 100% event-driven communication, zero direct dependencies
3. **Modular Package System**: Core (@wireframe/core) + connectors as separate packages
4. **Vendor Abstraction**: Zero vendor-specific code in core, everything in connectors
5. **Performance Optimization**: 4.1KB core bundle, 47ms cold starts, 145x size reduction
6. **Type Safety**: 100% TypeScript strict mode compliance, no warnings suppression
7. **Mock Connectors**: Support demo mode for CI/CD and development
8. **Environment Guards**: Type-safe access to optional environment variables
9. **Cloudflare Optimization**: Sub-10ms CPU usage on free tier

### Development Priorities (v2.0 Ecosystem)

1. **Package-First Development**: Every feature as modular package (@wireframe/\*)
2. **Registry-Based Architecture**: Load extensions through registry, not imports
3. **Performance Optimization**: Sub-5KB bundles, sub-50ms cold starts
4. **Vendor Independence**: Zero vendor-specific code in core packages
5. **Type Safety First**: Use type guards, avoid any types and non-null assertions (!)
6. **Warning-Free Code**: NEVER suppress warnings, always refactor properly
7. **Event-Driven Design**: Components communicate only via EventBus
8. **Marketplace Readiness**: Build for reusability and potential monetization

### When Working on Wireframe

- Check `/docs/STRATEGIC_PLAN.md` for long-term vision
- Review `/docs/PROJECT_STATE.md` for current implementation status
- Follow connector patterns in `/src/connectors/`
- Test multi-platform scenarios even if implementing for one
- Document decisions that affect platform independence

### Important Directory Notes

- **`/website/`** - Separate documentation website project (do not modify)
- **`/examples/`** - User examples and templates (do not modify)
- **`/docs/patterns/*.js`** - Documentation patterns with code examples (not actual code)
- **`/backup/`** - Legacy files for reference (will be removed)

### TypeScript Best Practices

1. **Type Guards over Assertions**: Use type guards instead of non-null assertions (!)
   - Example: See `/src/lib/env-guards.ts` for environment variable handling
   - Always validate optional values before use

2. **Strict Mode Compliance**:
   - No `any` types allowed
   - Handle all possible undefined/null cases
   - Use proper type narrowing

3. **Environment Variables**:
   - Use `isDemoMode()`, `getBotToken()`, etc. from env-guards
   - Never access env.FIELD directly without checks
   - Support graceful fallbacks for optional configs

### v2.0.0-alpha.1 Ecosystem Achievements (August 2025)

- ✅ **Vendor-Agnostic Ecosystem Transformation Complete**
  - Successfully transformed from monolith framework to modular ecosystem
  - Zero vendor-specific code in core packages
  - Registry pattern implementation for dynamic extension loading
- ✅ **Performance Metrics Achieved**
  - **4.1KB core bundle** - Ultra-lightweight @wireframe/core package
  - **47ms cold start** - Average startup time on Cloudflare Workers
  - **145x bundle size reduction** - From monolith to modular architecture
  - **Sub-10ms CPU usage** - Optimized for Cloudflare free tier limits
- ✅ **Modular Package Structure Created**
  - **@wireframe/core** - Core event bus and registry system
  - **@wireframe/connector-telegram** - Telegram messaging connector
  - **@wireframe/connector-openai** - OpenAI AI provider connector
  - **@wireframe/connector-cloudflare** - Cloudflare platform connector
- ✅ **Technical Architecture Implemented**
  - **Registry Pattern** - Zero build-time imports, pure runtime loading
  - **EventBus Architecture** - 100% event-driven communication
  - **Connector Abstraction** - Unified interfaces for all external services
  - **Type-Safe Packages** - Full TypeScript strict mode compliance
- ✅ **Warning-Free Codebase**
  - **Zero ESLint warnings** across all packages
  - **Zero TypeScript errors** in strict mode
  - **Proper refactoring** instead of warning suppression
  - **Production-ready code quality**

### Previous Achievements (v1.3.0 and Earlier)

- ✅ Full TypeScript strict mode compliance achieved
- ✅ All TypeScript and ESLint errors fixed
- ✅ Mock connectors implemented for demo deployment
- ✅ GitHub Actions CI/CD pipeline fully operational
- ✅ Type guards pattern established for safe env access
- ✅ i18n optimized with LightweightAdapter for free tier
- ✅ Support for demo mode deployment without credentials
- ✅ Multi-provider AI system with Gemini 2.0 Flash support
- ✅ Production insights from Kogotochki bot integrated (PR #14)
- ✅ ESLint database mapping rules activated from Kogotochki experience (July 2025)
- ✅ Updated to zod v4 and date-fns v4 for better performance
- ✅ Development dependencies updated: commander v14, inquirer v12
- ✅ All dependencies current as of January 25, 2025
- ✅ **All ESLint warnings fixed** - 0 warnings in main project code
- ✅ **FieldMapper pattern implemented** for type-safe DB transformations

### AI Provider System

For information on using AI providers and adding custom models (like gemini-2.0-flash-exp):

- See `/docs/AI_PROVIDERS.md` for comprehensive guide
- `gemini-service.ts` is actively used (not legacy)

## Project Workflow Guidelines (v2.0 Ecosystem)

- **READ ECOSYSTEM DOCS FIRST**: Review WIREFRAME_ECOSYSTEM_VISION.md and docs/ECOSYSTEM_ARCHITECTURE.md
- **Package-First Development**: Build every feature as a modular @wireframe/\* package
- **Registry Pattern**: Load all extensions through registry, never direct imports
- **Event-Driven Architecture**: Use EventBus for all component communication
- **Zero Vendor Code in Core**: Keep vendor-specific code in connector packages only
- **Warning-Free Policy**: NEVER suppress warnings - always refactor properly
- **Performance Targets**: Maintain sub-5KB bundles and sub-50ms cold starts
- **Type Safety First**: Use type guards, avoid any types and non-null assertions
- **Demo Mode Support**: Ensure CI/CD compatibility with mock connectors
- **Marketplace Mindset**: Build for reusability and potential monetization

## Recent Changes

### v2.0.0-alpha.1 - Ecosystem Transformation (August 2025)

- **🏗️ Vendor-Agnostic Architecture Completed**
  - Transformed from monolith framework to modular ecosystem
  - Achieved zero vendor-specific code in core packages
  - Implemented Registry pattern for runtime extension loading
  - Created @wireframe/core with 4.1KB ultra-lightweight bundle

- **📦 Modular Package System**
  - **@wireframe/core** - Event bus, registry, and core interfaces (4.1KB)
  - **@wireframe/connector-telegram** - Grammy-based messaging connector
  - **@wireframe/connector-openai** - OpenAI API integration
  - **@wireframe/connector-cloudflare** - Workers platform abstraction
  - Each package independently versioned and distributed

- **⚡ Performance Optimization Achieved**
  - **145x bundle size reduction** from monolith architecture
  - **47ms average cold start** on Cloudflare Workers
  - **Sub-10ms CPU usage** for free tier optimization
  - EventBus overhead minimized to microseconds

- **🔧 Technical Implementation**
  - Registry pattern eliminates build-time imports
  - 100% event-driven communication via EventBus
  - Type-safe connector interfaces across all packages
  - Mock connector support for demo deployments

- **✅ Code Quality Standards**
  - Zero ESLint warnings across all packages
  - Zero TypeScript errors in strict mode
  - Proper refactoring instead of warning suppression
  - Production-ready codebase with comprehensive tests

### v1.3.0 - ESLint Database Mapping Rules (July 25, 2025)

- **Activated custom ESLint rules** from Kogotochki production experience:
  - **`db-mapping/no-snake-case-db-fields`** - Prevents direct access to snake_case fields
  - **`db-mapping/require-boolean-conversion`** - Ensures SQLite 0/1 to boolean conversion
  - **`db-mapping/require-date-conversion`** - Requires date string to Date object conversion
  - **`db-mapping/use-field-mapper`** - Suggests FieldMapper for 3+ field transformations
- **Fixed ESLint rule implementation**:
  - Removed unused variables (5 errors fixed)
  - Fixed recursive traversal issue in use-field-mapper
  - Applied proper formatting to all rule files
- **Production impact**: Prevents silent data loss bugs discovered in Kogotochki bot

### v1.2.2 - Middleware Architecture (January 21, 2025)

### Middleware Architecture Refactoring

- **Reorganized middleware structure** following v1.2 connector pattern:
  - Moved auth.ts from general middleware to `/src/adapters/telegram/middleware/`
  - Created universal interfaces in `/src/core/middleware/interfaces.ts`
  - Separated HTTP middleware (Hono) from platform middleware (Grammy)

- **Created Telegram-specific middleware**:
  - **auth.ts** - Authentication via Grammy using UniversalRoleService
  - **rate-limiter.ts** - Request rate limiting with EventBus integration
  - **audit.ts** - Action auditing with KV storage persistence

- **Updated HTTP middleware for EventBus**:
  - **event-middleware.ts** - HTTP request lifecycle tracking
  - **error-handler.ts** - Error handling with event emission
  - **rate-limiter.ts** - Added events for rate limit violations

- **Fixed all TypeScript warnings**:
  - Created `types/grammy-extensions.ts` with proper Grammy types
  - Replaced all `any` types with strictly typed interfaces
  - Full TypeScript strict mode compliance achieved

### Current Middleware Architecture

```
/src/middleware/              - HTTP middleware (Hono)
  ├── error-handler.ts       - HTTP error handling
  ├── event-middleware.ts    - EventBus integration
  ├── rate-limiter.ts       - HTTP rate limiting
  └── index.ts              - HTTP middleware exports

/src/adapters/telegram/middleware/  - Telegram middleware (Grammy)
  ├── auth.ts               - Role-based authorization
  ├── rate-limiter.ts       - Telegram rate limiting
  ├── audit.ts              - Action auditing
  └── index.ts              - Telegram middleware exports

/src/core/middleware/         - Universal interfaces
  └── interfaces.ts         - Platform-agnostic contracts
```

### v1.2.1 - Universal Role System

- Created platform-agnostic role management in `/src/core/services/role-service.ts`
- Added interfaces for roles, permissions, and hierarchy in `/src/core/interfaces/role-system.ts`
- Implemented RoleConnector for event-driven role management
- Added TelegramRoleAdapter for backwards compatibility
- Created universal auth middleware in `/src/middleware/auth-universal.ts`
- Database schema updated to support multi-platform roles
- **Integrated role system into Telegram adapter** with dual-mode support:
  - LightweightAdapter now initializes UniversalRoleService when DB available
  - Admin commands work seamlessly with both legacy and universal systems
  - Help command adapts to available role service
  - Full backwards compatibility maintained

### Code Quality Improvements

- Fixed all ESLint warnings and errors
- Resolved TypeScript strict mode issues
- Added proper type guards for optional environment variables
- Removed all non-null assertions in favor of type-safe checks
- NO backward compatibility - clean architecture implementation

## Contributing Back to Wireframe

When user asks to "contribute" something to Wireframe:

1. Run `npm run contribute` for interactive contribution
2. Check `docs/EASY_CONTRIBUTE.md` for automated workflow
3. Reference `CONTRIBUTING.md` for manual process

### Quick Commands for Claude Code

- `contribute this` - auto-detect and prepare contribution
- `contribute pattern` - share a reusable pattern
- `contribute optimization` - share performance improvement
- `contribute fix` - share bug fix with context

The automated tools will:

- Analyze changes
- Generate tests
- Create PR template
- Handle git operations

This integrates with the Bot-Driven Development workflow described in CONTRIBUTING.md.

## Production Patterns from Kogotochki Bot

Battle-tested patterns from real production deployment with 100+ daily active users:

### KV Cache Layer Pattern

- **Impact**: 70% reduction in database queries
- **Use cases**: AI provider configs, i18n translations, user preferences
- **Location**: `/contrib/patterns/001-kv-cache-layer.md`
- **Key benefits**: Reduced latency, lower costs, better UX

### CloudPlatform Singleton Pattern

- **Impact**: 80%+ improvement in response time (3-5s → ~500ms)
- **Problem solved**: Repeated platform initialization on each request
- **Location**: `/contrib/performance/001-cloudplatform-singleton.md`
- **Critical for**: Cloudflare Workers free tier (10ms CPU limit)

### Lazy Service Initialization

- **Impact**: 30% faster cold starts, 40% less memory usage
- **Problem solved**: Services initialized even when not needed
- **Location**: `/contrib/performance/002-lazy-service-initialization.md`
- **Especially important for**: AI services, heavy middleware

### Type-Safe Database Field Mapping

- **Impact**: Prevents silent data loss in production
- **Problem solved**: snake_case (DB) ↔ camelCase (TS) mismatches
- **Location**: `/contrib/patterns/002-database-field-mapping.md`
- **Critical for**: Any database operations

These patterns are designed to work within Cloudflare Workers' constraints while maintaining the universal architecture of Wireframe.
