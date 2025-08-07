# 🏛️ Architecture Decision Records (ADRs)

This document captures the key architectural decisions made in this wireframe, providing context and rationale for future developers.

## ADR-001: Cloudflare Workers as Runtime Platform

### Status

Accepted

### Context

We needed a platform for running Telegram bots that provides:

- Global distribution
- Minimal operational overhead
- Cost-effective scaling
- Fast response times

### Decision

We chose Cloudflare Workers over traditional hosting (VPS, containers, serverless functions).

### Rationale

1. **Edge Computing**: Code runs in 200+ locations worldwide
2. **No Cold Starts**: Workers stay warm in active regions
3. **Automatic Scaling**: No capacity planning needed
4. **Built-in Security**: DDoS protection, SSL, firewall rules
5. **Cost Model**: Pay only for actual usage, generous free tier

### Consequences

- **Positive**: Ultra-low latency, global presence, zero DevOps
- **Negative**: 10ms CPU limit on free tier, no persistent connections
- **Mitigation**: Tier-aware adapters, efficient code patterns

## ADR-002: Webhook Architecture over Polling

### Status

Accepted

### Context

Telegram bots can receive updates via:

1. Long polling (getUpdates)
2. Webhooks (setWebhook)

### Decision

This wireframe exclusively uses webhooks.

### Rationale

1. **Real-time**: Messages processed immediately
2. **Efficient**: No wasted API calls checking for updates
3. **Scalable**: Cloudflare handles any load automatically
4. **Natural Fit**: Workers are designed for webhook-style workloads

### Consequences

- **Positive**: Better user experience, lower costs, simpler code
- **Negative**: Requires HTTPS endpoint, can't run purely locally
- **Mitigation**: Wrangler provides local HTTPS tunnel for development

## ADR-003: Multi-Tier Storage Strategy

### Status

Accepted

### Context

Bots need to store various types of data:

- User sessions
- Application state
- Persistent data
- Temporary cache

### Decision

Use a hierarchical storage approach:

1. **Memory Cache**: Ultra-fast, request-scoped
2. **KV Storage**: Fast, globally distributed sessions
3. **D1 Database**: Structured data with SQL
4. **Durable Objects**: Complex state coordination (optional)

### Rationale

Each storage type serves specific needs:

- Memory: Sub-millisecond access for hot data
- KV: Session management with global replication
- D1: Complex queries and relationships
- DO: Real-time coordination and state machines

### Consequences

- **Positive**: Optimal performance for each use case
- **Negative**: Multiple storage APIs to learn
- **Mitigation**: Unified service layer abstracts complexity

## ADR-004: TypeScript with Strict Mode

### Status

Accepted

### Context

JavaScript is the native language for Workers, but lacks type safety.

### Decision

Use TypeScript exclusively with:

- Strict mode enabled
- No `any` types allowed
- Comprehensive type definitions
- Zod for runtime validation

### Rationale

1. **Developer Experience**: Catch errors at compile time
2. **Maintainability**: Self-documenting code
3. **Refactoring Safety**: Confident code changes
4. **API Integration**: Full Telegram API type coverage

### Consequences

- **Positive**: Fewer runtime errors, better IDE support
- **Negative**: Initial setup complexity, learning curve
- **Positive**: Faster development after initial investment

## ADR-005: Tier-Based Optimization

### Status

Accepted

### Context

Cloudflare Workers has different limits for free vs paid tiers:

- Free: 10ms CPU time
- Paid: 30s CPU time

### Decision

Implement adaptive architecture with two modes:

1. **Lightweight Adapter**: Optimized for free tier
2. **Full Adapter**: All features for paid tier

### Rationale

1. **Accessibility**: Anyone can start for free
2. **Progressive Enhancement**: Upgrade when needed
3. **Cost Optimization**: Pay only for what you use
4. **Performance**: Each tier runs optimally

### Implementation

```typescript
const adapter =
  env.TIER === 'free' ? new LightweightAdapter(bot, env) : new TelegramAdapter(bot, env)
```

### Consequences

- **Positive**: Inclusive pricing model, optimal performance
- **Negative**: Two code paths to maintain
- **Mitigation**: Shared interfaces, comprehensive testing

## ADR-006: Plugin-Based Command System

### Status

Accepted

### Context

Bots need to handle various commands and callbacks in an organized way.

### Decision

Use a plugin-based architecture where:

- Commands are self-contained modules
- Callbacks are separate from commands
- Middleware provides cross-cutting concerns
- Everything is dynamically loaded

### Rationale

1. **Modularity**: Easy to add/remove features
2. **Testing**: Isolated units are simpler to test
3. **Scalability**: Teams can work on different commands
4. **Code Organization**: Clear separation of concerns

### Consequences

- **Positive**: Clean codebase, easy feature additions
- **Negative**: Slightly more boilerplate
- **Mitigation**: CLI tools for scaffolding (future)

## ADR-007: Multi-Provider AI Strategy

### Status

Accepted

### Context

AI capabilities are becoming essential for modern bots.

### Decision

Support multiple AI providers with:

- Unified interface
- Automatic fallback
- Provider-specific optimizations
- Cost tracking

### Supported Providers

- Google Gemini
- OpenAI GPT
- xAI Grok
- DeepSeek
- Cloudflare AI

### Rationale

1. **Flexibility**: Choose the best model for each task
2. **Reliability**: Fallback when providers are down
3. **Cost Control**: Route by price/performance
4. **Future-Proof**: Easy to add new providers

### Consequences

- **Positive**: Resilient AI integration, vendor independence
- **Negative**: Complex provider management
- **Mitigation**: Unified service layer handles complexity

## ADR-008: Role-Based Access Control

### Status

Accepted

### Context

Many bots need user permission management.

### Decision

Implement three-tier RBAC:

1. **Owner**: Full control
2. **Admin**: Management capabilities
3. **User**: Standard access

With features:

- Access request workflow
- Granular permission checks
- Debug mode visibility control

### Rationale

1. **Security**: Protect sensitive commands
2. **Flexibility**: Adapt to various use cases
3. **UX**: Clear permission model
4. **Scalability**: Easy to extend roles

### Consequences

- **Positive**: Production-ready permission system
- **Negative**: Additional complexity
- **Mitigation**: Clear documentation and examples

## Future ADRs

As the wireframe evolves, new decisions will be documented here:

- ADR-009: Plugin Marketplace Architecture
- ADR-010: Monitoring and Observability Strategy
- ADR-011: Internationalization Approach
- ADR-012: Testing Strategy

---

_These decisions reflect current best practices and may evolve with the platform._
