#!/usr/bin/env node

/**
 * Enhanced Setup Wizard for Wireframe Bot Platform
 * Includes project documentation generation and state management
 */

import chalk from 'chalk'
import { exec } from 'child_process'
import fs from 'fs/promises'
import inquirer from 'inquirer'
import ora from 'ora'
import path from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'
import { generateProjectDocs } from './generate-project-docs.js'

const execAsync = promisify(exec)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SETUP_STATE_FILE = '.setup-state.json'
const SUPPORTED_PLATFORMS = {
  telegram: '📱 Telegram',
  discord: '🎮 Discord',
  slack: '💼 Slack',
  whatsapp: '💬 WhatsApp'
}

const SUPPORTED_CLOUDS = {
  cloudflare: '☁️ Cloudflare Workers',
  aws: '🔶 AWS Lambda',
  gcp: '🔷 Google Cloud Functions',
  azure: '🔵 Azure Functions'
}

const AI_PROVIDERS = {
  'google-ai': '🌟 Google Gemini (Free tier available)',
  openai: '🤖 OpenAI (GPT-4)',
  anthropic: '🧠 Anthropic (Claude)',
  xai: '🎯 xAI (Grok)',
  deepseek: '🔍 DeepSeek',
  'cloudflare-ai': '☁️ Cloudflare AI',
  none: '❌ No AI Provider'
}

// Banner
console.log(
  chalk.blue.bold(`
╔════════════════════════════════════════════════════════════╗
║          🚀 Wireframe Bot Platform Setup Wizard 🚀         ║
║                                                            ║
║  Universal AI Assistant Framework for Any Platform & Cloud ║
╚════════════════════════════════════════════════════════════╝
`)
)

/**
 * Save setup state for resuming
 */
async function saveState(state) {
  await fs.writeFile(SETUP_STATE_FILE, JSON.stringify(state, null, 2))
}

/**
 * Load previous setup state
 */
async function loadState() {
  try {
    const state = await fs.readFile(SETUP_STATE_FILE, 'utf8')
    return JSON.parse(state)
  } catch {
    return null
  }
}

/**
 * Clean up state file
 */
async function cleanupState() {
  try {
    await fs.unlink(SETUP_STATE_FILE)
  } catch {
    // Ignore if doesn't exist
  }
}

/**
 * Check prerequisites
 */
async function checkPrerequisites() {
  const spinner = ora('Checking prerequisites...').start()
  const issues = []

  try {
    // Check Node.js version
    const nodeVersion = process.version
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1))
    if (majorVersion < 20) {
      issues.push(`Node.js 20+ required (found ${nodeVersion})`)
    }

    // Check npm version
    try {
      const { stdout } = await execAsync('npm --version')
      const npmVersion = stdout.trim()
      const npmMajor = parseInt(npmVersion.split('.')[0])
      if (npmMajor < 10) {
        issues.push(`npm 10+ required (found ${npmVersion})`)
      }
    } catch {
      issues.push('npm not found')
    }

    // Check git
    try {
      await execAsync('git --version')
    } catch {
      issues.push('Git not found')
    }

    if (issues.length > 0) {
      spinner.fail(chalk.red('Prerequisites check failed:'))
      issues.forEach(issue => console.log(chalk.red(`  ❌ ${issue}`)))

      console.log(chalk.yellow('\nPlease fix these issues and try again:'))
      console.log('  • Node.js: https://nodejs.org/')
      console.log('  • Git: https://git-scm.com/')
      process.exit(1)
    }

    spinner.succeed(chalk.green('Prerequisites check passed'))
    return true
  } catch (error) {
    spinner.fail(chalk.red('Prerequisites check failed'))
    console.error(error)
    process.exit(1)
  }
}

/**
 * Collect project information
 */
async function collectProjectInfo(previousState = {}) {
  console.log(chalk.cyan('\n📋 Project Information\n'))

  const projectInfo = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: previousState.projectName || 'my-wireframe-bot',
      validate: input => {
        if (!input) return 'Project name is required'
        if (!/^[a-z0-9-]+$/.test(input)) {
          return 'Project name must contain only lowercase letters, numbers, and hyphens'
        }
        return true
      }
    },
    {
      type: 'input',
      name: 'projectDescription',
      message: 'Project description:',
      default: previousState.projectDescription || 'AI-powered assistant bot'
    },
    {
      type: 'input',
      name: 'authorName',
      message: 'Your name (for documentation):',
      default: previousState.authorName || ''
    },
    {
      type: 'list',
      name: 'platform',
      message: 'Choose messaging platform:',
      choices: Object.entries(SUPPORTED_PLATFORMS).map(([value, name]) => ({ name, value })),
      default: previousState.platform || 'telegram'
    },
    {
      type: 'list',
      name: 'cloud',
      message: 'Choose cloud provider:',
      choices: Object.entries(SUPPORTED_CLOUDS).map(([value, name]) => ({ name, value })),
      default: previousState.cloud || 'cloudflare'
    }
  ])

  await saveState({ ...previousState, ...projectInfo, step: 'project_info' })
  return projectInfo
}

/**
 * Collect platform-specific configuration
 */
async function collectPlatformConfig(platform, previousState = {}) {
  console.log(chalk.cyan(`\n🔧 ${SUPPORTED_PLATFORMS[platform]} Configuration\n`))

  let config = {}

  switch (platform) {
    case 'telegram':
      config = await inquirer.prompt([
        {
          type: 'input',
          name: 'botToken',
          message: 'Telegram Bot Token (from @BotFather):',
          default: previousState.botToken,
          validate: input => {
            if (!input) return 'Bot token is required'
            if (!/^\d{10}:[A-Za-z0-9_-]{35}$/.test(input)) {
              return 'Invalid bot token format'
            }
            return true
          }
        },
        {
          type: 'input',
          name: 'botUsername',
          message: 'Bot username (e.g., @mybot):',
          default: previousState.botUsername,
          validate: input => {
            if (!input) return 'Bot username is required'
            if (!input.startsWith('@')) return 'Username must start with @'
            return true
          }
        },
        {
          type: 'password',
          name: 'webhookSecret',
          message: 'Webhook secret (or press Enter to generate):',
          default: () => generateSecret()
        },
        {
          type: 'input',
          name: 'ownerIds',
          message: 'Your Telegram user ID (get from @userinfobot):',
          default: previousState.ownerIds,
          validate: input => {
            if (!input) return 'At least one owner ID is required'
            if (!/^\d+(,\d+)*$/.test(input)) {
              return 'Invalid format. Use comma-separated numbers'
            }
            return true
          }
        }
      ])
      break

    case 'discord':
      config = await inquirer.prompt([
        {
          type: 'input',
          name: 'botToken',
          message: 'Discord Bot Token:',
          default: previousState.botToken,
          validate: input => input.length > 0 || 'Bot token is required'
        },
        {
          type: 'input',
          name: 'applicationId',
          message: 'Discord Application ID:',
          default: previousState.applicationId,
          validate: input => input.length > 0 || 'Application ID is required'
        }
      ])
      break

    // Add other platforms as needed
  }

  await saveState({ ...previousState, ...config, step: 'platform_config' })
  return config
}

/**
 * Collect AI provider configuration
 */
async function collectAIConfig(previousState = {}) {
  console.log(chalk.cyan('\n🧠 AI Provider Configuration\n'))

  const { aiProvider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'aiProvider',
      message: 'Choose AI provider:',
      choices: Object.entries(AI_PROVIDERS).map(([value, name]) => ({ name, value })),
      default: previousState.aiProvider || 'google-ai'
    }
  ])

  let aiConfig = { aiProvider }

  if (aiProvider !== 'none') {
    const keyPrompt = {
      type: 'password',
      name: 'aiApiKey',
      message: `Enter ${AI_PROVIDERS[aiProvider]} API key:`,
      validate: input => input.length > 0 || 'API key is required'
    }

    const { aiApiKey } = await inquirer.prompt([keyPrompt])
    aiConfig.aiApiKey = aiApiKey
  }

  await saveState({ ...previousState, ...aiConfig, step: 'ai_config' })
  return aiConfig
}

/**
 * Collect additional features
 */
async function collectFeatures(previousState = {}) {
  console.log(chalk.cyan('\n✨ Additional Features\n'))

  const { features } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'features',
      message: 'Select features to enable:',
      choices: [
        { name: '💾 Database (D1/DynamoDB)', value: 'database', checked: true },
        { name: '🗄️ KV Storage', value: 'kv', checked: true },
        { name: '💳 Payment Processing', value: 'payments' },
        { name: '📊 Analytics & Monitoring', value: 'analytics' },
        { name: '🌍 Internationalization (i18n)', value: 'i18n' },
        { name: '🔔 Advanced Notifications', value: 'notifications' },
        { name: '📈 Admin Dashboard', value: 'admin' },
        { name: '🛡️ Sentry Error Tracking', value: 'sentry' }
      ],
      default: previousState.features || ['database', 'kv']
    }
  ])

  let additionalConfig = { features }

  // Collect Sentry DSN if enabled
  if (features.includes('sentry')) {
    const { sentryDsn } = await inquirer.prompt([
      {
        type: 'input',
        name: 'sentryDsn',
        message: 'Sentry DSN (optional, press Enter to skip):',
        default: previousState.sentryDsn || ''
      }
    ])
    additionalConfig.sentryDsn = sentryDsn
  }

  await saveState({ ...previousState, ...additionalConfig, step: 'features' })
  return additionalConfig
}

/**
 * Generate configuration files
 */
async function generateConfigurations(config) {
  const spinner = ora('Generating configuration files...').start()

  try {
    // Generate .dev.vars
    spinner.text = 'Creating .dev.vars...'
    const devVars = generateDevVars(config)
    await fs.writeFile('.dev.vars', devVars)

    // Update wrangler.toml if Cloudflare
    if (config.cloud === 'cloudflare') {
      spinner.text = 'Updating wrangler.toml...'
      await updateWranglerConfig(config)
    }

    // Generate project documentation
    spinner.text = 'Generating project documentation...'
    await generateProjectDocs({
      projectName: config.projectName,
      projectDescription: config.projectDescription,
      authorName: config.authorName,
      botUsername: config.botUsername,
      primaryPlatform: config.platform,
      cloudProvider: config.cloud,
      aiProvider: config.aiProvider,
      features: config.features,
      currentVersion: '1.0.0',
      botToken: '[CONFIGURED]',
      webhookSecret: '[CONFIGURED]',
      ownerIds: config.ownerIds
    })

    spinner.succeed(chalk.green('Configuration files generated successfully'))
  } catch (error) {
    spinner.fail(chalk.red('Failed to generate configurations'))
    throw error
  }
}

/**
 * Generate .dev.vars content
 */
function generateDevVars(config) {
  let vars = []

  // Platform-specific
  if (config.platform === 'telegram') {
    vars.push(`TELEGRAM_BOT_TOKEN=${config.botToken}`)
    vars.push(`TELEGRAM_WEBHOOK_SECRET=${config.webhookSecret}`)
    vars.push(`BOT_OWNER_IDS=${config.ownerIds}`)
  } else if (config.platform === 'discord') {
    vars.push(`DISCORD_BOT_TOKEN=${config.botToken}`)
    vars.push(`DISCORD_APPLICATION_ID=${config.applicationId}`)
  }

  // AI Provider
  if (config.aiProvider && config.aiProvider !== 'none') {
    vars.push(`AI_PROVIDER=${config.aiProvider}`)

    const keyMap = {
      'google-ai': 'GEMINI_API_KEY',
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      xai: 'XAI_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
      'cloudflare-ai': 'CLOUDFLARE_AI_API_TOKEN'
    }

    if (keyMap[config.aiProvider]) {
      vars.push(`${keyMap[config.aiProvider]}=${config.aiApiKey}`)
    }
  }

  // Features
  if (config.sentryDsn) {
    vars.push(`SENTRY_DSN=${config.sentryDsn}`)
  }

  vars.push(`ENVIRONMENT=development`)
  vars.push(`PROJECT_NAME=${config.projectName}`)

  return vars.join('\n') + '\n'
}

/**
 * Update wrangler.toml configuration
 */
async function updateWranglerConfig(config) {
  const wranglerPath = 'wrangler.toml'

  try {
    let content = await fs.readFile(wranglerPath, 'utf8')

    // Update name
    content = content.replace(/name = ".*"/, `name = "${config.projectName}"`)

    // Update compatibility date to latest
    const today = new Date().toISOString().split('T')[0]
    content = content.replace(/compatibility_date = ".*"/, `compatibility_date = "${today}"`)

    await fs.writeFile(wranglerPath, content)
  } catch (error) {
    console.warn(
      chalk.yellow('Could not update wrangler.toml - you may need to update it manually')
    )
  }
}

/**
 * Setup cloud resources
 */
async function setupCloudResources(config) {
  if (config.cloud !== 'cloudflare') {
    console.log(chalk.yellow('\nAutomatic resource creation is only available for Cloudflare.'))
    console.log('Please refer to the documentation for manual setup instructions.')
    return
  }

  const spinner = ora('Creating Cloudflare resources...').start()

  try {
    // Check if wrangler is logged in
    try {
      await execAsync('wrangler whoami')
    } catch {
      spinner.fail(chalk.red('Not logged in to Cloudflare'))
      console.log(chalk.yellow('Please run: wrangler login'))
      return
    }

    const resources = []

    // Create D1 database if needed
    if (config.features.includes('database')) {
      spinner.text = 'Creating D1 database...'
      try {
        const result = await execAsync(`wrangler d1 create ${config.projectName}-db`)
        const idMatch = result.stdout.match(/database_id = "([^"]+)"/)
        if (idMatch) {
          resources.push({ type: 'd1', name: `${config.projectName}-db`, id: idMatch[1] })
        }
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(chalk.yellow('\nDatabase already exists'))
        } else {
          throw error
        }
      }
    }

    // Create KV namespaces if needed
    if (config.features.includes('kv')) {
      spinner.text = 'Creating KV namespaces...'
      const namespaces = ['cache', 'sessions', 'storage']

      for (const ns of namespaces) {
        try {
          const result = await execAsync(
            `wrangler kv:namespace create "${config.projectName}_${ns}"`
          )
          const idMatch = result.stdout.match(/id = "([^"]+)"/)
          if (idMatch) {
            resources.push({ type: 'kv', name: `${config.projectName}_${ns}`, id: idMatch[1] })
          }
        } catch (error) {
          if (error.message.includes('already exists')) {
            console.log(chalk.yellow(`\nKV namespace ${ns} already exists`))
          }
        }
      }
    }

    spinner.succeed(chalk.green('Cloud resources created'))

    if (resources.length > 0) {
      console.log(chalk.cyan('\n📝 Add these to your wrangler.toml:\n'))

      // D1 databases
      const d1Resources = resources.filter(r => r.type === 'd1')
      if (d1Resources.length > 0) {
        console.log('[[d1_databases]]')
        d1Resources.forEach(r => {
          console.log(`binding = "DB"`)
          console.log(`database_name = "${r.name}"`)
          console.log(`database_id = "${r.id}"\n`)
        })
      }

      // KV namespaces
      const kvResources = resources.filter(r => r.type === 'kv')
      if (kvResources.length > 0) {
        kvResources.forEach(r => {
          console.log('[[kv_namespaces]]')
          const binding = r.name.split('_').pop().toUpperCase()
          console.log(`binding = "${binding}"`)
          console.log(`id = "${r.id}"\n`)
        })
      }
    }
  } catch (error) {
    spinner.fail(chalk.red('Failed to create some resources'))
    console.error(error.message)
  }
}

/**
 * Run database migrations
 */
async function runMigrations() {
  const spinner = ora('Running database migrations...').start()

  try {
    await execAsync('npm run db:apply:local')
    spinner.succeed(chalk.green('Database migrations applied'))
  } catch (error) {
    spinner.fail(chalk.red('Failed to run migrations'))
    console.log(chalk.yellow('You can run them manually later with: npm run db:apply:local'))
  }
}

/**
 * Deploy bot
 */
async function deployBot(config) {
  const { shouldDeploy } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldDeploy',
      message: 'Deploy bot to production now?',
      default: false
    }
  ])

  if (!shouldDeploy) return null

  const spinner = ora('Deploying bot...').start()

  try {
    const result = await execAsync('npm run deploy')
    spinner.succeed(chalk.green('Bot deployed successfully'))

    // Extract URL
    const urlMatch = result.stdout.match(/https:\/\/[^\s]+\.workers\.dev/)
    return urlMatch ? urlMatch[0] : null
  } catch (error) {
    spinner.fail(chalk.red('Deployment failed'))
    console.error(error.message)
    return null
  }
}

/**
 * Generate a secure random secret
 */
function generateSecret() {
  return Array.from({ length: 32 }, () => Math.random().toString(36).charAt(2)).join('')
}

/**
 * Display success message
 */
function displaySuccess(config) {
  console.log(
    chalk.green.bold(`
╔════════════════════════════════════════════════════════════╗
║                    ✅ Setup Complete! ✅                   ║
╚════════════════════════════════════════════════════════════╝
`)
  )

  console.log(chalk.cyan('📋 Project Summary:\n'))
  console.log(`  • Name: ${chalk.bold(config.projectName)}`)
  console.log(`  • Platform: ${chalk.bold(SUPPORTED_PLATFORMS[config.platform])}`)
  console.log(`  • Cloud: ${chalk.bold(SUPPORTED_CLOUDS[config.cloud])}`)
  console.log(`  • AI: ${chalk.bold(AI_PROVIDERS[config.aiProvider || 'none'])}`)
  console.log(`  • Features: ${config.features.join(', ')}`)

  console.log(chalk.cyan('\n📚 Generated Documentation:\n'))
  console.log(`  • ${chalk.bold('CLAUDE.md')} - Development guide for Claude Code`)
  console.log(`  • ${chalk.bold('INIT.md')} - Quick start instructions`)
  console.log(`  • ${chalk.bold('.dev.vars')} - Environment configuration`)

  console.log(chalk.cyan('\n🎯 Next Steps:\n'))
  console.log('  1. Review and update wrangler.toml with resource IDs')
  console.log('  2. Start development: ' + chalk.bold('npm run dev'))
  console.log('  3. Open your bot and test with /start command')
  console.log('  4. Read INIT.md for detailed instructions')

  console.log(chalk.cyan('\n📖 Useful Commands:\n'))
  console.log('  • ' + chalk.bold('npm run dev') + ' - Start local development')
  console.log('  • ' + chalk.bold('npm test') + ' - Run tests')
  console.log('  • ' + chalk.bold('npm run deploy') + ' - Deploy to production')
  console.log('  • ' + chalk.bold('npm run logs:tail') + ' - View live logs')

  console.log(chalk.green('\n🎉 Happy coding!\n'))
}

/**
 * Main setup flow
 */
async function main() {
  try {
    // Check for previous state
    const previousState = await loadState()
    if (previousState) {
      const { resume } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'resume',
          message: 'Previous setup detected. Resume from where you left off?',
          default: true
        }
      ])

      if (!resume) {
        await cleanupState()
      }
    }

    // Run setup steps
    await checkPrerequisites()

    const state = previousState || {}

    // Collect all configuration
    const projectInfo = await collectProjectInfo(state)
    const platformConfig = await collectPlatformConfig(projectInfo.platform, {
      ...state,
      ...projectInfo
    })
    const aiConfig = await collectAIConfig({ ...state, ...projectInfo, ...platformConfig })
    const features = await collectFeatures({
      ...state,
      ...projectInfo,
      ...platformConfig,
      ...aiConfig
    })

    const fullConfig = {
      ...projectInfo,
      ...platformConfig,
      ...aiConfig,
      ...features
    }

    // Generate configurations
    await generateConfigurations(fullConfig)

    // Setup cloud resources
    await setupCloudResources(fullConfig)

    // Run migrations
    if (fullConfig.features.includes('database')) {
      await runMigrations()
    }

    // Deploy if desired
    const deployUrl = await deployBot(fullConfig)

    if (deployUrl) {
      console.log(chalk.blue(`\n🌐 Bot URL: ${deployUrl}`))
    }

    // Clean up state file
    await cleanupState()

    // Display success message
    displaySuccess(fullConfig)
  } catch (error) {
    console.error(chalk.red('\n❌ Setup failed:'), error.message)
    console.log(chalk.yellow('\nYour progress has been saved. Run the setup again to resume.'))
    process.exit(1)
  }
}

// Handle interrupts gracefully
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\n⚠️ Setup interrupted. Your progress has been saved.'))
  console.log('Run the setup again to resume from where you left off.')
  process.exit(0)
})

// Run setup
main()
