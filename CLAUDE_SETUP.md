# Claude Code Automated Setup Instructions

**IMPORTANT**: This file contains instructions for Claude Code AI assistant. When a user asks to setup this project, follow these steps exactly.

## 🎯 Setup Overview

This is an automated setup guide for the Telegram Bot on Cloudflare Workers wireframe. The entire process should be interactive and user-friendly, with clear progress indicators and error handling.

## 📋 Pre-Setup Phase

### Check and Install MCP Servers

First, check if the required MCP servers are installed. If not, guide the user to install them:

```bash
# Check if MCP servers are available by attempting to use them
# If any fail, show these installation commands:

claude mcp add cloudflare-mcp https://observability.mcp.cloudflare.com/sse
claude mcp add cloudflare-mcp https://bindings.mcp.cloudflare.com/sse
claude mcp add gitmcp https://gitmcp.io/talkstream/typescript-wireframe-platform
claude mcp add sentry https://mcp.sentry.dev
```

Show progress:

```
🔧 Checking MCP servers...
✅ Cloudflare MCP: Available
✅ GitMCP: Available
```

## 🚀 Phase 1: Project Setup

### 1.1 Clone Repository

Use GitMCP to clone the repository

Show progress:

```
📦 Clone Repository...
[████████████████░░░░░░░░░░░░░░░░] 50% - In progress...
```

### 1.2 Environment Check

Verify Node.js and npm versions

**⚠️ This step is critical and must succeed to continue.**

### 1.3 Install Dependencies

```bash
npm install
```

Show progress:

```
📦 Install Dependencies...
[████████████████░░░░░░░░░░░░░░░░] 50% - In progress...
```

Required:

- Node.js 20.0.0 or higher
- npm 10.0.0 or higher

If missing, provide installation instructions:

- **Node.js**: Direct to https://nodejs.org/ or suggest using nvm
- **npm**: Usually comes with Node.js

## 🔐 Phase 2: Token Collection

### 2.1 TELEGRAM_BOT_TOKEN

```
🤖 Bot token from @BotFather

1. Open Telegram and search for @BotFather
2. Send /newbot command
3. Choose a name for your bot (e.g., 'My Awesome Bot')
4. Choose a username (must end with 'bot', e.g., 'myawesome_bot')
5. Copy the token you receive

📝 Enter your telegram bot token:
```

Validate the format: `^\d{10}:[A-Za-z0-9_-]{35}$`
Example: `1234567890:ABCdefGHIjklmNOPqrstUVwxyz1234567890`

### 2.2 BOT_OWNER_IDS

```
👤 Telegram user IDs with owner privileges

1. Open Telegram and search for @userinfobot
2. Start the bot
3. It will show your User ID

📝 Enter your bot owner ids:
```

Validate the format: `^\d+(,\d+)*$`
Example: `123456789,987654321`

### 2.4 AI_PROVIDER (Optional)

```
🧠 AI provider selection

Available options:
1. Google Gemini (Recommended - has free tier)
2. OpenAI
3. xAI (Grok)
4. DeepSeek
5. Cloudflare AI

Choose option [1-5]:
```

If user chooses a provider, help them get the API key:

- **GEMINI**: Direct to https://makersuite.google.com/app/apikey
- **OPENAI**: Direct to https://platform.openai.com/api-keys
- **XAI**: Direct to https://console.x.ai
- **DEEPSEEK**: Direct to https://platform.deepseek.com
- Show appropriate links for other providers

### 2.4 SENTRY_DSN (Optional)

```
🛡️ Error monitoring with Sentry

Get it from: https://sentry.io/settings/YOUR-ORG/projects/YOUR-PROJECT/keys/

📝 SENTRY_DSN (or press Enter to skip):
```

Validate the format: `^https://[a-f0-9]+@[a-z0-9.-]+/\d+$`
Example: `https://abc123@sentry.io/1234567`

If yes:

```
Please provide your Sentry DSN:
(Get it from https://sentry.io/settings/YOUR-ORG/projects/YOUR-PROJECT/keys/)

📝 Sentry DSN (or press Enter to skip):
```

## ☁️ Phase 3: Cloudflare Setup

### 3.1 Authentication

Authenticate with Cloudflare

```bash
wrangler login
```

### 3.2 Create D1 Database

Create SQLite database at the edge

### 3.3 Create KV Namespaces

Show progress:

```
[██████████░░░░░░░░░░░░░░░░░░░░░░] 33% - Item 1 of 3...
[█████████████████████░░░░░░░░░░░] 66% - Item 2 of 3...
[████████████████████████████████] 100% - Item 3 of 3...
```

Using Cloudflare MCP:

```
💾 Creating D1 Database...
Database Name: telegram-bot-db
```

Capture the database ID from the response.

### 3.3 Create KV Namespaces

Create three KV namespaces:

```
📚 Creating KV Namespaces...
[██████████░░░░░░░░░░░░░░░░░░░░░░] 33% - Creating CACHE namespace...
[█████████████████████░░░░░░░░░░░] 66% - Creating RATE_LIMIT namespace...
[████████████████████████████████] 100% - Creating SESSIONS namespace...
```

Capture all namespace IDs.

## ⚙️ Phase 4: Configuration

### 4.1 Generate Webhook Secret

```python
# Generate a secure webhook secret
import secrets
webhook_secret = secrets.token_urlsafe(32)
```

### 4.2 Create .dev.vars

Create `.dev.vars` file with all collected information:

```
📝 Creating configuration files...
✅ .dev.vars created
```

### 4.3 Update wrangler.toml

Update `wrangler.toml` with the collected IDs:

```
✅ wrangler.toml updated with your resource IDs
```

## 🗄️ Phase 5: Database Setup

### 5.1 Run Migrations

```
🔨 Setting up database...
[████████░░░░░░░░░░░░░░░░░░░░░░░░] 25% - 0001_create_users_table.sql...
[████████████████░░░░░░░░░░░░░░░░] 50% - 0002_add_telegram_stars_tables.sql...
[████████████████████████░░░░░░░░] 75% - 0003_add_access_control.sql...
[████████████████████████████████] 100% - 0004_add_bot_settings.sql...
```

Run: `npm run db:apply:local`

## 🧪 Phase 6: Testing & Launch

### 6.1 Run Tests

```bash
npm test
```

### 6.2 Start Development Server

```bash
npm run dev
```

### 6.3 Set Webhook

### 6.4 Test Bot

### 6.4 Test Bot

```
🎯 Testing your bot...

Please open Telegram and:
1. Search for your bot: @{bot_username}
2. Send /start command
3. You should receive a welcome message!

Waiting for test message...
```

## ✅ Phase 7: Success Dashboard

```
╔════════════════════════════════════════════════════════════╗
║                    🎉 Setup Complete! 🎉                   ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Bot Information:                                         ║
║     • {bot_name}                                           ║
║     • {bot_username}                                       ║
║     • {local_url}                                          ║
║     • {tunnel_url}                                         ║
║                                                            ║
║  Resources Created:                                       ║
║     • {d1_database}                                        ║
║     • {kv_namespaces}                                      ║
║                                                            ║
║  Test Results:                                            ║
║     • {tests_passed}                                       ║
║     • {webhook_active}                                     ║
║     • {bot_responding}                                     ║
║                                                            ║
║  Next Steps:                                              ║
║     • Try more commands: /help, /settings                  ║
║     • Check the logs: npm run tail                         ║
║     • Deploy to production: npm run deploy                 ║
║                                                            ║
║  Documentation:                                           ║
║     • Documentation: docs/README.md                        ║
║     • Troubleshooting: docs/TROUBLESHOOTING.md             ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

## 🚨 Error Handling

For each phase, implement proper error handling:

### Common Errors and Solutions:

1. **Node.js version too old**

   ```
   ❌ Node.js .* detected, but .* required

   Solution:
   • Install Node.js 20+ from https://nodejs.org/
   • Or use nvm: nvm install 20 && nvm use 20
   ```

2. **Invalid bot token format**

   ```
   ❌ Invalid bot token

   Solution:
   • Bot tokens look like: 1234567890:ABCdefGHIjklmNOPqrstUVwxyz1234567890
   • Please check your token and try again
   ```

3. **Cloudflare authentication failed**

   ```
   ❌ Not logged in to Cloudflare

   Solution:
   • Please run: wrangler login
   • Then try again
   ```

4. **Database creation failed**

   ```
   ❌ Failed to create D1 database

   Solution:
   • Check your Cloudflare account limits
   • Ensure you have a valid account
   • Try a different database name
   ```

5. **Tests failed**

   ```
   ❌ Some tests failed

   Solution:
   • This might be due to:
   • • Missing environment variables
   • • Database not properly initialized
   •
   • Run 'npm run test:watch' to debug
   ```

## 📝 Implementation Notes

1. **Use console colors for better UX**:
   - ✅ Green for success
   - ❌ Red for error
   - 🔵 Blue for info
   - 🟡 Yellow for warning

2. **Save progress state** in case of interruption

3. **Validate all inputs** before proceeding

4. **Offer retry options** for failed steps

5. **Provide copy-paste commands** where possible

6. **Keep user informed** with clear progress indicators

7. **Test each step** before moving to the next

8. **Graceful degradation** - if optional features fail, continue with core setup

## 🎯 Success Criteria

The setup is considered successful when:

- ✅ All dependencies installed
- ✅ Configuration files created
- ✅ Cloudflare resources provisioned
- ✅ Database migrations applied
- ✅ Tests passing
- ✅ Local server running
- ✅ Webhook set and verified
- ✅ Bot responds to /start command

## 🔄 Rollback Plan

If setup fails at any point:

1. Document what was completed
2. Provide cleanup commands if needed
3. Save partial configuration for retry
4. Offer to start over or continue from failure point

<!-- CONFIG_CHECKSUM:2c8b04b6e6ec9fb3ad5047822ff22662 -->
