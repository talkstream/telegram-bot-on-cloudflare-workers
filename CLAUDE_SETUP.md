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
claude mcp add gitmcp https://gitmcp.io/talkstream/telegram-bot-on-cloudflare-workers
claude mcp add sentry https://mcp.sentry.dev
```

Show progress:
```
🔧 Checking MCP servers...
✅ GitMCP: Available
✅ Cloudflare MCP: Available
✅ Sentry MCP: Available
```

## 🚀 Phase 1: Project Setup

### 1.1 Clone Repository

Use GitMCP to clone the repository:
```
📥 Cloning repository...
[████████████████████████████████] 100% Complete
```

### 1.2 Environment Check

Check system requirements:
```
🔍 Checking environment...
```

Required:
- Node.js 20.0.0 or higher
- npm 10.0.0 or higher

If missing, provide installation instructions:
- **Node.js**: Direct to https://nodejs.org/ or suggest using nvm
- **npm**: Usually comes with Node.js

### 1.3 Install Dependencies

```bash
npm install
```

Show progress:
```
📦 Installing dependencies...
[████████████████░░░░░░░░░░░░░░░░] 50% - Installing grammY...
```

## 🔐 Phase 2: Token Collection

### 2.1 Telegram Bot Token

```
🤖 Let's create your Telegram bot!

Please follow these steps:
1. Open Telegram and search for @BotFather
2. Send /newbot command
3. Choose a name for your bot (e.g., "My Awesome Bot")
4. Choose a username (must end with 'bot', e.g., "myawesome_bot")
5. Copy the token you receive

📝 Enter your bot token: 
```

Validate the token format (should match: `\d{10}:[A-Za-z0-9_-]{35}`)

### 2.2 Bot Owner ID

```
👤 Now let's set up bot ownership!

To get your Telegram User ID:
1. Open Telegram and search for @userinfobot
2. Start the bot
3. It will show your User ID

📝 Enter your Telegram User ID: 
```

### 2.3 AI Provider Setup (Optional)

```
🧠 AI Provider Configuration (Optional)

Available providers:
1. Google Gemini (Recommended - has free tier)
2. OpenAI
3. xAI (Grok)
4. DeepSeek
5. Cloudflare AI
6. Skip (use mock AI for testing)

Choose provider [1-6]: 
```

If user chooses a provider, help them get the API key:
- **Gemini**: Direct to https://makersuite.google.com/app/apikey
- **OpenAI**: Direct to https://platform.openai.com/api-keys
- Show appropriate links for other providers

### 2.4 Sentry Setup (Optional)

```
🛡️ Error Monitoring with Sentry (Optional)

Would you like to set up error monitoring? [y/N]: 
```

If yes:
```
Please provide your Sentry DSN:
(Get it from https://sentry.io/settings/YOUR-ORG/projects/YOUR-PROJECT/keys/)

📝 Sentry DSN (or press Enter to skip): 
```

## ☁️ Phase 3: Cloudflare Setup

### 3.1 Authentication

```
🔑 Authenticating with Cloudflare...
```

Run: `wrangler login`

### 3.2 Create D1 Database

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
[████████░░░░░░░░░░░░░░░░░░░░░░░░] 33% - Creating CACHE namespace...
[████████████████░░░░░░░░░░░░░░░░] 66% - Creating RATE_LIMIT namespace...
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
[████████░░░░░░░░░░░░░░░░░░░░░░░░] 25% - Creating users table...
[████████████████░░░░░░░░░░░░░░░░] 50% - Adding Telegram Stars tables...
[████████████████████████░░░░░░░░] 75% - Adding access control...
[████████████████████████████████] 100% - Adding bot settings...
```

Run: `npm run db:apply:local`

## 🧪 Phase 6: Testing & Launch

### 6.1 Run Tests

```
🧪 Running tests...
```

Run: `npm test`

If tests fail, help debug the issues.

### 6.2 Start Development Server

```
🚀 Starting development server...
```

Run: `npm run dev`

Wait for the server to start and capture the tunnel URL.

### 6.3 Set Webhook

```
🔗 Setting up webhook...
```

Use the tunnel URL to set the webhook:
```bash
curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url={TUNNEL_URL}/webhook&secret_token={SECRET}"
```

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
║  🤖 Bot Name:     {bot_name}                              ║
║  🔗 Bot URL:      https://t.me/{bot_username}             ║
║  🌐 Local URL:    http://localhost:8787                   ║
║  🚇 Tunnel URL:   {tunnel_url}                            ║
║                                                            ║
║  📊 Resources Created:                                     ║
║     • D1 Database: telegram-bot-db                        ║
║     • KV Namespaces: CACHE, RATE_LIMIT, SESSIONS         ║
║                                                            ║
║  🧪 Test Results:                                          ║
║     • All tests passed ✅                                  ║
║     • Webhook active ✅                                    ║
║     • Bot responding ✅                                    ║
║                                                            ║
║  📚 Next Steps:                                            ║
║     1. Try more commands: /help, /settings                ║
║     2. Check the logs: npm run tail                       ║
║     3. Deploy to production: npm run deploy               ║
║                                                            ║
║  📖 Documentation: docs/README.md                          ║
║  ❓ Troubleshooting: docs/TROUBLESHOOTING.md              ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

## 🚨 Error Handling

For each phase, implement proper error handling:

### Common Errors and Solutions:

1. **Node.js version too old**
   ```
   ❌ Node.js 18.x detected, but 20.x required
   
   Solution:
   • Install Node.js 20+ from https://nodejs.org/
   • Or use nvm: nvm install 20 && nvm use 20
   ```

2. **Invalid bot token**
   ```
   ❌ Invalid bot token format
   
   Bot tokens look like: 1234567890:ABCdefGHIjklmNOPqrstUVwxyz1234567890
   Please check your token and try again.
   ```

3. **Cloudflare authentication failed**
   ```
   ❌ Not logged in to Cloudflare
   
   Please run: wrangler login
   Then try again.
   ```

4. **Database creation failed**
   ```
   ❌ Failed to create D1 database
   
   Possible solutions:
   • Check your Cloudflare account limits
   • Ensure you have a valid account
   • Try a different database name
   ```

5. **Tests failed**
   ```
   ❌ Some tests failed
   
   This might be due to:
   • Missing environment variables
   • Database not properly initialized
   
   Run 'npm run test:watch' to debug
   ```

## 📝 Implementation Notes

1. **Use console colors for better UX**:
   - ✅ Green for success
   - ❌ Red for errors
   - 🔵 Blue for information
   - 🟡 Yellow for warnings

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