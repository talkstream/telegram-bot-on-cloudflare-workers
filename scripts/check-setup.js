#!/usr/bin/env node

/**
 * Setup Checker Script
 * Helps developers verify their wireframe configuration
 */

import { existsSync } from 'fs';
import { execSync } from 'child_process';

const REQUIRED_FILES = [
  {
    path: '.dev.vars',
    message: 'Local environment variables (copy from .dev.vars.example)',
  },
  {
    path: 'wrangler.toml',
    message: 'Wrangler configuration (copy from wrangler.toml.example)',
  },
];

const REQUIRED_COMMANDS = [
  { command: 'wrangler --version', name: 'Wrangler CLI' },
  { command: 'node --version', name: 'Node.js', minVersion: '20.0.0' },
];

let hasErrors = false;

console.log('🔍 Checking wireframe setup...\n');

// Check required files
console.log('📁 Checking required files:');
for (const file of REQUIRED_FILES) {
  if (existsSync(file.path)) {
    console.log(`  ✅ ${file.path} exists`);
  } else {
    console.log(`  ❌ ${file.path} missing - ${file.message}`);
    hasErrors = true;
  }
}

console.log('\n🛠️  Checking required tools:');
for (const tool of REQUIRED_COMMANDS) {
  try {
    const output = execSync(tool.command, { encoding: 'utf8' }).trim();
    console.log(`  ✅ ${tool.name}: ${output}`);

    if (tool.minVersion) {
      const version = output.match(/(\d+\.\d+\.\d+)/)?.[1];
      if (version && version < tool.minVersion) {
        console.log(
          `     ⚠️  Version ${version} is below minimum required ${tool.minVersion}`
        );
        hasErrors = true;
      }
    }
  } catch {
    console.log(`  ❌ ${tool.name} not found - Please install it`);
    hasErrors = true;
  }
}

// Check if npm packages are installed
console.log('\n📦 Checking npm packages:');
if (existsSync('node_modules')) {
  console.log('  ✅ node_modules exists');
} else {
  console.log('  ❌ node_modules missing - Run: npm install');
  hasErrors = true;
}

// Provide next steps
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('\n❌ Setup incomplete. Please fix the issues above.');
  console.log('\n📚 See SETUP.md for detailed instructions.');
  process.exit(1);
} else {
  console.log('\n✅ Setup looks good! You can now:');
  console.log('  1. Configure your bot token in .dev.vars');
  console.log('  2. Run: npm run dev');
  console.log('  3. Start building your bot! 🚀');
}
