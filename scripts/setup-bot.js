#!/usr/bin/env node

import chalk from 'chalk'
import { exec } from 'child_process'
import fs from 'fs/promises'
import inquirer from 'inquirer'
import ora from 'ora'
import path from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'

const execAsync = promisify(exec)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

console.log(chalk.blue.bold('\n🚀 Telegram Bot on Cloudflare Workers - Setup Wizard\n'))

async function checkPrerequisites() {
  const spinner = ora('Checking prerequisites...').start()

  try {
    // Check Node.js version
    const nodeVersion = process.version
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1))
    if (majorVersion < 20) {
      spinner.fail(chalk.red(`Node.js 20+ required (found ${nodeVersion})`))
      process.exit(1)
    }

    // Check wrangler
    try {
      await execAsync('wrangler --version')
    } catch {
      spinner.fail(chalk.red('Wrangler CLI not found. Install with: npm install -g wrangler'))
      process.exit(1)
    }

    spinner.succeed(chalk.green('Prerequisites check passed'))
  } catch (error) {
    spinner.fail(chalk.red('Prerequisites check failed'))
    console.error(error)
    process.exit(1)
  }
}

async function setupBot() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'botToken',
      message: 'Enter your Telegram Bot Token (from @BotFather):',
      validate: input => input.length > 0 || 'Bot token is required'
    },
    {
      type: 'password',
      name: 'webhookSecret',
      message: 'Enter a webhook secret (or press Enter to generate):',
      default: () =>
        Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    },
    {
      type: 'input',
      name: 'botName',
      message: 'Enter your bot name:',
      default: 'my-telegram-bot'
    },
    {
      type: 'list',
      name: 'tier',
      message: 'Select your Cloudflare Workers plan:',
      choices: [
        { name: 'Free (10ms CPU limit)', value: 'free' },
        { name: 'Paid ($5/month, 30s CPU limit)', value: 'paid' }
      ]
    },
    {
      type: 'confirm',
      name: 'useAI',
      message: 'Do you want to enable AI features?',
      default: false
    }
  ])

  if (answers.useAI) {
    const aiAnswers = await inquirer.prompt([
      {
        type: 'list',
        name: 'aiProvider',
        message: 'Select AI provider:',
        choices: [
          { name: 'Google Gemini', value: 'google-ai' },
          { name: 'OpenAI', value: 'openai' },
          { name: 'xAI Grok', value: 'xai' },
          { name: 'DeepSeek', value: 'deepseek' },
          { name: 'Cloudflare AI', value: 'cloudflare-ai' }
        ]
      },
      {
        type: 'password',
        name: 'aiApiKey',
        message: 'Enter your AI API key:',
        validate: input => input.length > 0 || 'API key is required'
      }
    ])

    Object.assign(answers, aiAnswers)
  }

  return answers
}

async function createConfig(config) {
  const spinner = ora('Creating configuration files...').start()

  try {
    // Create .dev.vars
    let devVars = `TELEGRAM_BOT_TOKEN=${config.botToken}
TELEGRAM_WEBHOOK_SECRET=${config.webhookSecret}
TIER=${config.tier}
BOT_NAME="${config.botName}"
`

    if (config.useAI) {
      devVars += `AI_PROVIDER=${config.aiProvider}\n`

      switch (config.aiProvider) {
        case 'google-ai':
          devVars += `GEMINI_API_KEY=${config.aiApiKey}\n`
          break
        case 'openai':
          devVars += `OPENAI_API_KEY=${config.aiApiKey}\n`
          break
        case 'xai':
          devVars += `XAI_API_KEY=${config.aiApiKey}\n`
          break
        case 'deepseek':
          devVars += `DEEPSEEK_API_KEY=${config.aiApiKey}\n`
          break
        case 'cloudflare-ai':
          devVars += `CLOUDFLARE_AI_API_TOKEN=${config.aiApiKey}\n`
          break
      }
    }

    await fs.writeFile(path.join(process.cwd(), '.dev.vars'), devVars)

    // Update wrangler.toml
    const wranglerPath = path.join(process.cwd(), 'wrangler.toml')
    let wranglerConfig = await fs.readFile(wranglerPath, 'utf-8')
    wranglerConfig = wranglerConfig.replace('typescript-wireframe-platform', config.botName)
    await fs.writeFile(wranglerPath, wranglerConfig)

    spinner.succeed(chalk.green('Configuration files created'))
  } catch (error) {
    spinner.fail(chalk.red('Failed to create configuration'))
    throw error
  }
}

async function createResources() {
  const spinner = ora('Creating Cloudflare resources...').start()

  try {
    // Create D1 database
    spinner.text = 'Creating D1 database...'
    const dbResult = await execAsync('wrangler d1 create telegram-bot-db')
    console.log(chalk.gray(dbResult.stdout))

    // Create KV namespaces
    spinner.text = 'Creating KV namespaces...'
    const kvResults = await Promise.all([
      execAsync('wrangler kv:namespace create "KV_CACHE"'),
      execAsync('wrangler kv:namespace create "USER_SESSIONS"'),
      execAsync('wrangler kv:namespace create "STARS_STORE"')
    ])

    kvResults.forEach(result => console.log(chalk.gray(result.stdout)))

    spinner.succeed(chalk.green('Cloudflare resources created'))

    console.log(chalk.yellow('\n⚠️  Please update wrangler.toml with the IDs shown above'))
  } catch {
    spinner.fail(chalk.red('Failed to create resources'))
    console.log(chalk.yellow('You may need to create these manually'))
  }
}

async function deployBot() {
  const { deploy } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'deploy',
      message: 'Do you want to deploy the bot now?',
      default: true
    }
  ])

  if (!deploy) return

  const spinner = ora('Deploying bot to Cloudflare Workers...').start()

  try {
    const result = await execAsync('npm run deploy')
    console.log(chalk.gray(result.stdout))
    spinner.succeed(chalk.green('Bot deployed successfully!'))

    // Extract worker URL from output
    const urlMatch = result.stdout.match(/https:\/\/[^\s]+\.workers\.dev/)
    if (urlMatch) {
      return urlMatch[0]
    }
  } catch (error) {
    spinner.fail(chalk.red('Deployment failed'))
    throw error
  }
}

async function setWebhook(botToken, webhookSecret, workerUrl) {
  if (!workerUrl) return

  const spinner = ora('Setting webhook...').start()

  try {
    const webhookUrl = `${workerUrl}/webhook/${webhookSecret}`
    const apiUrl = `https://api.telegram.org/bot${botToken}/setWebhook`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret
      })
    })

    const result = await response.json()

    if (result.ok) {
      spinner.succeed(chalk.green('Webhook set successfully!'))
    } else {
      spinner.fail(chalk.red('Failed to set webhook'))
      console.log(result)
    }
  } catch (error) {
    spinner.fail(chalk.red('Failed to set webhook'))
    throw error
  }
}

async function main() {
  try {
    await checkPrerequisites()

    const config = await setupBot()
    await createConfig(config)
    await createResources()

    console.log(chalk.blue('\n📝 Next steps:'))
    console.log('1. Update wrangler.toml with the resource IDs')
    console.log('2. Run migrations: npm run db:apply:local')
    console.log('3. Test locally: npm run dev')

    const workerUrl = await deployBot()

    if (workerUrl) {
      await setWebhook(config.botToken, config.webhookSecret, workerUrl)

      console.log(chalk.green.bold('\n✅ Your bot is ready!'))
      console.log(chalk.blue(`\n🤖 Bot URL: ${workerUrl}`))
      console.log(chalk.blue(`📱 Open Telegram and search for your bot\n`))
    }
  } catch (error) {
    console.error(chalk.red('\n❌ Setup failed:'), error)
    process.exit(1)
  }
}

main()
