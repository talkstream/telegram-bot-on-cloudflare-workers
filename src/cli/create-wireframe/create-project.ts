/**
 * Project creation logic
 */

import fs from 'fs/promises'
import path from 'path'

import chalk from 'chalk'

import { generateProjectFiles } from './templates/index.js'
import type { PackageJson, ProjectOptions } from './types.js'
import { generateEnvTemplate, initGit, installDependencies } from './utils.js'

/**
 * Create a new Wireframe project
 */
export async function createProject(projectPath: string, options: ProjectOptions): Promise<void> {
  // Create project directory
  await fs.mkdir(projectPath, { recursive: true })

  // Generate base files
  await createBaseStructure(projectPath, options)

  // Generate platform-specific files
  await generatePlatformFiles(projectPath, options)

  // Generate cloud-specific files
  await generateCloudFiles(projectPath, options)

  // Generate feature files
  await generateFeatureFiles(projectPath, options)

  // Create package.json
  await createPackageJson(projectPath, options)

  // Create configuration files
  await createConfigFiles(projectPath, options)

  // Initialize git
  if (options.git) {
    await initGit(projectPath)
  }

  // Install dependencies
  if (options.install) {
    console.info(chalk.cyan('\nInstalling dependencies...'))
    await installDependencies(projectPath)
  }
}

/**
 * Create base project structure
 */
async function createBaseStructure(projectPath: string, options: ProjectOptions): Promise<void> {
  const dirs = [
    'src',
    'src/commands',
    'src/handlers',
    'src/services',
    'src/utils',
    'src/types',
    'tests',
    'docs'
  ]

  for (const dir of dirs) {
    await fs.mkdir(path.join(projectPath, dir), { recursive: true })
  }

  // Create base files
  const files = generateProjectFiles(options)

  for (const file of files) {
    const filePath = path.join(projectPath, file.path)
    const dir = path.dirname(filePath)

    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(filePath, file.content)
  }
}

/**
 * Generate platform-specific files
 */
async function generatePlatformFiles(projectPath: string, options: ProjectOptions): Promise<void> {
  const platformDir = path.join(projectPath, 'src', 'platform')
  await fs.mkdir(platformDir, { recursive: true })

  // Platform-specific connector setup
  const connectorContent = generatePlatformConnector(options.platform)
  await fs.writeFile(path.join(platformDir, 'connector.ts'), connectorContent)
}

/**
 * Generate cloud-specific files
 */
async function generateCloudFiles(projectPath: string, options: ProjectOptions): Promise<void> {
  const cloudDir = path.join(projectPath, 'src', 'cloud')
  await fs.mkdir(cloudDir, { recursive: true })

  // Cloud-specific setup
  const cloudContent = generateCloudSetup(options.cloud)
  await fs.writeFile(path.join(cloudDir, 'setup.ts'), cloudContent)

  // Deployment configuration
  await createDeploymentConfig(projectPath, options)
}

/**
 * Generate feature files
 */
async function generateFeatureFiles(projectPath: string, options: ProjectOptions): Promise<void> {
  for (const feature of options.features) {
    const featureDir = path.join(projectPath, 'src', 'features', feature)
    await fs.mkdir(featureDir, { recursive: true })

    // Create feature index
    await fs.writeFile(
      path.join(featureDir, 'index.ts'),
      `// ${feature} feature\nexport * from './${feature}.js';\n`
    )
  }
}

/**
 * Create package.json
 */
async function createPackageJson(projectPath: string, options: ProjectOptions): Promise<void> {
  const packageJson: PackageJson = {
    name: options.name,
    version: '0.1.0',
    description: `${options.platform} bot on ${options.cloud} using Wireframe`,
    type: 'module',
    main: './dist/index.js',
    scripts: {
      dev: getDevScript(options.cloud),
      build: 'tsc',
      deploy: getDeployScript(options.cloud),
      test: 'vitest',
      'test:coverage': 'vitest run --coverage',
      typecheck: 'tsc --noEmit',
      lint: 'eslint .',
      'lint:fix': 'eslint . --fix',
      format: 'prettier --write "**/*.{js,ts,json,md}"'
    },
    dependencies: getDependencies(options),
    devDependencies: getDevDependencies(options),
    engines: {
      node: '>=20.0.0',
      npm: '>=10.0.0'
    }
  }

  await fs.writeFile(path.join(projectPath, 'package.json'), JSON.stringify(packageJson, null, 2))
}

/**
 * Create configuration files
 */
async function createConfigFiles(projectPath: string, options: ProjectOptions): Promise<void> {
  // TypeScript config
  const tsConfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ES2022',
      lib: ['ES2022'],
      moduleResolution: 'bundler',
      rootDir: './src',
      outDir: './dist',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      allowImportingTsExtensions: true,
      noEmit: true,
      paths: {
        '@/*': ['./src/*']
      }
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist']
  }

  await fs.writeFile(path.join(projectPath, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2))

  // ESLint config
  const eslintConfig = `export default {
  root: true,
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  plugins: ['@typescript-eslint'],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
  },
};`

  await fs.writeFile(path.join(projectPath, 'eslint.config.js'), eslintConfig)

  // Prettier config
  const prettierConfig = {
    semi: true,
    trailingComma: 'es5',
    singleQuote: true,
    printWidth: 100,
    tabWidth: 2
  }

  await fs.writeFile(path.join(projectPath, '.prettierrc'), JSON.stringify(prettierConfig, null, 2))

  // Environment template
  const envTemplate = generateEnvTemplate(options)
  await fs.writeFile(path.join(projectPath, '.env.example'), envTemplate)
}

/**
 * Generate platform connector code
 */
function generatePlatformConnector(platform: string): string {
  return `import { ${platform}Connector } from '@wireframe/connectors';
import { EventBus } from '@wireframe/core';

export async function setupPlatform(eventBus: EventBus) {
  const connector = new ${platform}Connector();
  
  await connector.initialize({
    // Platform-specific configuration
    eventBus,
  });

  return connector;
}
`
}

/**
 * Generate cloud setup code
 */
function generateCloudSetup(cloud: string): string {
  return `import { ${cloud}Connector } from '@wireframe/connectors';

export async function setupCloud() {
  const cloud = new ${cloud}Connector({
    env: process.env,
  });

  return cloud;
}
`
}

/**
 * Get development script
 */
function getDevScript(cloud: string): string {
  switch (cloud) {
    case 'cloudflare':
      return 'wrangler dev'
    case 'aws':
      return 'sam local start-api'
    case 'gcp':
      return 'functions-framework --target=handler'
    case 'azure':
      return 'func start'
    default:
      return 'tsx watch src/index.ts'
  }
}

/**
 * Get deployment script
 */
function getDeployScript(cloud: string): string {
  switch (cloud) {
    case 'cloudflare':
      return 'wrangler deploy'
    case 'aws':
      return 'sam deploy'
    case 'gcp':
      return 'gcloud functions deploy'
    case 'azure':
      return 'func azure functionapp publish'
    default:
      return 'echo "Configure deployment for ${cloud}"'
  }
}

/**
 * Get dependencies
 */
function getDependencies(options: ProjectOptions): Record<string, string> {
  const deps: Record<string, string> = {
    '@wireframe/core': '^1.3.0',
    '@wireframe/connectors': '^1.3.0'
  }

  // Platform-specific
  switch (options.platform) {
    case 'telegram':
      deps['grammy'] = '^1.31.0'
      break
    case 'discord':
      deps['discord.js'] = '^14.16.0'
      break
    case 'slack':
      deps['@slack/bolt'] = '^4.0.0'
      break
  }

  // AI-specific
  switch (options.ai) {
    case 'openai':
      deps['openai'] = '^4.77.0'
      break
    case 'anthropic':
      deps['@anthropic-ai/sdk'] = '^1.0.0'
      break
    case 'google':
      deps['@google/genai'] = '^1.12.0'
      break
  }

  // Feature-specific
  if (options.features.includes('database')) {
    deps['drizzle-orm'] = '^0.36.0'
  }

  if (options.features.includes('i18n')) {
    deps['i18next'] = '^25.0.0'
  }

  return deps
}

/**
 * Get dev dependencies
 */
function getDevDependencies(options: ProjectOptions): Record<string, string> {
  const devDeps: Record<string, string> = {
    typescript: '^5.7.0',
    '@types/node': '^22.10.0',
    vitest: '^3.0.0',
    '@vitest/coverage-v8': '^3.0.0',
    eslint: '^9.0.0',
    '@typescript-eslint/eslint-plugin': '^8.0.0',
    '@typescript-eslint/parser': '^8.0.0',
    prettier: '^3.4.0',
    'eslint-config-prettier': '^10.0.0'
  }

  // Cloud-specific
  switch (options.cloud) {
    case 'cloudflare':
      devDeps['wrangler'] = '^4.0.0'
      devDeps['@cloudflare/workers-types'] = '^5.0.0'
      break
    case 'aws':
      devDeps['@types/aws-lambda'] = '^8.10.0'
      devDeps['aws-sam-cli'] = '^1.0.0'
      break
  }

  return devDeps
}

/**
 * Create deployment configuration
 */
async function createDeploymentConfig(projectPath: string, options: ProjectOptions): Promise<void> {
  switch (options.cloud) {
    case 'cloudflare': {
      const wranglerConfig = `name = "${options.name}"
main = "src/index.ts"
compatibility_date = "${new Date().toISOString().split('T')[0]}"

[env.production]
vars = { ENVIRONMENT = "production" }

[[kv_namespaces]]
binding = "KV"
id = "your_kv_namespace_id"

[[d1_databases]]
binding = "DB"
database_name = "${options.name}-db"
database_id = "your_database_id"
`
      await fs.writeFile(path.join(projectPath, 'wrangler.toml'), wranglerConfig)
      break
    }

    case 'aws': {
      const samTemplate = {
        AWSTemplateFormatVersion: '2010-09-09',
        Transform: 'AWS::Serverless-2016-10-31',
        Resources: {
          BotFunction: {
            Type: 'AWS::Serverless::Function',
            Properties: {
              CodeUri: 'dist/',
              Handler: 'index.handler',
              Runtime: 'nodejs20.x',
              Events: {
                Api: {
                  Type: 'Api',
                  Properties: {
                    Path: '/webhook',
                    Method: 'POST'
                  }
                }
              }
            }
          }
        }
      }
      await fs.writeFile(
        path.join(projectPath, 'template.yaml'),
        JSON.stringify(samTemplate, null, 2)
      )
      break
    }
  }
}
