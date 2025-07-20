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

### Key Architecture Decisions
1. **Connector Pattern**: All external services (messaging, AI, cloud) use connectors
2. **Event-Driven**: Components communicate via EventBus, not direct calls
3. **Platform Agnostic**: Zero code changes when switching platforms
4. **Plugin System**: Extensible functionality through hot-swappable plugins
5. **Type Safety**: 100% TypeScript strict mode compliance

### Development Priorities
1. **Maintain Universality**: Always think "will this work on Discord/Slack?" 
2. **Cloud Independence**: Never use platform-specific APIs directly
3. **Developer Experience**: Fast setup, clear patterns, comprehensive docs
4. **Real-World Testing**: Use actual bot development to validate the framework

### When Working on Wireframe
- Check `/docs/STRATEGIC_PLAN.md` for long-term vision
- Review `/docs/PROJECT_STATE.md` for current implementation status
- Follow connector patterns in `/src/connectors/`
- Test multi-platform scenarios even if implementing for one
- Document decisions that affect platform independence

## Project Workflow Guidelines

- Always check for the presence of a STRATEGIC_PLAN.md file in the project's docs directory. If it exists, follow its guidelines.
- Remember to consider Sentry and TypeScript strict mode
- Understand the core essence of the project by referring to documentation and best practices
- Backward compatibility is not required - always ask before implementing it
- When extending functionality, always use the connector/event pattern
- Prioritize developer experience while maintaining architectural integrity
