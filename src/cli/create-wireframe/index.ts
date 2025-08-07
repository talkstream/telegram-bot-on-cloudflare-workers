#!/usr/bin/env node

import fs from 'fs/promises'
import path from 'path'

import chalk from 'chalk'
import { Command } from 'commander'
import inquirer from 'inquirer'
import ora from 'ora'

import { createProject } from './create-project.js'
import type { ProjectOptions } from './types.js'
import { validateProjectName } from './utils.js'

const program = new Command()

program
  .name('create-wireframe')
  .description('Create a new Wireframe bot project')
  .version('1.0.0')
  .argument('[project-name]', 'Name of your project')
  .option('-t, --template <template>', 'Project template', 'telegram-cloudflare')
  .option('-p, --platform <platform>', 'Messaging platform (telegram, discord, slack)')
  .option('-c, --cloud <cloud>', 'Cloud platform (cloudflare, aws, gcp, azure)')
  .option('-a, --ai <ai>', 'AI provider (openai, anthropic, google, local)')
  .option('--no-git', 'Skip git initialization')
  .option('--no-install', 'Skip dependency installation')
  .option('-y, --yes', 'Skip interactive prompts')
  .action(async (projectName, options) => {
    console.info(chalk.bold.cyan('\n🚀 Wireframe Bot Creator\n'))

    let config: ProjectOptions

    if (options.yes && projectName) {
      // Non-interactive mode
      config = {
        name: projectName,
        platform: options.platform || 'telegram',
        cloud: options.cloud || 'cloudflare',
        ai: options.ai || 'openai',
        features: [],
        git: options.git !== false,
        install: options.install !== false
      }
    } else {
      // Interactive mode
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Project name:',
          default: projectName || 'my-wireframe-bot',
          validate: validateProjectName
        },
        {
          type: 'list',
          name: 'platform',
          message: 'Choose messaging platform:',
          choices: [
            { name: '📱 Telegram', value: 'telegram' },
            { name: '🎮 Discord', value: 'discord' },
            { name: '💼 Slack', value: 'slack' },
            { name: '💬 WhatsApp', value: 'whatsapp' }
          ],
          default: options.platform || 'telegram'
        },
        {
          type: 'list',
          name: 'cloud',
          message: 'Choose cloud platform:',
          choices: [
            { name: '☁️ Cloudflare Workers', value: 'cloudflare' },
            { name: '🔶 AWS Lambda', value: 'aws' },
            { name: '🔷 Google Cloud Functions', value: 'gcp' },
            { name: '🔵 Azure Functions', value: 'azure' }
          ],
          default: options.cloud || 'cloudflare'
        },
        {
          type: 'list',
          name: 'ai',
          message: 'Choose AI provider:',
          choices: [
            { name: '🤖 OpenAI (GPT-4)', value: 'openai' },
            { name: '🧠 Anthropic (Claude)', value: 'anthropic' },
            { name: '🌟 Google (Gemini)', value: 'google' },
            { name: '💻 Local Models (Ollama)', value: 'local' },
            { name: '🎯 Multiple Providers', value: 'multi' }
          ],
          default: options.ai || 'openai'
        },
        {
          type: 'checkbox',
          name: 'features',
          message: 'Select additional features:',
          choices: [
            { name: '💾 Database (Sessions, User data)', value: 'database' },
            { name: '💳 Payments', value: 'payments' },
            { name: '📊 Analytics', value: 'analytics' },
            { name: '🌍 Internationalization (i18n)', value: 'i18n' },
            { name: '🔌 Plugin System', value: 'plugins' },
            { name: '🎨 Admin Panel', value: 'admin' },
            { name: '📝 Logging & Monitoring', value: 'monitoring' },
            { name: '🧪 Testing Setup', value: 'testing' }
          ],
          default: ['database', 'i18n', 'monitoring', 'testing']
        },
        {
          type: 'confirm',
          name: 'typescript',
          message: 'Use TypeScript strict mode?',
          default: true
        },
        {
          type: 'confirm',
          name: 'git',
          message: 'Initialize git repository?',
          default: options.git !== false
        },
        {
          type: 'confirm',
          name: 'install',
          message: 'Install dependencies?',
          default: options.install !== false
        }
      ])

      config = answers
    }

    // Create project
    const spinner = ora('Creating project...').start()

    try {
      const projectPath = path.join(process.cwd(), config.name)

      // Check if directory exists
      try {
        await fs.access(projectPath)
        spinner.fail(`Directory ${config.name} already exists`)
        process.exit(1)
      } catch {
        // Directory doesn't exist, continue
      }

      // Create project
      await createProject(projectPath, config)

      spinner.succeed('Project created successfully!')

      console.info(`
${chalk.bold.green('✨ Success!')} Created ${chalk.cyan(config.name)} at ${chalk.gray(projectPath)}

${chalk.bold('Next steps:')}
  ${chalk.cyan(`cd ${config.name}`)}
  ${!config.install ? chalk.cyan('npm install') : ''}
  ${chalk.cyan('npm run dev')}

${chalk.bold('Available commands:')}
  ${chalk.gray('npm run')} ${chalk.cyan('dev')}         Start development server
  ${chalk.gray('npm run')} ${chalk.cyan('deploy')}      Deploy to ${config.cloud}
  ${chalk.gray('npm run')} ${chalk.cyan('test')}        Run tests
  ${chalk.gray('npm run')} ${chalk.cyan('typecheck')}   Check TypeScript

${chalk.bold('Configuration:')}
  Platform: ${chalk.cyan(config.platform)}
  Cloud: ${chalk.cyan(config.cloud)}
  AI: ${chalk.cyan(config.ai)}
  Features: ${chalk.cyan(config.features.join(', ') || 'none')}

${chalk.bold('Resources:')}
  📚 Documentation: ${chalk.cyan('https://github.com/talkstream/typescript-wireframe-platform')}
  💬 Discord: ${chalk.cyan('https://discord.gg/wireframe')}
  🐛 Issues: ${chalk.cyan('https://github.com/talkstream/typescript-wireframe-platform/issues')}

${chalk.yellow.bold('Happy coding! 🚀')}
`)
    } catch (error) {
      spinner.fail('Failed to create project')
      console.error(error)
      process.exit(1)
    }
  })

program.parse()
