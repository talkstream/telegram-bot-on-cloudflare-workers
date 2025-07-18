# Starting a New Project with the Claude Wireframe

This wireframe is designed to provide a robust and scalable foundation for your Telegram Bot projects on Cloudflare Workers.

## Architectural Overview

This wireframe is designed with a modular and scalable architecture:

- **`src/config`:** This directory contains the configuration for your application, including environment variable validation with Zod and Sentry integration.
- **`src/core`:** This is the heart of your application, where the `TelegramAdapter` encapsulates the bot's core logic, middleware, and update handling, and scheduled tasks are handled.
- **`src/adapters/telegram/commands`:** This directory is intended to house your bot's command handlers.
- **`src/adapters/telegram/callbacks`:** This directory is intended to house your bot's callback query handlers.
- **`src/adapters/telegram/handlers`:** This directory contains specific handlers like payment processing.
- **`src/lib`:** This directory contains shared libraries and utilities, such as the logger, database client, Telegram API type definitions, internationalization messages, custom error classes, Telegram text formatting, and content censoring.
- **`src/middleware`:** This directory contains custom middleware for your Hono application, including rate limiting and a centralized error handler.
- **`src/services`:** This is where you should place your business logic (e.g., interacting with a database, managing sessions, or calling external APIs like Gemini).
- **`src/domain`:** This directory contains domain-specific logic, including repositories and services related to Telegram Stars payments.

## Key Improvements

- **Environment Variable Validation:** The wireframe now includes environment variable validation using Zod, which will help you catch configuration errors early.
- **Structured Logging:** A simple but effective logger is included to help you debug and monitor your application.
- **Modular Architecture:** The new directory structure is designed to be more scalable and maintainable as your project grows.
- **Clear Separation of Concerns:** The new architecture promotes a clear separation of concerns, making your code easier to understand and test.
- **Sentry Integration:** The wireframe is now integrated with Sentry for error monitoring, which is essential for production applications. It also includes enhanced Sentry context management.
- **CI/CD Workflow:** A basic GitHub Actions workflow is included to automate testing and deployment.
- **Rate Limiting:** A basic rate-limiting middleware is included to protect your bot's endpoints.
- **Scheduled Tasks:** The wireframe now includes a handler for scheduled tasks (cron jobs), allowing you to run periodic operations.
- **Session Management:** Integrated Cloudflare KV for managing user session state, crucial for multi-step conversations.
- **Granular Input Validation:** Implemented Zod schemas for validating incoming Telegram webhook data, enhancing security and reliability.
- **Gemini Integration:** Provides a structured way to integrate with the Google Gemini Flash API for generative AI capabilities.
- **Health Checks:** A dedicated `/health` endpoint is included to monitor the operational status of your bot and its dependencies.
- **Internationalization (i18n):** A basic i18n setup is provided to support multiple languages for your bot's messages.
- **Enhanced Error Handling:** Implemented custom error classes and a centralized error handling middleware for more robust and granular error management.
- **Advanced Bot Features Example:** Includes an example of using inline keyboards and handling callback queries, demonstrating more interactive bot capabilities.
- **Multi-Environment Deployment:** `wrangler.toml` is configured to support distinct `staging` and `production` environments, allowing for safer deployments.
- **Telegram Stars Integration:** Full integration with Telegram Stars for in-bot payments, including pre-checkout and successful payment handling, and related database structures.
- **Robust Telegram Adapter:** Encapsulates bot logic, handles duplicate updates, and integrates Sentry user context for enhanced diagnostics, mirroring your existing project's robust approach.
- **Telegram Text Formatting Utilities:** Includes utilities for safe Markdown v2 formatting and code escaping, essential for rich Telegram messages.
- **Content Censoring Utility:** Provides a utility for basic content filtering, useful for maintaining community standards.

## Getting Started

1.  **Familiarize Yourself with the New Structure:** Take some time to explore the new directory structure and understand the purpose of each directory.
2.  **Follow the Guide:** The `README.md` file provides a comprehensive guide to getting your new project set up and deployed.
3.  **Build Your Features:** Start building out your bot's specific features in the `src/adapters/telegram/commands/` and `src/adapters/telegram/callbacks/` directories, and place your business logic in the `src/services` directory.

## Ready to Use

This wireframe provides a solid foundation for building production-ready Telegram bots on Cloudflare Workers. The architecture is designed to scale with your project needs while maintaining code quality and performance.
## Remote MCP Servers Configuration (2025-01-18)

Successfully configured Remote MCP servers for Claude Code:

1. **Cloudflare MCP Servers**
   - Observability: https://observability.mcp.cloudflare.com/sse
   - Workers Bindings: https://bindings.mcp.cloudflare.com/sse

2. **GitHub MCP Server**
   - URL: https://api.githubcopilot.com/mcp/
   - Requires OAuth or PAT authentication

3. **Git MCP Server (GitMCP)**
   - Project-specific: https://gitmcp.io/talkstream/telegram-bot-on-cloudflare-workers
   - Generic format: https://gitmcp.io/[owner]/[repo]

4. **Sentry MCP Server**
   - URL: https://mcp.sentry.dev
   - Built on Cloudflare infrastructure

### Important Notes:
- Use 'claude mcp add --transport sse' for SSE servers
- Use 'claude mcp add --transport http' for HTTP servers
- Authentication via '/mcp' command in Claude Code
- No local installations required for remote servers

### Cleaned up:
- Removed incorrect local MCP configurations
- Deleted unnecessary npm packages from ~/.claude/local
- Updated README files with correct Remote MCP URLs
