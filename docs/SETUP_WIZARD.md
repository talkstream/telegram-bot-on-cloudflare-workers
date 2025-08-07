# 🧙 Interactive Setup Wizard Documentation

## Overview

The Wireframe Interactive Setup Wizard provides a guided, user-friendly experience for setting up new bot projects. It handles configuration, cloud resource creation, and project documentation generation while ensuring privacy and security.

## Features

### 🎯 Core Capabilities

- **Multi-Platform Support**: Configure bots for Telegram, Discord, Slack, or WhatsApp
- **Multi-Cloud Deployment**: Deploy to Cloudflare, AWS, GCP, or Azure
- **AI Provider Integration**: Setup with Google Gemini, OpenAI, Anthropic, and more
- **Project Documentation**: Auto-generates CLAUDE.md and INIT.md with filtered private data
- **State Management**: Resume interrupted setups from where you left off
- **Resource Creation**: Automatically creates cloud resources (databases, KV stores)
- **Smart Validation**: Validates all inputs including bot tokens and API keys

## Usage

### Quick Start

Run the enhanced setup wizard:

```bash
npm run setup:wizard
```

Or use the basic setup for Telegram only:

```bash
npm run setup:bot
```

### Generate Documentation Only

To generate project documentation without full setup:

```bash
npm run setup:docs --name "my-bot" --platform telegram
```

## Setup Flow

### 1. Prerequisites Check

- Verifies Node.js 20+ and npm 10+
- Checks for Git installation
- Validates required CLI tools

### 2. Project Information

- Project name (validated for format)
- Description
- Author name (for documentation)
- Platform selection
- Cloud provider selection

### 3. Platform Configuration

- **Telegram**: Bot token, username, webhook secret, owner IDs
- **Discord**: Bot token, application ID
- **Slack**: Bot token, workspace ID
- **WhatsApp**: Business API credentials

### 4. AI Provider Setup

- Provider selection (Google, OpenAI, Anthropic, etc.)
- API key configuration
- Model preferences

### 5. Feature Selection

Interactive selection of features:

- Database (D1/DynamoDB)
- KV Storage
- Payment Processing
- Analytics & Monitoring
- Internationalization
- Notifications
- Admin Dashboard
- Sentry Integration

### 6. Resource Creation

Automatic creation of cloud resources:

- Databases
- KV namespaces
- Storage buckets
- Queues

### 7. Documentation Generation

Creates filtered, project-specific documentation:

- **CLAUDE.md**: Development guide for Claude Code
- **INIT.md**: Quick start instructions
- **Private data filtering**: Removes personal paths, tokens, emails

## Documentation Generation

### Privacy Features

The documentation generator automatically filters:

- Personal file paths (e.g., `/Users/username/`)
- Email addresses
- API keys and tokens
- Private URLs
- Personal notes and TODOs

### Templates

Templates are stored in `/src/templates/project-docs/`:

- `claude.md.hbs`: Development guide template
- `init.md.hbs`: Quick start template
- `filters.json`: Privacy filter rules

### Customization

You can customize templates using Handlebars syntax:

```handlebars
{{#ifEquals platform 'telegram'}}
  Telegram-specific content
{{/ifEquals}}

{{#if features}}
  {{#each features}}
    -
    {{this}}
  {{/each}}
{{/if}}
```

## State Management

### Resume Capability

If setup is interrupted:

1. State is saved to `.setup-state.json`
2. On next run, wizard offers to resume
3. Continues from last completed step

### Clean State

To start fresh:

```bash
rm .setup-state.json
npm run setup:wizard
```

## Configuration Files

### Generated Files

1. **`.dev.vars`**: Environment variables

   ```env
   TELEGRAM_BOT_TOKEN=your_token
   AI_PROVIDER=google-ai
   GEMINI_API_KEY=your_key
   ```

2. **`wrangler.toml`**: Cloudflare configuration
   - Updated with resource IDs
   - Project name configured
   - Compatibility date set

3. **`CLAUDE.md`**: Development documentation
   - Project-specific instructions
   - Architecture overview
   - Command reference

4. **`INIT.md`**: Quick start guide
   - Step-by-step setup
   - Troubleshooting
   - Next steps

## Advanced Options

### Command Line Usage

Generate documentation with specific options:

```bash
node scripts/generate-project-docs.js \
  --name "my-bot" \
  --description "AI assistant bot" \
  --platform telegram \
  --cloud cloudflare \
  --ai google-ai \
  --output ./my-project
```

### Extract from Existing CLAUDE.md

Extract safe configuration from existing file:

```bash
node scripts/generate-project-docs.js \
  --extract ./CLAUDE.md \
  --output ./new-project
```

## Error Handling

### Common Issues

1. **Prerequisites Failed**
   - Install Node.js 20+: https://nodejs.org/
   - Install Git: https://git-scm.com/

2. **Wrangler Not Found**

   ```bash
   npm install -g wrangler
   ```

3. **Not Logged In to Cloudflare**

   ```bash
   wrangler login
   ```

4. **Resource Already Exists**
   - Resources are reused if they exist
   - Check wrangler.toml for existing IDs

## Best Practices

### Security

1. **Never commit `.dev.vars`** - Add to .gitignore
2. **Use generated secrets** - Don't reuse passwords
3. **Validate tokens** - Wizard validates format
4. **Filter private data** - Documentation is sanitized

### Development Workflow

1. Run setup wizard for initial configuration
2. Review generated documentation
3. Start development with `npm run dev`
4. Test locally before deploying
5. Use `npm run deploy` for production

## Integration with CI/CD

### GitHub Actions

The generated configuration works with CI/CD:

```yaml
- name: Setup Project
  run: |
    npm run setup:docs \
      --name "${{ github.event.repository.name }}" \
      --platform telegram \
      --cloud cloudflare
```

### Environment Variables

Set secrets in CI/CD:

- `TELEGRAM_BOT_TOKEN`
- `CLOUDFLARE_API_TOKEN`
- `AI_API_KEY`

## Troubleshooting

### Setup Interrupted

```bash
# Resume from saved state
npm run setup:wizard

# Or start fresh
rm .setup-state.json
npm run setup:wizard
```

### Documentation Not Generated

Check template files exist:

```bash
ls src/templates/project-docs/
```

### Resources Not Created

Verify Cloudflare login:

```bash
wrangler whoami
```

## Contributing

### Adding New Platforms

1. Add platform to `SUPPORTED_PLATFORMS` in setup-bot-enhanced.js
2. Add configuration prompts in `collectPlatformConfig()`
3. Create template sections in claude.md.hbs and init.md.hbs
4. Update generateDevVars() for new variables

### Adding New Features

1. Add to feature selection in `collectFeatures()`
2. Update resource creation if needed
3. Add documentation in templates
4. Update filters.json for any private patterns

## Related Documentation

- [QUICKSTART.md](../QUICKSTART.md) - Quick start guide
- [CLAUDE_SETUP.md](../CLAUDE_SETUP.md) - Claude Code instructions
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
- [setup-config.json](./setup-config.json) - Setup configuration

---

_Last updated: January 2025_
