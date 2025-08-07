# 🚀 Easy Contributions to Wireframe

This guide extends the [Bot-Driven Development](../CONTRIBUTING.md#bot-driven-development) workflow with automated tools.

## Quick Start

```bash
# After discovering something valuable in your bot
npm run contribute
```

## Automated Contribution Types

### 1. Performance Optimizations

```bash
npm run contribute:perf
```

Automatically captures:

- Before/after metrics
- CPU time improvements
- Memory usage changes
- Tier-specific optimizations (free vs paid)

### 2. Reusable Patterns

```bash
npm run contribute:pattern
```

Extracts:

- Pattern implementation
- Usage examples
- Test cases
- Documentation

### 3. Bug Fixes

```bash
npm run contribute:fix
```

Includes:

- Problem description
- Root cause analysis
- Fix implementation
- Regression tests

### 4. Feature Requests

```bash
npm run contribute:feature
```

Documents:

- Use case from your bot
- Proposed API
- Implementation suggestions
- Impact on existing code

## Integration with Git Worktree

The tool works seamlessly with the recommended worktree workflow:

```bash
# In your bot worktree
cd ../wireframe-mybot

# Discover optimization
npm run contribute:perf

# Tool will:
# 1. Create a feature branch in main worktree
# 2. Cherry-pick relevant commits
# 3. Generate tests
# 4. Prepare PR
```

## What Gets Tracked Automatically

During development, the framework tracks:

1. **Performance Metrics**
   - Response times
   - Memory usage
   - CPU time (especially on free tier)
   - KV/D1 operation counts

2. **Error Patterns**
   - Common failures
   - Recovery strategies
   - Edge cases

3. **Usage Patterns**
   - Frequently used code paths
   - Common integrations
   - Popular features

## Claude Code Integration

The tool is optimized for AI-assisted development:

```typescript
// When you write code like this
export const rateLimitOptimization = {
  // ... your optimization
}

// Just tell Claude: "contribute this optimization"
// Claude will run: npm run contribute:auto
```

## Production Insights Format

The tool generates a `PRODUCTION_INSIGHTS.md` file:

```markdown
# Production Insights

## Context

- Bot Type: [auto-detected]
- Scale: [estimated from metrics]
- Tier: [free/paid]

## Contribution

[Your pattern/optimization/fix]

## Impact

[Measured improvements]

## Tests

[Generated test cases]
```

## Examples

### Example 1: Free Tier Optimization

You discovered a way to reduce CPU time:

```typescript
// Before: 9ms average
const result = await heavyOperation()

// After: 3ms average
const result = useMemo(() => heavyOperation(), [deps])
```

Run: `npm run contribute:perf`

The tool will:

1. Detect the 70% improvement
2. Create a PR titled "perf: reduce CPU time for heavyOperation by 70%"
3. Add tests verifying the optimization
4. Document the pattern for others

### Example 2: Error Recovery Pattern

You implemented graceful degradation:

```typescript
async function withFallback(ctx, operation, fallback) {
  try {
    return await operation()
  } catch (error) {
    if (ctx.env.TIER === 'free' && error.name === 'TimeoutError') {
      return fallback()
    }
    throw error
  }
}
```

Run: `npm run contribute:pattern`

## Best Practices

1. **Contribute Early and Often**
   - Don't wait for perfect code
   - Share patterns as you discover them

2. **Include Context**
   - Mention your bot's scale/type
   - Describe the problem it solves

3. **Test on Both Tiers**
   - Verify on free tier (10ms limit)
   - Confirm on paid tier (30s limit)

4. **Document Impact**
   - Include metrics where possible
   - Describe user experience improvements

## Contribution Checklist

Before submitting:

- [ ] Code works on both free and paid tiers
- [ ] Tests are included
- [ ] Documentation is clear
- [ ] No TypeScript warnings
- [ ] Follows Wireframe patterns

## What Makes a Great Contribution

### ⭐ High-Value Contributions

1. **Free Tier Optimizations**
   - CPU time reductions
   - Memory optimizations
   - Batching strategies

2. **Universal Patterns**
   - Works across platforms (Telegram/Discord/Slack)
   - Cloud-agnostic implementations
   - Reusable abstractions

3. **Production Insights**
   - Real-world edge cases
   - Scale-tested solutions
   - Battle-tested patterns

### 📊 Include Metrics

When possible, include:

- Performance improvements (%)
- User count/scale
- Resource usage changes
- Error rate reductions

## Troubleshooting

### Tool doesn't detect my changes?

- Ensure you're in a git repository
- Commit your changes locally first
- Use `--auto` flag for smart detection

### Tests failing?

- Run `npm test` locally first
- Check TypeScript with `npm run typecheck`
- Lint with `npm run lint`

### Not sure what to contribute?

- Check [GitHub Issues](https://github.com/talkstream/typescript-wireframe-platform/issues)
- Look for `good first issue` labels
- Ask in discussions

## Advanced Usage

### Custom Contribution Types

```bash
# Create custom contribution
npm run contribute -- --type=custom --title="My Pattern"
```

### Batch Contributions

```bash
# Submit multiple patterns at once
npm run contribute:batch
```

### From CI/CD

```yaml
# In your GitHub Actions
- name: Detect Contributions
  run: npm run contribute:auto -- --ci
```

## Next Steps

1. Build your bot using Wireframe
2. Discover improvements through real usage
3. Share back with the community
4. Make Wireframe better for everyone

Remember: The best contributions come from real-world experience!
