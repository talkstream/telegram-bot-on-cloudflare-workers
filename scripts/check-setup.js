#!/usr/bin/env node

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

console.log('🔍 Checking your Telegram Bot Cloudflare Workers setup...\n')

let hasErrors = false

// Check Node.js version
try {
  const nodeVersion = process.version
  const major = parseInt(nodeVersion.split('.')[0].substring(1))
  if (major < 20) {
    console.error('❌ Node.js version 20+ required. Current:', nodeVersion)
    hasErrors = true
  } else {
    console.log('✅ Node.js version:', nodeVersion)
  }
} catch {
  console.error('❌ Could not check Node.js version')
  hasErrors = true
}

// Check npm version
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim()
  const major = parseInt(npmVersion.split('.')[0])
  if (major < 10) {
    console.error('❌ npm version 10+ required. Current:', npmVersion)
    hasErrors = true
  } else {
    console.log('✅ npm version:', npmVersion)
  }
} catch {
  console.error('❌ npm not found')
  hasErrors = true
}

// Check Wrangler installation
try {
  const wranglerVersion = execSync('wrangler --version', {
    encoding: 'utf8'
  }).trim()
  console.log('✅ Wrangler:', wranglerVersion)
} catch {
  console.error('❌ Wrangler not installed. Run: npm install -g wrangler')
  hasErrors = true
}

// Check required files
const requiredFiles = [
  '.dev.vars.example',
  'wrangler.toml.example',
  'package.json',
  'tsconfig.json',
  'vitest.config.ts',
  'eslint.config.js'
]

console.log('\n📁 Checking required files...')
requiredFiles.forEach(file => {
  if (fs.existsSync(path.join(process.cwd(), file))) {
    console.log(`✅ ${file}`)
  } else {
    console.error(`❌ Missing: ${file}`)
    hasErrors = true
  }
})

// Check if config files are set up
console.log('\n⚙️  Checking configuration...')

if (fs.existsSync('.dev.vars')) {
  console.log('✅ .dev.vars exists')
} else {
  console.log('⚠️  .dev.vars not found - copy from .dev.vars.example')
}

if (fs.existsSync('wrangler.toml')) {
  console.log('✅ wrangler.toml exists')
} else {
  console.log('⚠️  wrangler.toml not found - copy from wrangler.toml.example')
}

// Check dependencies
console.log('\n📦 Checking dependencies...')
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const deps = Object.keys(pkg.dependencies || {})
  const devDeps = Object.keys(pkg.devDependencies || {})

  const requiredDeps = ['grammy', 'hono', 'zod', '@google/genai']
  const requiredDevDeps = ['typescript', 'vitest', 'wrangler', '@cloudflare/workers-types']

  requiredDeps.forEach(dep => {
    if (deps.includes(dep)) {
      console.log(`✅ ${dep}`)
    } else {
      console.error(`❌ Missing dependency: ${dep}`)
      hasErrors = true
    }
  })

  requiredDevDeps.forEach(dep => {
    if (devDeps.includes(dep)) {
      console.log(`✅ ${dep} (dev)`)
    } else {
      console.error(`❌ Missing dev dependency: ${dep}`)
      hasErrors = true
    }
  })
} catch {
  console.error('❌ Could not read package.json')
  hasErrors = true
}

// Final report
console.log('\n' + '='.repeat(50))
if (hasErrors) {
  console.log('\n❌ Setup incomplete. Please fix the issues above.')
  console.log('\nNext steps:')
  console.log('1. Fix any missing dependencies or files')
  console.log('2. Copy .dev.vars.example to .dev.vars')
  console.log('3. Copy wrangler.toml.example to wrangler.toml')
  console.log('4. Fill in your configuration values')
  console.log('5. Run npm install')
  process.exit(1)
} else {
  console.log('\n✅ Setup looks good!')
  console.log('\nNext steps:')
  console.log('1. Copy and configure .dev.vars if not done')
  console.log('2. Copy and configure wrangler.toml if not done')
  console.log('3. Create D1 database: wrangler d1 create your-bot-db')
  console.log('4. Create KV namespaces: wrangler kv:namespace create CACHE')
  console.log('5. Run migrations: npm run db:apply:local')
  console.log('6. Start development: npm run dev')
}
