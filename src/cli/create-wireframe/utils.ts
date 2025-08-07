/**
 * CLI utility functions
 */

import { execSync } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

import chalk from 'chalk'

import type { ProjectOptions } from './types.js'

/**
 * Validate project name
 */
export function validateProjectName(name: string): boolean | string {
  if (!name || name.trim() === '') {
    return 'Project name is required'
  }

  if (!/^[a-z0-9-_]+$/i.test(name)) {
    return 'Project name can only contain letters, numbers, dashes, and underscores'
  }

  if (name.length > 100) {
    return 'Project name is too long'
  }

  return true
}

/**
 * Copy directory recursively
 */
export async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true })

  const entries = await fs.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

/**
 * Replace placeholders in content
 */
export function replacePlaceholders(content: string, options: ProjectOptions): string {
  const replacements: Record<string, string> = {
    '{{PROJECT_NAME}}': options.name,
    '{{PLATFORM}}': options.platform,
    '{{CLOUD}}': options.cloud,
    '{{AI_PROVIDER}}': options.ai,
    '{{DESCRIPTION}}': `${options.platform} bot on ${options.cloud} with ${options.ai}`,
    '{{YEAR}}': new Date().getFullYear().toString()
  }

  let result = content
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(placeholder, 'g'), value)
  }

  return result
}

/**
 * Initialize git repository
 */
export async function initGit(projectPath: string): Promise<void> {
  try {
    execSync('git init', { cwd: projectPath, stdio: 'ignore' })

    // Create .gitignore
    const gitignore = `# Dependencies
node_modules/

# Environment
.env
.env.local
.env.*.local

# Build output
dist/
.wrangler/
*.cache
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output/

# Misc
*.backup
*.tmp
`

    await fs.writeFile(path.join(projectPath, '.gitignore'), gitignore)

    execSync('git add -A', { cwd: projectPath, stdio: 'ignore' })
    execSync('git commit -m "Initial commit from create-wireframe"', {
      cwd: projectPath,
      stdio: 'ignore'
    })
  } catch (_error) {
    console.warn(chalk.yellow('Warning: Failed to initialize git repository'))
  }
}

/**
 * Install dependencies
 */
export async function installDependencies(projectPath: string): Promise<void> {
  const packageManager = await detectPackageManager()
  const installCommand = packageManager === 'yarn' ? 'yarn' : 'npm install'

  execSync(installCommand, {
    cwd: projectPath,
    stdio: 'inherit'
  })
}

/**
 * Detect package manager
 */
async function detectPackageManager(): Promise<'npm' | 'yarn' | 'pnpm'> {
  try {
    execSync('yarn --version', { stdio: 'ignore' })
    return 'yarn'
  } catch {
    try {
      execSync('pnpm --version', { stdio: 'ignore' })
      return 'pnpm'
    } catch {
      return 'npm'
    }
  }
}

/**
 * Get template path
 */
export function getTemplatePath(platform: string, cloud: string): string {
  // Map to existing templates or create generic one
  const templateMap: Record<string, string> = {
    'telegram-cloudflare': 'telegram-cloudflare',
    'discord-cloudflare': 'generic',
    'slack-aws': 'generic',
    'whatsapp-gcp': 'generic'
  }

  const key = `${platform}-${cloud}`
  return templateMap[key] || 'generic'
}

/**
 * Generate environment template
 */
export function generateEnvTemplate(options: ProjectOptions): string {
  const lines: string[] = ['# Environment Configuration', '']

  // Platform-specific
  switch (options.platform) {
    case 'telegram':
      lines.push('# Telegram Configuration')
      lines.push('BOT_TOKEN=your_telegram_bot_token')
      lines.push('WEBHOOK_SECRET=generate_random_secret')
      break
    case 'discord':
      lines.push('# Discord Configuration')
      lines.push('DISCORD_APPLICATION_ID=your_application_id')
      lines.push('DISCORD_PUBLIC_KEY=your_public_key')
      lines.push('DISCORD_BOT_TOKEN=your_bot_token')
      break
    case 'slack':
      lines.push('# Slack Configuration')
      lines.push('SLACK_BOT_TOKEN=xoxb-your-token')
      lines.push('SLACK_SIGNING_SECRET=your_signing_secret')
      break
    case 'whatsapp':
      lines.push('# WhatsApp Configuration')
      lines.push('WHATSAPP_ACCESS_TOKEN=your_access_token')
      lines.push('WHATSAPP_VERIFY_TOKEN=your_verify_token')
      break
  }

  lines.push('')

  // Cloud-specific
  switch (options.cloud) {
    case 'cloudflare':
      lines.push('# Cloudflare Configuration')
      lines.push('# Set these in wrangler.toml or via dashboard')
      break
    case 'aws':
      lines.push('# AWS Configuration')
      lines.push('AWS_REGION=us-east-1')
      lines.push('AWS_ACCESS_KEY_ID=your_access_key')
      lines.push('AWS_SECRET_ACCESS_KEY=your_secret_key')
      break
    case 'gcp':
      lines.push('# GCP Configuration')
      lines.push('GCP_PROJECT_ID=your_project_id')
      lines.push('GOOGLE_APPLICATION_CREDENTIALS=./service-account.json')
      break
    case 'azure':
      lines.push('# Azure Configuration')
      lines.push('AZURE_SUBSCRIPTION_ID=your_subscription_id')
      lines.push('AZURE_TENANT_ID=your_tenant_id')
      break
  }

  lines.push('')

  // AI-specific
  switch (options.ai) {
    case 'openai':
      lines.push('# OpenAI Configuration')
      lines.push('OPENAI_API_KEY=sk-your-api-key')
      break
    case 'anthropic':
      lines.push('# Anthropic Configuration')
      lines.push('ANTHROPIC_API_KEY=your-api-key')
      break
    case 'google':
      lines.push('# Google AI Configuration')
      lines.push('GOOGLE_AI_API_KEY=your-api-key')
      break
    case 'local':
      lines.push('# Local AI Configuration')
      lines.push('OLLAMA_HOST=http://localhost:11434')
      break
    case 'multi':
      lines.push('# AI Providers Configuration')
      lines.push('OPENAI_API_KEY=sk-your-api-key')
      lines.push('ANTHROPIC_API_KEY=your-api-key')
      lines.push('GOOGLE_AI_API_KEY=your-api-key')
      break
  }

  // Features
  if (options.features.includes('database')) {
    lines.push('')
    lines.push('# Database Configuration')
    lines.push('DATABASE_URL=your_database_url')
  }

  if (options.features.includes('monitoring')) {
    lines.push('')
    lines.push('# Monitoring Configuration')
    lines.push('SENTRY_DSN=your_sentry_dsn')
  }

  lines.push('')
  lines.push('# General Configuration')
  lines.push('NODE_ENV=development')
  lines.push('LOG_LEVEL=info')

  return lines.join('\n')
}
