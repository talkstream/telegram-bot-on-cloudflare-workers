# 📚 Wireframe Examples

This directory contains practical examples of building AI assistants with Wireframe. Each example demonstrates specific features and patterns while maintaining the framework's platform-independent architecture.

## 🎯 Example Categories

### Basic Examples

#### 1. [Telegram Bot](./telegram-bot/)

A complete working Telegram bot demonstrating:

- Basic command handling
- Event-driven architecture
- Cloud platform abstraction
- TypeScript strict mode

#### 2. [Telegram Plugin System](./telegram-plugin/)

Advanced plugin system example showing:

- Creating custom plugins
- Plugin lifecycle management
- Event bus communication
- Hot-swappable functionality

### Platform Examples (Coming Soon)

#### 3. Discord Bot

- Discord connector usage
- Cross-platform message handling
- Rich embeds and interactions

#### 4. Multi-Platform Bot

- Single bot on multiple platforms
- Platform-specific features
- Unified command handling

### Cloud Platform Examples (Coming Soon)

#### 5. AWS Deployment

- Lambda functions
- DynamoDB storage
- S3 file handling

#### 6. Google Cloud Deployment

- Cloud Functions
- Firestore database
- Cloud Storage

### Advanced Examples (Coming Soon)

#### 7. E-commerce Bot

- Product catalog
- Payment integration
- Order management
- Multi-language support

#### 8. Support Bot

- Ticket system
- AI-powered responses
- Analytics dashboard
- Team collaboration

#### 9. Educational Bot

- Course management
- Progress tracking
- Interactive quizzes
- Content delivery

## 🚀 Getting Started with Examples

### Running an Example

```bash
# Navigate to example directory
cd examples/telegram-bot

# Install dependencies
npm install

# Copy and configure environment
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your bot token

# Run locally
npm run dev
```

### Creating Your Own Example

1. **Copy a base example**:

   ```bash
   cp -r telegram-bot my-example
   cd my-example
   ```

2. **Update configuration**:
   - Modify `wrangler.toml` for your project
   - Update `.dev.vars` with your credentials

3. **Implement your features**:
   - Follow the connector pattern
   - Use event-driven communication
   - Maintain platform independence

4. **Test thoroughly**:
   ```bash
   npm test
   npm run typecheck
   npm run lint
   ```

## 📝 Contributing Examples

We welcome example contributions! Here's how:

### Guidelines

1. **Real-World Use Cases**: Examples should solve actual problems
2. **Clear Documentation**: Include comprehensive README
3. **Best Practices**: Follow Wireframe patterns and TypeScript strict mode
4. **Platform Independence**: Even platform-specific examples should use abstractions

### Structure

Each example should include:

```
example-name/
├── src/                 # Source code
├── tests/              # Test files
├── .dev.vars.example   # Environment template
├── wrangler.toml       # Deployment config
├── package.json        # Dependencies
├── tsconfig.json       # TypeScript config
└── README.md          # Documentation
```

### Submission Process

1. Create your example following the structure above
2. Ensure all tests pass and no TypeScript warnings
3. Document clearly with setup instructions
4. Submit PR with description of what the example demonstrates

## 🎯 Learning Path

### Beginners

1. Start with [telegram-bot](./telegram-bot/) - Basic bot setup
2. Explore command handling and responses
3. Understand the event-driven architecture

### Intermediate

1. Study [telegram-plugin](./telegram-plugin/) - Plugin system
2. Create custom plugins for your use case
3. Learn event bus patterns

### Advanced

1. Implement multi-platform support
2. Create complex integrations
3. Build production-ready bots

## 🔗 Resources

- [Main Documentation](../docs/)
- [API Reference](../docs/API_REFERENCE.md)
- [Development Workflow](../docs/DEVELOPMENT_WORKFLOW.md)
- [Architecture Guide](../docs/ARCHITECTURE_DECISIONS.md)

## 💡 Ideas for Examples

Have an idea for an example? We'd love to see:

- **Game Bots**: Leaderboards, real-time gameplay
- **Analytics Bots**: Data visualization, reporting
- **Integration Bots**: Connect with external services
- **Utility Bots**: Tools and automation

Open an issue with your idea or submit a PR with your implementation!

---

Remember: The best examples come from real-world usage. Build something you need, then share it with the community!
