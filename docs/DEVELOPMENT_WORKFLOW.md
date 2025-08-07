# 🔄 Development Workflow for Wireframe

## Overview

This guide describes the development workflow for contributing to Wireframe, with a focus on real-world bot development that feeds back into the framework.

## 🎯 Core Development Philosophy

### 1. Bot-Driven Development

- Build real bots using Wireframe to identify missing features
- Each bot project validates and improves the framework
- Practical experience drives architectural decisions

### 2. Platform Independence

- Always consider: "Will this work on Discord/Slack/WhatsApp?"
- Never use platform-specific APIs directly
- Test abstractions even when implementing for one platform

### 3. Connector Pattern

- All external services use connectors
- Business logic never depends on specific implementations
- Easy to swap providers without code changes

## 🚀 Getting Started with Development

### 1. Environment Setup

```bash
# Clone the repository
git clone https://github.com/talkstream/typescript-wireframe-platform.git
cd typescript-wireframe-platform

# Install dependencies
npm install

# Set up environment
cp .dev.vars.example .dev.vars
cp wrangler.toml.example wrangler.toml

# Configure your bot token and secrets
# Edit .dev.vars with your values
```

### 2. Development Workflow

#### For Framework Development

```bash
# Start in main directory
npm run dev

# Run tests continuously
npm run test:watch

# Check types
npm run typecheck

# Lint code
npm run lint
```

#### For Bot Development (Recommended Approach)

```bash
# Create a worktree for your bot
git worktree add ../wireframe-mybot feature/mybot

# Work on your bot in parallel
cd ../wireframe-mybot
npm install
npm run dev
```

### 3. Testing Your Changes

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test
npm test src/connectors/messaging/telegram

# Integration tests
npm run test:integration
```

## 📝 Development Patterns

### 1. Adding a New Feature

1. **Identify Need**: Build a bot that requires the feature
2. **Design Interface**: Create platform-agnostic interface
3. **Implement Connector**: Add to appropriate connector
4. **Test Integration**: Ensure it works across platforms
5. **Document**: Update docs with examples

### 2. Creating a Connector

```typescript
// 1. Define interface in core/interfaces/
export interface IMyServiceConnector {
  doSomething(input: string): Promise<Result>
}

// 2. Create base connector
export abstract class BaseMyServiceConnector implements IMyServiceConnector {
  // Common functionality
}

// 3. Implement specific connector
export class SpecificServiceConnector extends BaseMyServiceConnector {
  async doSomething(input: string): Promise<Result> {
    // Implementation
  }
}

// 4. Register in factory
serviceRegistry.register('specific', SpecificServiceConnector)
```

### 3. Using EventBus

```typescript
// Emit events for decoupled communication
eventBus.emit('service:action', {
  data: payload,
  requestId: generateId()
})

// Listen for responses
eventBus.once('service:action:success', event => {
  // Handle success
})
```

## 🔧 Contributing Back

### 1. From Bot to Framework

When developing a bot, contribute improvements back:

```bash
# In your bot worktree
git add -p  # Select framework improvements
git commit -m "feat(connector): add new capability from bot development"
git push origin feature/connector-improvement

# Create PR to main repository
```

### 2. Documentation from Experience

- Document patterns discovered during bot development
- Add examples from real implementations
- Update troubleshooting with actual issues faced

### 3. Test Cases from Production

```typescript
// Add test based on real scenario
it('should handle Telegram rate limits gracefully', async () => {
  // Test case from production bot experience
})
```

### 4. Automated Contribution Tool

To streamline the contribution process:

```bash
# Instead of manual git add -p
npm run contribute

# Auto-detect contribution type
npm run contribute:auto
```

This tool:

- Works with your existing worktree setup
- Automates the cherry-picking process
- Generates tests and documentation
- Prepares PR with proper format

See [Easy Contribute Guide](./EASY_CONTRIBUTE.md) for details.

## 🏗️ Architecture Guidelines

### 1. Maintain Abstraction Layers

```typescript
// ❌ Bad - Direct platform dependency
import { KVNamespace } from '@cloudflare/workers-types'
const kv = env.KV as KVNamespace

// ✅ Good - Through abstraction
const kv = ctx.cloudConnector.getKeyValueStore('KV')
```

### 2. Event-Driven Communication

```typescript
// ❌ Bad - Direct service call
const result = await aiService.complete(prompt)

// ✅ Good - Through events
eventBus.emit('ai:complete', { prompt })
eventBus.once('ai:complete:success', handleResult)
```

### 3. Platform Feature Detection

```typescript
const features = ctx.cloudConnector.getFeatures()
if (features.hasWebSockets) {
  // Use WebSocket features
} else {
  // Use polling fallback
}
```

## 📊 Quality Standards

### Before Committing

1. **No TypeScript Warnings**: Run `npm run typecheck`
2. **Tests Pass**: Run `npm test`
3. **Linting Clean**: Run `npm run lint`
4. **Coverage Maintained**: Run `npm run test:coverage`

### Code Review Checklist

- [ ] Follows connector pattern
- [ ] Platform independent
- [ ] Properly typed (no `any`)
- [ ] Includes tests
- [ ] Documentation updated
- [ ] Real-world tested

## 🚨 Common Pitfalls

### 1. Platform Coupling

- Never import platform-specific types directly
- Always use interfaces from `core/interfaces`

### 2. Synchronous Assumptions

- Everything should be async-ready
- Use events for long operations

### 3. Missing Abstractions

- If you need platform-specific feature, create abstraction first
- Think about how it would work on other platforms

## 🎯 Best Practices

### 1. Start with Use Case

- Build real bot first
- Extract patterns second
- Generalize third

### 2. Test on Multiple Platforms

- Even if implementing for Telegram
- Ensure interfaces work universally
- Document platform differences

### 3. Contribute Incrementally

- Small, focused PRs
- One feature at a time
- Include tests and docs

## 📚 Resources

- [Architecture Decisions](./ARCHITECTURE_DECISIONS.md)
- [API Reference](./API_REFERENCE.md)
- [Platform Connectors](./CLOUD_PLATFORMS.md)
- [Strategic Plan](./STRATEGIC_PLAN.md)

## 🤝 Getting Help

- Check existing issues on GitHub
- Join discussions in issues/PRs
- Reference this workflow guide
- Ask in PR comments

Remember: The best features come from real-world usage. Build bots, find pain points, contribute solutions!
