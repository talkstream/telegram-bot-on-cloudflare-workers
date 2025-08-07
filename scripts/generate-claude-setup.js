#!/usr/bin/env node

/**
 * Generate CLAUDE_SETUP.md from setup-config.json
 *
 * This script reads the structured setup configuration and generates
 * a formatted markdown file with all setup instructions for Claude Code.
 *
 * Usage:
 *   node scripts/generate-claude-setup.js [options]
 *
 * Options:
 *   --check    Check if CLAUDE_SETUP.md is up to date (exit 1 if not)
 *   --verbose  Show detailed output
 *   --help     Show this help message
 */

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Configuration
const CONFIG_PATH = path.join(__dirname, '..', 'docs', 'setup-config.json')
const OUTPUT_PATH = path.join(__dirname, '..', 'CLAUDE_SETUP.md')
const CHECKSUM_MARKER = '<!-- CONFIG_CHECKSUM:'

// Parse command line arguments
const args = process.argv.slice(2)
const options = {
  check: args.includes('--check'),
  verbose: args.includes('--verbose'),
  help: args.includes('--help')
}

if (options.help) {
  console.log(`
Generate CLAUDE_SETUP.md from setup-config.json

Usage:
  node scripts/generate-claude-setup.js [options]

Options:
  --check    Check if CLAUDE_SETUP.md is up to date (exit 1 if not)
  --verbose  Show detailed output
  --help     Show this help message
`)
  process.exit(0)
}

/**
 * Load and parse the setup configuration
 * @returns {Object} Setup configuration object
 */
function loadConfig() {
  try {
    const configContent = fs.readFileSync(CONFIG_PATH, 'utf8')
    return JSON.parse(configContent)
  } catch (error) {
    console.error(`Error loading config from ${CONFIG_PATH}:`, error.message)
    process.exit(1)
  }
}

/**
 * Calculate checksum of the configuration
 * @param {Object} config - Configuration object
 * @returns {string} MD5 checksum
 */
function calculateChecksum(config) {
  const content = JSON.stringify(config, null, 2)
  return crypto.createHash('md5').update(content).digest('hex')
}

/**
 * Generate progress bar visualization
 * @param {number} percentage - Progress percentage (0-100)
 * @param {number} width - Bar width in characters
 * @returns {string} Progress bar string
 */
function generateProgressBar(percentage, width = 32) {
  const filled = Math.floor((percentage / 100) * width)
  const empty = width - filled
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']'
}

/**
 * Format environment variable section
 * @param {Array} vars - Array of environment variables
 * @param {string} type - 'required' or 'optional'
 * @returns {string} Formatted markdown
 */
function formatEnvironmentVariables(vars, type) {
  let markdown = ''

  vars.forEach((variable, index) => {
    markdown += `\n### 2.${type === 'required' ? index + 1 : index + 4} ${variable.name}${
      type === 'optional' ? ' (Optional)' : ''
    }\n\n`

    if (variable.instructions) {
      markdown += '```\n'
      markdown += `${getEmojiForVariable(variable.name)} ${variable.description}\n\n`
      markdown += variable.instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')
      markdown += `\n\n📝 Enter your ${variable.name.toLowerCase().replace(/_/g, ' ')}: \n`
      markdown += '```\n'
    } else if (variable.generated) {
      markdown += `This will be automatically generated using: \`${variable.generator}\`\n`
    } else {
      markdown += '```\n'
      markdown += `${getEmojiForVariable(variable.name)} ${variable.description}\n\n`

      if (variable.options) {
        markdown += 'Available options:\n'
        variable.options.forEach((opt, i) => {
          markdown += `${i + 1}. ${formatOption(opt)}\n`
        })
        markdown += `\nChoose option [1-${variable.options.length}]: \n`
      } else if (variable.setupUrl) {
        markdown += `Get it from: ${variable.setupUrl}\n\n`
        markdown += `📝 ${variable.name} (or press Enter to skip): \n`
      } else {
        markdown += `📝 Enter ${variable.name}: \n`
      }
      markdown += '```\n'
    }

    if (variable.validation) {
      markdown += `\nValidate the format: \`${variable.validation}\`\n`
    }

    if (variable.example) {
      markdown += `Example: \`${variable.example}\`\n`
    }
  })

  return markdown
}

/**
 * Get appropriate emoji for variable type
 * @param {string} varName - Variable name
 * @returns {string} Emoji
 */
function getEmojiForVariable(varName) {
  const emojiMap = {
    TELEGRAM_BOT_TOKEN: '🤖',
    BOT_OWNER_IDS: '👤',
    SENTRY_DSN: '🛡️',
    AI_PROVIDER: '🧠',
    TIER: '💎'
  }
  return emojiMap[varName] || '📝'
}

/**
 * Format AI provider option
 * @param {string} option - Provider option
 * @returns {string} Formatted option
 */
function formatOption(option) {
  const providerNames = {
    'google-ai': 'Google Gemini (Recommended - has free tier)',
    openai: 'OpenAI',
    xai: 'xAI (Grok)',
    deepseek: 'DeepSeek',
    'cloudflare-ai': 'Cloudflare AI'
  }
  return providerNames[option] || option
}

/**
 * Format setup phase
 * @param {Object} phase - Phase configuration
 * @returns {string} Formatted markdown
 */
function formatSetupPhase(phase, phaseNumber) {
  let markdown = `\n## ${phase.emoji} Phase ${phaseNumber}: ${phase.name}\n`

  phase.steps.forEach((step, index) => {
    markdown += `\n### ${phaseNumber}.${index + 1} ${step.name}\n\n`

    if (step.description) {
      markdown += `${step.description}\n\n`
    }

    if (step.command) {
      markdown += '```bash\n'
      markdown += `${step.command}\n`
      markdown += '```\n'
    }

    if (step.showProgress) {
      markdown += '\nShow progress:\n\n```\n'
      if (step.progressSteps) {
        // Multiple step progress
        for (let i = 1; i <= step.progressSteps; i++) {
          const percentage = Math.floor((i / step.progressSteps) * 100)
          markdown += `${generateProgressBar(percentage)} ${percentage}% - Step ${i} of ${step.progressSteps}...\n`
        }
      } else if (step.count) {
        // Multiple items progress
        for (let i = 1; i <= step.count; i++) {
          const percentage = Math.floor((i / step.count) * 100)
          markdown += `${generateProgressBar(percentage)} ${percentage}% - Item ${i} of ${step.count}...\n`
        }
      } else {
        // Single progress bar
        markdown += `📦 ${step.name}...\n`
        markdown += `${generateProgressBar(50)} 50% - In progress...\n`
      }
      markdown += '```\n'
    }

    if (step.critical) {
      markdown += '\n**⚠️ This step is critical and must succeed to continue.**\n'
    }

    if (step.optional) {
      markdown += '\n**ℹ️ This step is optional and can be skipped.**\n'
    }
  })

  return markdown
}

/**
 * Format error handling section
 * @param {Object} errorHandling - Error handling configuration
 * @returns {string} Formatted markdown
 */
function formatErrorHandling(errorHandling) {
  let markdown = '\n## 🚨 Error Handling\n\n'
  markdown += 'For each phase, implement proper error handling:\n\n'
  markdown += '### Common Errors and Solutions:\n'

  errorHandling.common_errors.forEach((error, index) => {
    markdown += `\n${index + 1}. **${error.message}**\n\n`
    markdown += '   ```\n'
    markdown += `   ❌ ${error.pattern}\n\n`
    markdown += '   Solution:\n'
    error.solutions.forEach(solution => {
      markdown += `   • ${solution}\n`
    })
    markdown += '   ```\n'
  })

  return markdown
}

/**
 * Format success dashboard
 * @param {Object} dashboard - Dashboard configuration
 * @returns {string} Formatted markdown
 */
function formatSuccessDashboard(dashboard) {
  let markdown = '\n## ✅ Phase 7: Success Dashboard\n\n```\n'
  markdown += '╔════════════════════════════════════════════════════════════╗\n'
  markdown += '║                    🎉 Setup Complete! 🎉                   ║\n'
  markdown += '╠════════════════════════════════════════════════════════════╣\n'
  markdown += '║                                                            ║\n'

  dashboard.sections.forEach(section => {
    markdown += `║  ${section.title}:${' '.repeat(58 - section.title.length - 2)}║\n`
    section.items.forEach(item => {
      const displayItem = item.includes('_') ? `{${item}}` : item
      markdown += `║     • ${displayItem}${' '.repeat(53 - displayItem.length)}║\n`
    })
    markdown += '║                                                            ║\n'
  })

  markdown += '╚════════════════════════════════════════════════════════════╝\n'
  markdown += '```\n'

  return markdown
}

/**
 * Generate the complete CLAUDE_SETUP.md content
 * @param {Object} config - Setup configuration
 * @returns {string} Complete markdown content
 */
function generateMarkdown(config) {
  const checksum = calculateChecksum(config)
  let markdown = '# Claude Code Automated Setup Instructions\n\n'
  markdown += `**IMPORTANT**: This file contains instructions for Claude Code AI assistant. When a user asks to setup this project, follow these steps exactly.\n\n`
  markdown += '## 🎯 Setup Overview\n\n'
  markdown += `This is an automated setup guide for the Telegram Bot on Cloudflare Workers wireframe. The entire process should be interactive and user-friendly, with clear progress indicators and error handling.\n\n`

  // Pre-Setup Phase
  markdown += '## 📋 Pre-Setup Phase\n\n'
  markdown += '### Check and Install MCP Servers\n\n'
  markdown +=
    'First, check if the required MCP servers are installed. If not, guide the user to install them:\n\n'
  markdown += '```bash\n'
  markdown += '# Check if MCP servers are available by attempting to use them\n'
  markdown += '# If any fail, show these installation commands:\n\n'

  config.mcp_servers.forEach(server => {
    server.urls.forEach(url => {
      markdown += `claude mcp add ${server.name} ${url}\n`
    })
  })

  markdown += '```\n\nShow progress:\n\n```\n'
  markdown += '🔧 Checking MCP servers...\n'
  config.mcp_servers.forEach(server => {
    if (server.required) {
      markdown += `✅ ${server.displayName}: Available\n`
    }
  })
  markdown += '```\n'

  // Project Setup Phase
  let phaseNumber = 1
  config.setup_phases.forEach(phase => {
    if (phase.id === 'project-setup') {
      markdown += formatSetupPhase(phase, phaseNumber++)

      // Add specific environment check details
      markdown += '\nRequired:\n\n'
      markdown += `- Node.js ${config.requirements.node.minimum} or higher\n`
      markdown += `- npm ${config.requirements.npm.minimum} or higher\n\n`
      markdown += 'If missing, provide installation instructions:\n\n'
      markdown += `- **Node.js**: Direct to ${config.requirements.node.installUrl} or suggest using nvm\n`
      markdown += `- **npm**: ${config.requirements.npm.note}\n`
    }
  })

  // Token Collection Phase
  markdown += '\n## 🔐 Phase 2: Token Collection\n'
  markdown += formatEnvironmentVariables(
    config.environment_variables.required.filter(v => !v.generated),
    'required'
  )

  // AI Provider special handling
  const aiProviderVar = config.environment_variables.optional.find(v => v.name === 'AI_PROVIDER')
  if (aiProviderVar) {
    markdown += formatEnvironmentVariables([aiProviderVar], 'optional')

    markdown += '\nIf user chooses a provider, help them get the API key:\n\n'
    config.environment_variables.optional
      .filter(v => v.name.endsWith('_API_KEY'))
      .forEach(v => {
        if (v.setupUrl) {
          markdown += `- **${v.name.replace('_API_KEY', '')}**: Direct to ${v.setupUrl}\n`
        }
      })
    markdown += '- Show appropriate links for other providers\n'
  }

  // Sentry setup
  const sentryVar = config.environment_variables.optional.find(v => v.name === 'SENTRY_DSN')
  if (sentryVar) {
    markdown += formatEnvironmentVariables([sentryVar], 'optional')
    markdown += '\nIf yes:\n\n```\n'
    markdown += 'Please provide your Sentry DSN:\n'
    markdown += `(Get it from ${sentryVar.setupUrl})\n\n`
    markdown += '📝 Sentry DSN (or press Enter to skip): \n```\n'
  }

  // Cloudflare Setup Phase
  const cloudflarePhase = config.setup_phases.find(p => p.id === 'cloudflare-setup')
  if (cloudflarePhase) {
    markdown += formatSetupPhase(cloudflarePhase, 3)

    // Add specific resource details
    markdown += '\nUsing Cloudflare MCP:\n\n```\n'
    markdown += '💾 Creating D1 Database...\n'
    markdown += `Database Name: ${config.cloudflare_resources.d1_database.name}\n`
    markdown += '```\n\nCapture the database ID from the response.\n'

    markdown += '\n### 3.3 Create KV Namespaces\n\n'
    markdown += 'Create three KV namespaces:\n\n```\n'
    markdown += '📚 Creating KV Namespaces...\n'
    const kvCount = config.cloudflare_resources.kv_namespaces.length
    config.cloudflare_resources.kv_namespaces.forEach((kv, index) => {
      const percentage = Math.floor(((index + 1) / kvCount) * 100)
      markdown += `${generateProgressBar(percentage)} ${percentage}% - Creating ${kv.name} namespace...\n`
    })
    markdown += '```\n\nCapture all namespace IDs.\n'
  }

  // Configuration Phase
  markdown += '\n## ⚙️ Phase 4: Configuration\n\n'
  markdown += '### 4.1 Generate Webhook Secret\n\n'
  markdown += '```python\n'
  markdown += '# Generate a secure webhook secret\n'
  markdown += 'import secrets\n'
  markdown += 'webhook_secret = secrets.token_urlsafe(32)\n'
  markdown += '```\n\n'
  markdown += '### 4.2 Create .dev.vars\n\n'
  markdown += 'Create `.dev.vars` file with all collected information:\n\n```\n'
  markdown += '📝 Creating configuration files...\n'
  markdown += '✅ .dev.vars created\n'
  markdown += '```\n\n'
  markdown += '### 4.3 Update wrangler.toml\n\n'
  markdown += 'Update `wrangler.toml` with the collected IDs:\n\n```\n'
  markdown += '✅ wrangler.toml updated with your resource IDs\n'
  markdown += '```\n'

  // Database Setup Phase
  const dbPhase = config.setup_phases.find(p => p.id === 'database-setup')
  if (dbPhase) {
    markdown += '\n## 🗄️ Phase 5: Database Setup\n\n'
    markdown += '### 5.1 Run Migrations\n\n```\n'
    markdown += '🔨 Setting up database...\n'
    const migrations = config.cloudflare_resources.d1_database.migrations
    migrations.forEach((migration, index) => {
      const percentage = Math.floor(((index + 1) / migrations.length) * 100)
      markdown += `${generateProgressBar(percentage)} ${percentage}% - ${migration}...\n`
    })
    markdown += '```\n\nRun: `npm run db:apply:local`\n'
  }

  // Testing & Launch Phase
  const testPhase = config.setup_phases.find(p => p.id === 'testing-launch')
  if (testPhase) {
    markdown += formatSetupPhase(testPhase, 6)

    // Add specific test bot instructions
    markdown += '\n### 6.4 Test Bot\n\n```\n'
    markdown += '🎯 Testing your bot...\n\n'
    markdown += 'Please open Telegram and:\n'
    markdown += '1. Search for your bot: @{bot_username}\n'
    markdown += '2. Send /start command\n'
    markdown += '3. You should receive a welcome message!\n\n'
    markdown += 'Waiting for test message...\n```\n'
  }

  // Success Dashboard
  if (config.success_dashboard && config.success_dashboard.show) {
    markdown += formatSuccessDashboard(config.success_dashboard)
  }

  // Error Handling
  if (config.error_handling) {
    markdown += formatErrorHandling(config.error_handling)
  }

  // Implementation Notes
  markdown += '\n## 📝 Implementation Notes\n\n'
  markdown += '1. **Use console colors for better UX**:\n'
  Object.entries(config.implementation_notes.console_colors).forEach(([type, color]) => {
    const symbols = { success: '✅', error: '❌', info: '🔵', warning: '🟡' }
    markdown += `   - ${symbols[type]} ${color.charAt(0).toUpperCase() + color.slice(1)} for ${type}\n`
  })

  markdown += '\n2. **Save progress state** in case of interruption\n\n'
  markdown += '3. **Validate all inputs** before proceeding\n\n'
  markdown += '4. **Offer retry options** for failed steps\n\n'
  markdown += '5. **Provide copy-paste commands** where possible\n\n'
  markdown += '6. **Keep user informed** with clear progress indicators\n\n'
  markdown += '7. **Test each step** before moving to the next\n\n'
  markdown += '8. **Graceful degradation** - if optional features fail, continue with core setup\n'

  // Success Criteria
  markdown += '\n## 🎯 Success Criteria\n\n'
  markdown += 'The setup is considered successful when:\n\n'
  markdown += '- ✅ All dependencies installed\n'
  markdown += '- ✅ Configuration files created\n'
  markdown += '- ✅ Cloudflare resources provisioned\n'
  markdown += '- ✅ Database migrations applied\n'
  markdown += '- ✅ Tests passing\n'
  markdown += '- ✅ Local server running\n'
  markdown += '- ✅ Webhook set and verified\n'
  markdown += '- ✅ Bot responds to /start command\n'

  // Rollback Plan
  markdown += '\n## 🔄 Rollback Plan\n\n'
  markdown += 'If setup fails at any point:\n\n'
  markdown += '1. Document what was completed\n'
  markdown += '2. Provide cleanup commands if needed\n'
  markdown += '3. Save partial configuration for retry\n'
  markdown += '4. Offer to start over or continue from failure point\n'

  // Add checksum as comment for tracking
  markdown += `\n${CHECKSUM_MARKER}${checksum} -->\n`

  return markdown
}

/**
 * Check if the current CLAUDE_SETUP.md matches the configuration
 * @param {string} newContent - New generated content
 * @returns {boolean} True if up to date
 */
function checkIfUpToDate(newContent) {
  if (!fs.existsSync(OUTPUT_PATH)) {
    return false
  }

  const currentContent = fs.readFileSync(OUTPUT_PATH, 'utf8')

  // Extract checksums
  const currentMatch = currentContent.match(new RegExp(`${CHECKSUM_MARKER}([a-f0-9]+) -->`))
  const newMatch = newContent.match(new RegExp(`${CHECKSUM_MARKER}([a-f0-9]+) -->`))

  if (!currentMatch || !newMatch) {
    return false
  }

  return currentMatch[1] === newMatch[1]
}

/**
 * Main function
 */
function main() {
  try {
    // Load configuration
    const config = loadConfig()
    if (options.verbose) {
      console.log('✅ Loaded configuration from', CONFIG_PATH)
    }

    // Generate markdown
    const markdown = generateMarkdown(config)
    if (options.verbose) {
      console.log('✅ Generated markdown content')
    }

    // Check mode
    if (options.check) {
      const isUpToDate = checkIfUpToDate(markdown)
      if (isUpToDate) {
        console.log('✅ CLAUDE_SETUP.md is up to date')
        process.exit(0)
      } else {
        console.error('❌ CLAUDE_SETUP.md is out of date')
        console.error('Run: npm run docs:generate')
        process.exit(1)
      }
    }

    // Write file
    fs.writeFileSync(OUTPUT_PATH, markdown)
    console.log('✅ Generated CLAUDE_SETUP.md successfully')

    if (options.verbose) {
      console.log(`📄 Output written to: ${OUTPUT_PATH}`)
      console.log(`📏 File size: ${markdown.length} bytes`)
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (options.verbose) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// Run the script
main()
