/**
 * Project templates
 */

import type { FileTemplate, ProjectOptions } from '../types.js'

export function generateProjectFiles(options: ProjectOptions): FileTemplate[] {
  const files: FileTemplate[] = [
    // Main entry point
    {
      path: 'src/index.ts',
      content: generateIndexFile(options)
    },
    // Bot setup
    {
      path: 'src/bot.ts',
      content: generateBotFile(options)
    },
    // Commands
    {
      path: 'src/commands/start.ts',
      content: generateStartCommand(options)
    },
    {
      path: 'src/commands/help.ts',
      content: generateHelpCommand(options)
    },
    // README
    {
      path: 'README.md',
      content: generateReadme(options)
    },
    // Tests
    {
      path: 'tests/bot.test.ts',
      content: generateTestFile(options)
    }
  ]

  // Add feature-specific files
  if (options.features.includes('database')) {
    files.push({
      path: 'src/services/database.ts',
      content: generateDatabaseService(options)
    })
  }

  if (options.features.includes('i18n')) {
    files.push({
      path: 'src/services/i18n.ts',
      content: generateI18nService(options)
    })
  }

  return files
}

function generateIndexFile(options: ProjectOptions): string {
  return `/**
 * ${options.name} - Entry Point
 * Platform: ${options.platform}
 * Cloud: ${options.cloud}
 */

import { setupBot } from './bot.js';
import { setupCloud } from './cloud/setup.js';
import { logger } from '@wireframe/core';

// Cloud-specific handler
${getCloudHandler(options.cloud)}

async function initialize() {
  try {
    const cloud = await setupCloud();
    const bot = await setupBot(cloud);
    
    logger.info('Bot initialized successfully', {
      platform: '${options.platform}',
      cloud: '${options.cloud}',
    });
    
    return { bot, cloud };
  } catch (error) {
    logger.error('Failed to initialize bot', { error });
    throw error;
  }
}

// Initialize on startup
const app = await initialize();
export { app };
`
}

function generateBotFile(options: ProjectOptions): string {
  return `/**
 * Bot Setup and Configuration
 */

import { EventBus } from '@wireframe/core';
import { setupPlatform } from './platform/connector.js';
import { registerCommands } from './commands/index.js';
${options.features.includes('database') ? "import { setupDatabase } from './services/database.js';" : ''}
${options.features.includes('i18n') ? "import { setupI18n } from './services/i18n.js';" : ''}

export async function setupBot(cloud: any) {
  // Create event bus
  const eventBus = new EventBus();

  // Setup platform connector
  const platform = await setupPlatform(eventBus);

  // Setup services
  ${options.features.includes('database') ? 'await setupDatabase(cloud);' : ''}
  ${options.features.includes('i18n') ? 'await setupI18n();' : ''}

  // Register commands
  await registerCommands(platform);

  // Setup event handlers
  eventBus.on('message.received', async (event) => {
    // Handle incoming messages
    console.log('Message received:', event.payload);
  });

  eventBus.on('error', (event) => {
    console.error('Error:', event.payload);
  });

  return {
    platform,
    eventBus,
  };
}
`
}

function generateStartCommand(options: ProjectOptions): string {
  return `/**
 * Start Command Handler
 */

export const startCommand = {
  command: 'start',
  description: 'Start the bot',
  handler: async (ctx: any) => {
    const message = \`Welcome to ${options.name}! 🚀

I'm a bot running on ${options.platform} powered by ${options.ai}.

Type /help to see available commands.\`;

    await ctx.reply(message);
  },
};
`
}

function generateHelpCommand(_options: ProjectOptions): string {
  return `/**
 * Help Command Handler
 */

export const helpCommand = {
  command: 'help',
  description: 'Show help message',
  handler: async (ctx: any) => {
    const commands = [
      '/start - Start the bot',
      '/help - Show this message',
      // Add more commands here
    ];

    const message = \`Available commands:\\n\\n\${commands.join('\\n')}\`;
    await ctx.reply(message);
  },
};
`
}

function generateReadme(options: ProjectOptions): string {
  return `# ${options.name}

A ${options.platform} bot running on ${options.cloud} using the Wireframe platform.

## Features

- 🤖 AI-powered responses using ${options.ai}
- ☁️ Deployed on ${options.cloud}
- 🚀 Built with TypeScript and Wireframe
${options.features.map(f => `- ✅ ${getFeatureName(f)}`).join('\n')}

## Setup

1. Clone this repository
2. Copy \`.env.example\` to \`.env\` and fill in your credentials
3. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

## Development

Start the development server:
\`\`\`bash
npm run dev
\`\`\`

## Testing

Run tests:
\`\`\`bash
npm test
\`\`\`

## Deployment

Deploy to ${options.cloud}:
\`\`\`bash
npm run deploy
\`\`\`

## Project Structure

\`\`\`
${options.name}/
├── src/
│   ├── index.ts          # Entry point
│   ├── bot.ts            # Bot setup
│   ├── commands/         # Command handlers
│   ├── platform/         # Platform-specific code
│   ├── cloud/            # Cloud-specific code
│   └── services/         # Business logic
├── tests/                # Test files
├── docs/                 # Documentation
└── package.json          # Dependencies
\`\`\`

## License

MIT

---

Built with [Wireframe](https://github.com/talkstream/typescript-wireframe-platform)
`
}

function generateTestFile(options: ProjectOptions): string {
  return `/**
 * Bot Tests
 */

import { describe, it, expect } from 'vitest';
import { setupBot } from '../src/bot.js';

describe('Bot', () => {
  it('should initialize successfully', async () => {
    // Mock cloud platform
    const mockCloud = {
      platform: '${options.cloud}',
      getKeyValueStore: () => ({}),
      getDatabaseStore: () => ({}),
    };

    const bot = await setupBot(mockCloud);
    
    expect(bot).toBeDefined();
    expect(bot.platform).toBeDefined();
    expect(bot.eventBus).toBeDefined();
  });

  it('should handle start command', async () => {
    // Add command tests here
  });
});
`
}

function generateDatabaseService(_options: ProjectOptions): string {
  return `/**
 * Database Service
 */

import type { IDatabaseStore } from '@wireframe/core';

let db: IDatabaseStore;

export async function setupDatabase(cloud: any) {
  db = cloud.getDatabaseStore('main');
  
  // Initialize database schema
  await initializeSchema();
  
  return db;
}

async function initializeSchema() {
  // Create tables if they don't exist
  const schema = \`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      platform_id TEXT NOT NULL,
      username TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data TEXT,
      expires_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  \`;

  await db.execute(schema);
}

export async function getUser(platformId: string) {
  const result = await db.query(
    'SELECT * FROM users WHERE platform_id = ? LIMIT 1',
    [platformId]
  );
  
  return result.rows[0];
}

export async function createUser(platformId: string, username?: string) {
  const id = crypto.randomUUID();
  
  await db.execute(
    'INSERT INTO users (id, platform_id, username) VALUES (?, ?, ?)',
    [id, platformId, username]
  );
  
  return { id, platform_id: platformId, username };
}
`
}

function generateI18nService(_options: ProjectOptions): string {
  return `/**
 * Internationalization Service
 */

const translations = {
  en: {
    welcome: 'Welcome!',
    help: 'Available commands:',
    error: 'An error occurred',
  },
  es: {
    welcome: '¡Bienvenido!',
    help: 'Comandos disponibles:',
    error: 'Ocurrió un error',
  },
  // Add more languages
};

export function setupI18n() {
  return {
    t: (key: string, lang: string = 'en') => {
      return translations[lang]?.[key] || translations.en[key] || key;
    },
    
    setLanguage: (userId: string, lang: string) => {
      // Store user language preference
    },
    
    getLanguage: (userId: string) => {
      // Get user language preference
      return 'en';
    },
  };
}
`
}

function getCloudHandler(cloud: string): string {
  switch (cloud) {
    case 'cloudflare':
      return `export default {
  async fetch(request: Request, env: any, ctx: any) {
    // Handle webhook
    if (request.method === 'POST') {
      const { bot } = app;
      return await bot.platform.handleWebhook(request);
    }
    
    return new Response('Bot is running!');
  },
};`

    case 'aws':
      return `export const handler = async (event: any, context: any) => {
  // Handle webhook
  if (event.httpMethod === 'POST') {
    const { bot } = app;
    const request = new Request('https://example.com', {
      method: 'POST',
      body: event.body,
      headers: event.headers,
    });
    
    const response = await bot.platform.handleWebhook(request);
    return {
      statusCode: response.status,
      body: await response.text(),
    };
  }
  
  return {
    statusCode: 200,
    body: 'Bot is running!',
  };
};`

    default:
      return `// Configure handler for ${cloud}`
  }
}

function getFeatureName(feature: string): string {
  const names: Record<string, string> = {
    database: 'Database support',
    payments: 'Payment processing',
    analytics: 'Analytics tracking',
    i18n: 'Internationalization',
    plugins: 'Plugin system',
    admin: 'Admin panel',
    monitoring: 'Monitoring & logging',
    testing: 'Testing setup'
  }

  return names[feature] || feature
}
