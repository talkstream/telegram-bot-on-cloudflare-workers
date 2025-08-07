# Contribution Review Checklist

This checklist helps maintainers review contributions from the community consistently and efficiently.

## 🎯 Core Requirements

### 1. Code Quality

- [ ] **TypeScript Strict Mode**: No `any` types, all warnings resolved
- [ ] **ESLint**: Zero errors, minimal warnings with justification
- [ ] **Tests**: New functionality has appropriate test coverage
- [ ] **Documentation**: Changes are documented (code comments, README updates)

### 2. Architecture Compliance

- [ ] **Platform Agnostic**: Works across all supported platforms (Telegram, Discord, etc.)
- [ ] **Cloud Independent**: No platform-specific APIs used directly
- [ ] **Connector Pattern**: External services use appropriate connectors
- [ ] **Event-Driven**: Components communicate via EventBus when appropriate

### 3. Production Readiness

- [ ] **Error Handling**: Graceful error handling with meaningful messages
- [ ] **Performance**: Optimized for Cloudflare Workers constraints (10ms CPU on free tier)
- [ ] **Type Safety**: Proper type guards for optional values
- [ ] **Backward Compatibility**: No breaking changes without discussion

## 📋 Review Process

### Step 1: Initial Check

```bash
# Check out the PR locally
gh pr checkout <PR_NUMBER>

# Run automated checks
npm run typecheck
npm run lint
npm test
```

### Step 2: Code Review

- [ ] Review changed files for code quality
- [ ] Check for duplicate code or functionality
- [ ] Verify proper error handling
- [ ] Ensure consistent coding style

### Step 3: Architecture Review

- [ ] Verify platform independence
- [ ] Check connector pattern usage
- [ ] Review integration points
- [ ] Assess impact on existing features

### Step 4: Testing

- [ ] Run existing tests
- [ ] Test new functionality manually
- [ ] Verify edge cases are handled
- [ ] Check performance impact

## 🚀 Merge Criteria

### Must Have

- ✅ All automated checks pass
- ✅ Follows Wireframe architecture patterns
- ✅ Production-tested or thoroughly tested
- ✅ Clear value to the community

### Nice to Have

- 📊 Performance benchmarks
- 📝 Migration guide if needed
- 🎯 Example usage
- 🔄 Integration tests

## 💡 Common Issues to Check

### 1. Platform Dependencies

```typescript
// ❌ Bad: Platform-specific
import { TelegramSpecificType } from 'telegram-library'

// ✅ Good: Platform-agnostic
import type { MessageContext } from '@/core/interfaces'
```

### 2. Type Safety

```typescript
// ❌ Bad: Using any
const result = (meta as any).last_row_id

// ✅ Good: Proper types
const meta = result.meta as D1RunMeta
if (!meta.last_row_id) {
  throw new Error('No last_row_id returned')
}
```

### 3. Error Handling

```typescript
// ❌ Bad: Silent failures
try {
  await operation()
} catch {
  // Silent fail
}

// ✅ Good: Proper handling
try {
  await operation()
} catch (error) {
  logger.error('Operation failed', { error })
  throw new Error('Meaningful error message')
}
```

## 📝 Response Templates

### Approved PR

```markdown
## ✅ Approved!

Excellent contribution! This PR:

- Meets all code quality standards
- Follows Wireframe architecture patterns
- Adds valuable functionality
- Is well-tested and documented

Thank you for contributing to Wireframe! 🚀
```

### Needs Changes

```markdown
## 📋 Changes Requested

Thank you for your contribution! Before we can merge, please address:

1. **[Issue 1]**: [Description and suggested fix]
2. **[Issue 2]**: [Description and suggested fix]

Feel free to ask questions if anything is unclear!
```

### Great But Needs Refactoring

```markdown
## 🔧 Refactoring Needed

This is valuable functionality! To align with Wireframe's architecture:

1. **Make it platform-agnostic**: [Specific suggestions]
2. **Use connector pattern**: [Example structure]
3. **Remove dependencies**: [What to remove/replace]

Would you like help with the refactoring?
```

## 🎉 After Merge

1. Thank the contributor
2. Update CHANGELOG.md
3. Consider adding to examples
4. Document in release notes
5. Celebrate the contribution! 🎊

## 📊 Contribution Quality Metrics

Track these to improve the contribution process:

- Time from PR to first review
- Number of review cycles needed
- Common issues found
- Contributor satisfaction

Remember: Every contribution is valuable, even if it needs refactoring. Be supportive and help contributors succeed!
