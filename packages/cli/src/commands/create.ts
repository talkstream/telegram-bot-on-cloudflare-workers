import path from 'path'

import chalk from 'chalk'
import { Command } from 'commander'
import fs from 'fs-extra'
import ora from 'ora'
import prompts from 'prompts'
// Using ES modules - no need for __dirname

export const createCommand = new Command('create')
  .description('Create a new Wireframe bot')
  .argument('[name]', 'Bot name')
  .option('-t, --template <template>', 'Template to use', 'basic')
  .option('--no-install', 'Skip npm install')
  .action(async (name, options) => {
    console.info(chalk.blue('\n🚀 Welcome to Wireframe!\n'))

    // Get bot name if not provided
    if (!name) {
      const response = await prompts({
        type: 'text',
        name: 'name',
        message: 'What is your bot name?',
        initial: 'my-bot',
        validate: value => {
          if (!value) return 'Bot name is required'
          if (!/^[a-z0-9-]+$/.test(value)) {
            return 'Bot name must be lowercase with hyphens only'
          }
          return true
        }
      })
      name = response.name
    }

    // Check if directory exists
    const targetDir = path.resolve(process.cwd(), name)
    if (fs.existsSync(targetDir)) {
      console.error(chalk.red(`Error: Directory ${name} already exists`))
      process.exit(1)
    }

    // Get configuration
    const config = await prompts([
      {
        type: 'select',
        name: 'messaging',
        message: 'Select messaging platform:',
        choices: [
          { title: 'Telegram', value: 'telegram' },
          { title: 'Discord', value: 'discord' },
          { title: 'Slack', value: 'slack' },
          { title: 'None', value: null }
        ]
      },
      {
        type: 'select',
        name: 'ai',
        message: 'Select AI provider:',
        choices: [
          { title: 'OpenAI', value: 'openai' },
          { title: 'Anthropic Claude', value: 'anthropic' },
          { title: 'Google Gemini', value: 'gemini' },
          { title: 'None', value: null }
        ]
      },
      {
        type: 'select',
        name: 'cloud',
        message: 'Select cloud platform:',
        choices: [
          { title: 'Cloudflare Workers', value: 'cloudflare' },
          { title: 'AWS Lambda', value: 'aws' },
          { title: 'Vercel', value: 'vercel' },
          { title: 'None', value: null }
        ]
      },
      {
        type: 'confirm',
        name: 'typescript',
        message: 'Use TypeScript?',
        initial: true
      }
    ])

    // Create project
    const spinner = ora('Creating bot...').start()

    try {
      // Create directory
      await fs.ensureDir(targetDir)

      // Create package.json
      const packageJson = {
        name,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'wireframe dev',
          build: 'wireframe build',
          start: 'wireframe start',
          deploy: 'wireframe deploy'
        },
        dependencies: {
          '@wireframe/core': '^2.0.0-alpha'
        },
        devDependencies: config.typescript
          ? {
              typescript: '^5.3.3',
              '@types/node': '^20.11.5'
            }
          : {}
      }

      // Add connector dependencies
      if (config.messaging) {
        ;(packageJson.dependencies as Record<string, string>)[`@wireframe/connector-${config.messaging}`] =
          '^2.0.0-alpha'
      }
      if (config.ai) {
        ;(packageJson.dependencies as Record<string, string>)[`@wireframe/connector-${config.ai}`] = '^2.0.0-alpha'
      }
      if (config.cloud) {
        ;(packageJson.dependencies as Record<string, string>)[`@wireframe/connector-${config.cloud}`] = '^2.0.0-alpha'
      }

      await fs.writeJson(path.join(targetDir, 'package.json'), packageJson, { spaces: 2 })

      // Create wireframe.config.ts/js
      const configFile = config.typescript ? 'wireframe.config.ts' : 'wireframe.config.js'
      const configContent = `${config.typescript ? "import { defineConfig } from '@wireframe/core'\n\n" : "const { defineConfig } = require('@wireframe/core')\n\n"}export default defineConfig({
  connectors: [${[config.messaging, config.ai, config.cloud]
    .filter(Boolean)
    .map(c => `'${c}'`)
    .join(', ')}],
  config: {${
    config.messaging
      ? `
    ${config.messaging}: {
      token: process.env.BOT_TOKEN
    },`
      : ''
  }${
    config.ai
      ? `
    ${config.ai}: {
      apiKey: process.env.${config.ai.toUpperCase()}_API_KEY
    },`
      : ''
  }${
    config.cloud
      ? `
    ${config.cloud}: {
      // Cloud configuration
    }`
      : ''
  }
  }
})`

      await fs.writeFile(path.join(targetDir, configFile), configContent)

      // Create main bot file
      const botFile = config.typescript ? 'src/index.ts' : 'src/index.js'
      const botContent = `${config.typescript ? "import { Wireframe } from '@wireframe/core'\n" : "const { Wireframe } = require('@wireframe/core')\n"}
const bot = await Wireframe.create()

bot.on('message', async (message) => {
  ${
    config.ai
      ? `const response = await bot.ai.complete(message.text)
  await message.reply(response)`
      : `await message.reply('Hello from Wireframe!')`
  }
})

await bot.start()
console.log('✨ Bot is running!')`

      await fs.ensureDir(path.join(targetDir, 'src'))
      await fs.writeFile(path.join(targetDir, botFile), botContent)

      // Create .env.example
      const envContent = `# Messaging
${config.messaging === 'telegram' ? 'BOT_TOKEN=your-telegram-bot-token' : ''}
${config.messaging === 'discord' ? 'DISCORD_TOKEN=your-discord-token' : ''}
${config.messaging === 'slack' ? 'SLACK_TOKEN=your-slack-token' : ''}

# AI Provider
${config.ai === 'openai' ? 'OPENAI_API_KEY=your-openai-key' : ''}
${config.ai === 'anthropic' ? 'ANTHROPIC_API_KEY=your-anthropic-key' : ''}
${config.ai === 'gemini' ? 'GEMINI_API_KEY=your-gemini-key' : ''}`

      await fs.writeFile(path.join(targetDir, '.env.example'), envContent.trim())

      // Create README
      const readmeContent = `# ${name}

A Wireframe AI Assistant bot.

## Setup

1. Copy \`.env.example\` to \`.env\` and fill in your credentials
2. Run \`npm install\`
3. Run \`npm run dev\` to start development

## Commands

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run start\` - Start production server
- \`npm run deploy\` - Deploy to cloud

## Learn More

- [Wireframe Documentation](https://docs.wireframe.dev)
- [Examples](https://github.com/wireframe/examples)`

      await fs.writeFile(path.join(targetDir, 'README.md'), readmeContent)

      // Create tsconfig if TypeScript
      if (config.typescript) {
        const tsConfig = {
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            lib: ['ES2022'],
            moduleResolution: 'node',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            resolveJsonModule: true,
            allowJs: true,
            outDir: './dist',
            rootDir: './src'
          },
          include: ['src/**/*'],
          exclude: ['node_modules', 'dist']
        }
        await fs.writeJson(path.join(targetDir, 'tsconfig.json'), tsConfig, { spaces: 2 })
      }

      spinner.succeed('Bot created successfully!')

      // Install dependencies
      if (options.install !== false) {
        console.info('\n📦 Installing dependencies...\n')
        const { execSync } = await import('child_process')
        execSync('npm install', { cwd: targetDir, stdio: 'inherit' })
      }

      // Success message
      console.info(chalk.green('\n✨ Your bot is ready!\n'))
      console.info('Next steps:')
      console.info(chalk.cyan(`  cd ${name}`))
      if (options.install === false) {
        console.info(chalk.cyan('  npm install'))
      }
      console.info(chalk.cyan('  npm run dev'))
      console.info('\nHappy building! 🚀\n')
    } catch (error) {
      spinner.fail('Failed to create bot')
      console.error(error)
      process.exit(1)
    }
  })
