## Project Context: Wireframe v1.2

### What is Wireframe?

Wireframe is a **universal AI assistant platform** - NOT just a Telegram bot framework. It's designed to:

- Deploy AI assistants on ANY messaging platform (Telegram, Discord, Slack, WhatsApp)
- Run on ANY cloud provider (Cloudflare, AWS, GCP, Azure)
- Support ANY AI model (OpenAI, Anthropic, Google, local models)
- Maintain 100% platform independence through connector architecture

### Current Implementation Status

- **Primary Use Case**: Telegram + Cloudflare Workers (fully implemented)
- **Architecture**: Event-driven with EventBus, Connector pattern, Plugin system
- **Cloud Abstraction**: Complete - CloudPlatformFactory handles all providers
- **TypeScript**: Strict mode, NO any types, all warnings fixed
- **Testing**: Vitest with Istanbul coverage (Cloudflare-compatible)
- **Mock Connectors**: AI and Telegram mock connectors for demo mode deployment
- **Type Guards**: Safe environment variable access with env-guards.ts
- **CI/CD**: GitHub Actions fully working with all checks passing
- **Demo Mode**: Full support for deployment without real credentials

### Key Architecture Decisions

1. **Connector Pattern**: All external services (messaging, AI, cloud) use connectors
2. **Event-Driven**: Components communicate via EventBus, not direct calls
3. **Platform Agnostic**: Zero code changes when switching platforms
4. **Plugin System**: Extensible functionality through hot-swappable plugins
5. **Type Safety**: 100% TypeScript strict mode compliance
6. **Mock Connectors**: Support demo mode for CI/CD and development
7. **Environment Guards**: Type-safe access to optional environment variables
8. **i18n Optimization**: LightweightAdapter for Cloudflare free tier (10ms CPU limit)

### Development Priorities

1. **Maintain Universality**: Always think "will this work on Discord/Slack?"
2. **Cloud Independence**: Never use platform-specific APIs directly
3. **Developer Experience**: Fast setup, clear patterns, comprehensive docs
4. **Real-World Testing**: Use actual bot development to validate the framework
5. **Type Safety First**: Use type guards, avoid any types and non-null assertions (!)
6. **CI/CD Ready**: Maintain demo mode support for automated deployments
7. **Clean Code**: All checks must pass without warnings

### When Working on Wireframe

- Check `/docs/STRATEGIC_PLAN.md` for long-term vision
- Review `/docs/PROJECT_STATE.md` for current implementation status
- Follow connector patterns in `/src/connectors/`
- Test multi-platform scenarios even if implementing for one
- Document decisions that affect platform independence

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

### Recent Achievements (January 2025)

- ✅ Full TypeScript strict mode compliance achieved
- ✅ All TypeScript and ESLint errors fixed
- ✅ Mock connectors implemented for demo deployment
- ✅ GitHub Actions CI/CD pipeline fully operational
- ✅ Type guards pattern established for safe env access
- ✅ i18n optimized with LightweightAdapter for free tier
- ✅ Support for demo mode deployment without credentials

## Project Workflow Guidelines

- Always check for the presence of a STRATEGIC_PLAN.md file in the project's docs directory. If it exists, follow its guidelines.
- Remember to consider Sentry and TypeScript strict mode
- Understand the core essence of the project by referring to documentation and best practices
- Backward compatibility is not required - always ask before implementing it
- When extending functionality, always use the connector/event pattern
- Prioritize developer experience while maintaining architectural integrity
- Use type guards for all optional values - avoid non-null assertions
- Ensure CI/CD compatibility by supporting demo mode

## Recent Changes (v1.2.1)

### Universal Role System

- Created platform-agnostic role management in `/src/core/services/role-service.ts`
- Added interfaces for roles, permissions, and hierarchy in `/src/core/interfaces/role-system.ts`
- Implemented RoleConnector for event-driven role management
- Added TelegramRoleAdapter for backwards compatibility
- Created universal auth middleware in `/src/middleware/auth-universal.ts`
- Database schema updated to support multi-platform roles

### Code Quality Improvements

- Fixed all ESLint warnings and errors
- Resolved TypeScript strict mode issues
- Added proper type guards for optional environment variables
- Removed all non-null assertions in favor of type-safe checks
