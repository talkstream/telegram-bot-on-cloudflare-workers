# Contributing to Telegram Bot Cloudflare Workers Wireframe

Thank you for your interest in contributing to this project! This wireframe is designed to be a perfect starting point for developers, and your contributions help make it even better.

## 🎯 Code Standards

### TypeScript

- **100% Type Safety**: No `any` types allowed. All code must be fully typed.
- **Strict Mode**: The project uses TypeScript strict mode with `exactOptionalPropertyTypes`.
- **Explicit Types**: Always explicitly type function parameters and return values.

### Code Style

- **ESLint**: We use ESLint v9 with flat config. Run `npm run lint` before committing.
- **Prettier**: Code formatting is handled by Prettier. Run `npm run format` before committing.
- **Import Order**: Imports should be organized (external deps, then internal deps, then types).

### Testing

- **Coverage**: We use Istanbul coverage (not V8) for Cloudflare Workers compatibility.
- **Test Everything**: Write tests for all new features and bug fixes.
- **Integration Tests**: Include integration tests for Telegram bot commands.

## 🚀 Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/typescript-wireframe-platform.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature-name`
5. Make your changes
6. Run tests: `npm test`
7. Check types: `npm run typecheck`
8. Lint code: `npm run lint`
9. Format code: `npm run format`
10. Commit your changes
11. Push to your fork and submit a pull request

## 📝 Commit Messages

We follow conventional commits:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Test additions or changes
- `chore:` Build process or auxiliary tool changes

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🔍 Code Review Process

1. All PRs require at least one review
2. CI must pass (tests, linting, type checking)
3. No decrease in test coverage
4. No new `any` types
5. Documentation updated if needed

## 🐛 Reporting Issues

When reporting issues, please include:

1. Node.js version
2. npm version
3. Operating system
4. Detailed steps to reproduce
5. Expected behavior
6. Actual behavior
7. Any error messages or logs

## 💡 Feature Requests

Feature requests are welcome! Please provide:

1. Clear use case
2. Expected behavior
3. Why this would benefit other developers
4. Any implementation ideas

## 🤝 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Assume good intentions

## 🤖 Bot-Driven Development

We encourage contributors to build real bots using Wireframe and contribute improvements back. This ensures the framework evolves based on actual usage.

### How It Works

1. **Build Your Bot**: Use Wireframe to create a real Telegram bot
2. **Identify Gaps**: Note missing features or pain points
3. **Improve Framework**: Contribute enhancements back to Wireframe
4. **Share Examples**: Add your bot patterns to our examples

### Contribution Workflow

```bash
# Create a worktree for your bot development
git worktree add ../wireframe-mybot feature/mybot

# Develop your bot and framework improvements in parallel
cd ../wireframe-mybot
# ... work on your bot ...

# When you find something to improve in the framework
git add -p  # Select framework improvements
git commit -m "feat: add feature discovered during bot development"
git push origin feature/framework-improvement
```

### What We're Looking For

- **Real-world patterns** that emerge from bot development
- **Missing abstractions** discovered through actual use
- **Performance optimizations** based on production experience
- **Documentation improvements** from implementation challenges
- **Test cases** derived from real scenarios

### Automated Contribution Process

For a streamlined contribution experience, we provide automated tools:

```bash
# Interactive contribution wizard
npm run contribute

# Auto-detect valuable patterns from your changes
npm run contribute:auto
```

This tool will:

- Analyze your recent changes
- Identify contribution type (pattern/performance/fix/feature)
- Extract relevant code snippets
- Generate appropriate tests
- Prepare PR description
- Guide you through the submission process

#### For Claude Code Users

Simply tell Claude:

- "contribute this pattern to wireframe"
- "this optimization should be in wireframe"
- "submit this fix upstream"

Claude Code will use the automated tools to prepare your contribution.

See [Easy Contribute Guide](docs/EASY_CONTRIBUTE.md) for detailed instructions.

## 📚 Resources

### Contribution Guides

- [Easy Contribute Guide](docs/EASY_CONTRIBUTE.md) - Automated contribution tools
- [Contribution Review Checklist](docs/CONTRIBUTION_REVIEW_CHECKLIST.md) - For maintainers
- [Successful Contributions](docs/SUCCESSFUL_CONTRIBUTIONS.md) - Examples and hall of fame
- [Development Workflow](docs/DEVELOPMENT_WORKFLOW.md) - Detailed development guide

### Technical Documentation

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [grammY Documentation](https://grammy.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Telegram Bot API](https://core.telegram.org/bots/api)

## 🏆 Recent Successful Contributions

Check out our [Successful Contributions Gallery](docs/SUCCESSFUL_CONTRIBUTIONS.md) to see real examples of community contributions that made Wireframe better!

Thank you for contributing to make Wireframe the best universal AI assistant platform!
