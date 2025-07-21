# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2025-01-21

### Added

- **Universal Role System**
  - Platform-agnostic role management service
  - Role hierarchy support (owner > admin > user)
  - Event-driven role change notifications
  - Security connector for access control
  - TelegramRoleAdapter for backwards compatibility
  - Integration with Telegram adapter (dual-mode support)

### Fixed

- All ESLint warnings eliminated (100% clean)
- TypeScript strict mode violations resolved
- Non-null assertions replaced with type guards
- Optional environment variable handling improved

### Changed

- Database schema updated for multi-platform role support
- Auth middleware refactored to use universal role system
- Connector types extended with SECURITY type
- Telegram commands updated for seamless legacy/universal role support
- BotContext enhanced with optional roleService property

## [1.2.0] - 2025-01-20

### 🚨 BREAKING CHANGES

- Complete architecture rewrite for multi-platform support
- `TelegramAdapter` replaced with connector-based architecture
- All services now communicate through EventBus
- Direct Cloudflare dependencies replaced with platform interfaces
- No backward compatibility with v1.x

### ✨ Added

- **Universal Platform Architecture**
  - Multi-cloud support (Cloudflare, AWS, GCP, Azure)
  - Multi-messaging platform interfaces (Telegram implemented, Discord/Slack ready)
  - Platform-agnostic storage interfaces (KV, Database, Object, Cache)
  - Cloud platform factory with registry pattern

- **Event-Driven Architecture**
  - Central EventBus for decoupled communication
  - Scoped event buses for namespaced events
  - Event history and filtering capabilities
  - Async/sync event handling modes

- **Connector System**
  - `ICloudPlatformConnector` for cloud services
  - `IMessagingConnector` for messaging platforms
  - `IMonitoringConnector` for observability
  - `IAIConnector` for AI providers
  - `IPaymentConnector` for payment systems

- **Monitoring Abstraction**
  - Platform-agnostic monitoring interface
  - SentryConnector with dynamic SDK loading
  - MonitoringFactory for creating connectors
  - Support for multiple monitoring providers

- **Plugin System**
  - Hot-swappable plugins with lifecycle hooks
  - Plugin-specific storage and events
  - Command and middleware registration
  - Self-contained plugin architecture

- **Performance Optimizations**
  - Request batching for API calls
  - Duplicate message protection
  - Multi-layer caching system
  - EventBus performance metrics

- **Testing Infrastructure**
  - Integration tests for multi-platform scenarios
  - EventBus performance benchmarks
  - Mock implementations for unfinished connectors
  - 172 tests with 100% TypeScript strict mode

- **Documentation**
  - PROJECT_STATE.md for tracking implementation
  - DEVELOPMENT_WORKFLOW.md for contributors
  - CLOUD_PLATFORMS.md for deployment options
  - Example bot implementations

### 🔧 Changed

- Refactored all services to use connector pattern
- Updated BotContext to include cloud platform and monitoring
- Migrated from direct Cloudflare usage to interfaces
- Enhanced TypeScript strict mode compliance
- Improved error handling with monitoring integration

### 🐛 Fixed

- All TypeScript strict mode warnings (11 total)
- Sentry integration type issues
- Platform detection in various environments
- Session management across platforms

### 📚 Documentation

- Updated README with v1.2 features and examples
- Added comprehensive setup instructions
- Created example implementations
- Enhanced API documentation

## [1.1.2] - 2025-07-18

### Added

- Automated CLAUDE_SETUP.md generation system
  - Single source of truth configuration in docs/setup-config.json
  - Node.js generator script with checksum validation
  - GitHub Action for automated documentation updates
  - Pre-commit hook for synchronization checks
- Comprehensive CLAUDE_SETUP_MAINTENANCE.md documentation
- New npm scripts: `docs:generate` and `docs:check`
- AI-friendly badges and quick start sections in README files

### Changed

- CLAUDE_SETUP.md now generated from structured configuration
- Enhanced setup instructions with progress indicators
- Improved error handling documentation

## [1.1.1] - 2025-07-18

### Fixed

- Documentation pattern files now include comprehensive headers explaining their purpose and referencing actual wireframe files
- Fixed ESLint errors in documentation pattern files:
  - Added proper function parameter prefixes for unused parameters
  - Added mock implementations for Sentry (Toucan.js) integration examples
  - Resolved undefined reference errors in command-router.js and webhook-validation.js
- Applied consistent code formatting across all documentation files

### Changed

- Enhanced documentation patterns to better demonstrate actual wireframe implementation patterns
- Pattern files now serve as working examples that reference the corresponding production code

## [1.1.0] - 2025-07-18

### Added

- Example implementation of role-based access control system
  - Owner, Admin, and User roles with hierarchical permissions
  - Access request workflow with approval/rejection example
  - Admin notification system for new access requests
  - Inline keyboard UI examples for access management
- Example owner-exclusive commands
  - `/admin` - Example command for managing admin users (add, remove, list)
  - `/debug` - Example command for controlling debug mode with 3 visibility levels
  - `/info` - Example command for viewing system information and statistics
- Example admin command
  - `/requests` - Example for reviewing and processing access requests
- Example access callbacks for user interaction
  - Request access, cancel request, approve/reject workflow examples
  - Next request navigation for efficient processing
- Complete test coverage for all example features
  - Auth middleware tests
  - Owner command tests
  - Admin command tests
  - Access callback tests
  - AI service tests
- Example security patterns with granular permission checks
- Example error visibility with debug mode levels
  - Level 1: Owners see all debug messages
  - Level 2: Owners and admins see debug messages
  - Level 3: All users see debug messages

### Changed

- Start command example now includes access control checks
- Example bot configuration requires explicit access grant for new users
- Enhanced user session example with role tracking

### Fixed

- Added comprehensive i18n support for all example messages
- Fixed test mocking for InlineKeyboard
- Resolved all test failures with proper mock context

### Removed

- Removed AI_MIGRATION_GUIDE.md (no longer needed)

## [1.0.2] - 2025-07-18

### Added

- Tier-based optimization system for Cloudflare Workers free/paid plans
  - Automatic adaptation to CPU time limits (10ms free, 30s paid)
  - Lightweight adapter for free tier with minimal features
  - Full-featured mode for paid tier with all capabilities
- Request batching for Telegram API calls to reduce overhead
- Multi-layer caching system (memory → KV → edge)
- Timeout wrappers for external API calls with tier-aware configurations
- Example commands demonstrating new optimization features
  - `/ask` - AI command with tier checking
  - `/batch` - Demonstrates request batching

### Changed

- Parallelized health checks for better performance
- Enhanced session service with TTL support and auto-cleanup
- Optimized service initialization based on tier
- Updated Gemini service with retry logic and timeouts
- Clarified in README that wireframe is 100% free, tiers refer to Cloudflare plans

### Fixed

- All TypeScript strict mode warnings eliminated
- ESLint warnings resolved for professional code quality
- Fixed type definitions for optional Gemini service
- Added missing i18n translations

## [1.0.1] - 2025-07-17

### Fixed

- Made Cloudflare deployment optional in release workflow
- Improved resilience for missing Cloudflare configuration

## [1.0.0] - 2025-07-17

### Added

- Initial wireframe implementation for Telegram bots on Cloudflare Workers
- Full TypeScript support with strict mode configuration
- grammY bot framework integration
- Cloudflare D1 database support with migrations
- Cloudflare KV storage for sessions and rate limiting
- Google Gemini AI integration (optional)
- Sentry error tracking and monitoring
- Comprehensive testing suite with Vitest
- CI/CD pipeline with GitHub Actions
- Multi-environment support (development, staging, production)
- Telegram Stars payment system integration
- Internationalization (i18n) support
- Health check endpoint
- Scheduled tasks (cron) support
- Rate limiting middleware
- Security features including webhook validation
- Russian README translation
- Cloudflare pricing information in documentation

### Security

- Enhanced security measures for public repository
- Removed personal information from public files
- Added webhook signature validation
- Implemented secure token handling

### Fixed

- Replaced V8 coverage with Istanbul for Cloudflare Workers compatibility
- Resolved all TypeScript and ESLint errors
- Fixed CI/CD resilience to missing configuration
- Corrected test mock issues
- Fixed GitHub Actions and test errors
- Made wireframe fully functional for developers
- Updated package versions and fixed related tests

### Changed

- Formatted code with Prettier across the project
- Updated contact links
- Cleaned up deployment history
- Improved overall wireframe structure for better developer experience

### Documentation

- Added comprehensive README in English and Russian
- Created CLAUDE.md for project-specific instructions
- Added setup and deployment guides
- Included architectural documentation

[1.1.0]: https://github.com/talkstream/telegram-bot-on-cloudflare-workers/releases/tag/v1.1.0
[1.0.2]: https://github.com/talkstream/telegram-bot-on-cloudflare-workers/releases/tag/v1.0.2
[1.0.1]: https://github.com/talkstream/telegram-bot-on-cloudflare-workers/releases/tag/v1.0.1
[1.0.0]: https://github.com/talkstream/telegram-bot-on-cloudflare-workers/releases/tag/v1.0.0
