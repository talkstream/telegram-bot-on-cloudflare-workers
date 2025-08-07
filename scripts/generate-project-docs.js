#!/usr/bin/env node

/**
 * Generate project-specific CLAUDE.md and INIT.md files
 * Removes private information and customizes for the specific project
 */

import chalk from 'chalk'
import fs from 'fs/promises'
import Handlebars from 'handlebars'
import ora from 'ora'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Register Handlebars helpers
Handlebars.registerHelper('ifEquals', function (arg1, arg2, options) {
  return arg1 == arg2 ? options.fn(this) : options.inverse(this)
})

Handlebars.registerHelper('includes', function (array, value, options) {
  if (!array) return options.inverse(this)
  return array.includes(value) ? options.fn(this) : options.inverse(this)
})

// Private information patterns to filter out
const PRIVATE_PATTERNS = [
  /\/Users\/[^/]+\//g, // User home paths
  /\/home\/[^/]+\//g, // Linux home paths
  /C:\\Users\\[^\\]+\\/g, // Windows user paths
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
  /sk-[a-zA-Z0-9]{48}/g, // OpenAI keys
  /AIza[a-zA-Z0-9]{35}/g, // Google API keys
  /\b\d{10}:[A-Za-z0-9_-]{35}\b/g, // Telegram tokens
  /https?:\/\/[^\s]*\/(private|internal)\//g, // Private URLs
  /TODO\s*:.*kogotochki.*/gi, // Project-specific TODOs
  /\[personal.*?\]/gi // Personal notes
]

// Template variables that will be replaced
const DEFAULT_VARIABLES = {
  projectName: 'my-wireframe-bot',
  projectDescription: 'AI-powered bot built with Wireframe',
  authorName: 'Your Name',
  botUsername: '@your_bot',
  currentVersion: '1.0.0',
  primaryPlatform: 'telegram',
  cloudProvider: 'cloudflare',
  aiProvider: 'google-ai',
  features: [],
  setupDate: new Date().toISOString().split('T')[0]
}

/**
 * Load and compile Handlebars template
 * @param {string} templateName - Template file name
 * @returns {Function} Compiled template function
 */
async function loadTemplate(templateName) {
  const templatePath = path.join(__dirname, '..', 'src', 'templates', 'project-docs', templateName)

  try {
    const templateContent = await fs.readFile(templatePath, 'utf8')
    return Handlebars.compile(templateContent)
  } catch (error) {
    // Fallback to inline template if file doesn't exist
    return getInlineTemplate(templateName)
  }
}

/**
 * Get inline template as fallback
 * @param {string} templateName - Template name
 * @returns {Function} Compiled template function
 */
function getInlineTemplate(templateName) {
  const templates = {
    'claude.md.hbs': `# CLAUDE.md - {{projectName}}

## Project Context
This is {{projectDescription}} using the Wireframe platform.

### Technical Stack
- **Platform**: {{primaryPlatform}}
- **Cloud**: {{cloudProvider}}
- **AI Provider**: {{aiProvider}}
- **Version**: {{currentVersion}}

### Development Guidelines
1. Maintain TypeScript strict mode
2. Follow the connector pattern for all integrations
3. Use event-driven architecture via EventBus
4. Implement proper error handling with circuit breakers
5. Write tests for all new features

### Key Commands
\`\`\`bash
npm run dev          # Start development server
npm run test         # Run tests
npm run typecheck    # Check TypeScript
npm run lint         # Lint code
npm run deploy       # Deploy to production
\`\`\`

### Project Structure
- \`/src/adapters\` - Platform-specific adapters
- \`/src/connectors\` - External service connectors
- \`/src/core\` - Core framework components
- \`/src/commands\` - Bot command implementations

### Current Features
{{#each features}}
- {{this}}
{{/each}}

### Important Notes
- Always use environment variables for secrets
- Test thoroughly before deploying
- Follow the existing code patterns
- Document all public APIs

Generated on {{setupDate}} for {{authorName}}
`,

    'init.md.hbs': `# INIT.md - Quick Project Setup

## First Time Setup

### 1. Install Dependencies
\`\`\`bash
npm install
\`\`\`

### 2. Configure Environment
Create \`.dev.vars\` file with your settings:
\`\`\`env
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_WEBHOOK_SECRET=your_secret_here
BOT_OWNER_IDS=your_telegram_id
{{#if aiProvider}}
AI_PROVIDER={{aiProvider}}
{{/if}}
\`\`\`

### 3. Setup Cloudflare Resources
\`\`\`bash
npm run setup:cloudflare
\`\`\`

### 4. Run Database Migrations
\`\`\`bash
npm run db:apply:local
\`\`\`

### 5. Start Development
\`\`\`bash
npm run dev
\`\`\`

### 6. Deploy to Production
\`\`\`bash
npm run deploy
\`\`\`

## Project Information
- **Name**: {{projectName}}
- **Bot**: {{botUsername}}
- **Platform**: {{primaryPlatform}}
- **Created**: {{setupDate}}

## Quick Commands
- \`npm run dev\` - Start local development
- \`npm test\` - Run test suite
- \`npm run deploy\` - Deploy to Cloudflare
- \`npm run logs\` - View production logs

## Need Help?
- Check \`/docs\` folder for detailed documentation
- Run \`npm run help\` for available commands
- Visit the [Wireframe Documentation](https://github.com/talkstream/typescript-wireframe-platform)

Generated for {{authorName}} on {{setupDate}}
`
  }

  const template = templates[templateName]
  if (!template) {
    throw new Error(`Template ${templateName} not found`)
  }

  return Handlebars.compile(template)
}

/**
 * Filter private information from content
 * @param {string} content - Content to filter
 * @returns {string} Filtered content
 */
function filterPrivateInfo(content) {
  let filtered = content

  // Apply all private patterns
  PRIVATE_PATTERNS.forEach(pattern => {
    filtered = filtered.replace(pattern, '[REDACTED]')
  })

  // Replace specific project paths with generic ones
  filtered = filtered
    .replace(/\/Documents\/Dropbox\/AApps\/wireframe/g, '/path/to/project')
    .replace(/\/Documents\/Dropbox\/AApps\/kogotochki/g, '/path/to/bot-project')
    .replace(/wireframe-kogotochki/g, 'wireframe-bot')
    .replace(/kogotochki/gi, 'bot-project')

  return filtered
}

/**
 * Generate project documentation files
 * @param {Object} config - Project configuration
 * @param {string} outputDir - Output directory
 */
export async function generateProjectDocs(config = {}, outputDir = process.cwd()) {
  const spinner = ora('Generating project documentation...').start()

  try {
    // Merge config with defaults
    const variables = { ...DEFAULT_VARIABLES, ...config }

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true })

    // Generate CLAUDE.md
    spinner.text = 'Generating CLAUDE.md...'
    const claudeTemplate = await loadTemplate('claude.md.hbs')
    let claudeContent = claudeTemplate(variables)
    claudeContent = filterPrivateInfo(claudeContent)

    const claudePath = path.join(outputDir, 'CLAUDE.md')
    await fs.writeFile(claudePath, claudeContent)
    spinner.succeed(`Generated ${chalk.green('CLAUDE.md')}`)

    // Generate INIT.md
    spinner.start('Generating INIT.md...')
    const initTemplate = await loadTemplate('init.md.hbs')
    let initContent = initTemplate(variables)
    initContent = filterPrivateInfo(initContent)

    const initPath = path.join(outputDir, 'INIT.md')
    await fs.writeFile(initPath, initContent)
    spinner.succeed(`Generated ${chalk.green('INIT.md')}`)

    return { claudePath, initPath }
  } catch (error) {
    spinner.fail(chalk.red('Failed to generate documentation'))
    throw error
  }
}

/**
 * Load existing CLAUDE.md and extract safe information
 * @param {string} claudePath - Path to existing CLAUDE.md
 * @returns {Object} Extracted configuration
 */
export async function extractFromExistingClaude(claudePath) {
  try {
    const content = await fs.readFile(claudePath, 'utf8')

    // Extract safe information
    const config = {}

    // Extract version
    const versionMatch = content.match(/Current Version:\s*v?([\d.]+)/i)
    if (versionMatch) config.currentVersion = versionMatch[1]

    // Extract project name
    const nameMatch = content.match(/^#.*?Wireframe\s+v[\d.]+\s*$/m)
    if (nameMatch) config.projectName = 'wireframe-bot'

    // Extract features
    const featuresMatch = content.match(/Key Achievements.*?\n((?:- .*\n)+)/s)
    if (featuresMatch) {
      config.features = featuresMatch[1]
        .split('\n')
        .filter(line => line.startsWith('- '))
        .map(line => line.replace(/^- /, '').replace(/✅/g, '').trim())
        .filter(feature => !feature.includes('private') && !feature.includes('token'))
    }

    return config
  } catch (error) {
    console.warn('Could not extract from existing CLAUDE.md:', error.message)
    return {}
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${chalk.bold('Generate Project Documentation')}

Usage:
  node generate-project-docs.js [options]

Options:
  --name <name>        Project name
  --description <desc> Project description
  --platform <platform> Primary platform (telegram, discord, etc.)
  --cloud <provider>   Cloud provider (cloudflare, aws, etc.)
  --ai <provider>      AI provider (google-ai, openai, etc.)
  --output <dir>       Output directory (default: current)
  --extract <file>     Extract config from existing CLAUDE.md
  --help              Show this help message

Examples:
  node generate-project-docs.js --name "my-bot" --platform telegram
  node generate-project-docs.js --extract ./CLAUDE.md --output ./my-project
`)
    process.exit(0)
  }

  // Parse arguments
  const config = {}
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--name':
        config.projectName = args[++i]
        break
      case '--description':
        config.projectDescription = args[++i]
        break
      case '--platform':
        config.primaryPlatform = args[++i]
        break
      case '--cloud':
        config.cloudProvider = args[++i]
        break
      case '--ai':
        config.aiProvider = args[++i]
        break
      case '--output':
        config.outputDir = args[++i]
        break
      case '--extract':
        const extracted = await extractFromExistingClaude(args[++i])
        Object.assign(config, extracted)
        break
    }
  }

  const outputDir = config.outputDir || process.cwd()
  delete config.outputDir

  try {
    const { claudePath, initPath } = await generateProjectDocs(config, outputDir)

    console.log(chalk.green('\n✅ Documentation generated successfully!'))
    console.log(chalk.blue(`  CLAUDE.md: ${claudePath}`))
    console.log(chalk.blue(`  INIT.md: ${initPath}`))
    console.log(
      chalk.yellow('\nThese files contain project-specific instructions for development.')
    )
  } catch (error) {
    console.error(chalk.red('\n❌ Error generating documentation:'), error.message)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
