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
2. Clone your fork: `git clone https://github.com/yourusername/telegram-bot-cloudflare-wireframe.git`
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

## 📚 Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [grammY Documentation](https://grammy.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Telegram Bot API](https://core.telegram.org/bots/api)

Thank you for contributing to make this the best Telegram bot wireframe for Cloudflare Workers!
