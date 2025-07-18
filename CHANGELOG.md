# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
