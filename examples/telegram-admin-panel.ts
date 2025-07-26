/**
 * Example: Telegram Bot with Admin Panel
 *
 * Shows how to add a web-based admin panel to your Telegram bot
 * using the Wireframe Admin Panel pattern
 */

import { Hono } from 'hono';
import { Bot } from 'grammy';
import type { ExecutionContext } from '@cloudflare/workers-types';

// Import wireframe components
import { EventBus } from '../src/core/event-bus.js';
import { ConsoleLogger } from '../src/core/logging/console-logger.js';
import { CloudflareKVAdapter } from '../src/storage/cloudflare-kv-adapter.js';
import { CloudflareD1Adapter } from '../src/storage/cloudflare-d1-adapter.js';

// Import admin panel components
import {
  createAdminPanel,
  TelegramAdminAdapter,
  type AdminPanelConfig,
} from '../src/patterns/admin-panel/index.js';

// Environment interface
interface Env {
  // Telegram
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  BOT_ADMIN_IDS: number[];

  // Storage
  KV: KVNamespace;
  DB: D1Database;

  // Admin panel
  ADMIN_URL: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Initialize core services
    const logger = new ConsoleLogger({ level: 'info' });
    const eventBus = new EventBus();
    const kvStorage = new CloudflareKVAdapter(env.KV);
    const database = new CloudflareD1Adapter(env.DB);

    // Admin panel configuration
    const adminConfig: AdminPanelConfig = {
      baseUrl: env.ADMIN_URL || url.origin,
      sessionTTL: 86400, // 24 hours
      tokenTTL: 300, // 5 minutes
      maxLoginAttempts: 3,
      allowedOrigins: [env.ADMIN_URL || url.origin],
      features: {
        dashboard: true,
        userManagement: true,
        analytics: true,
        logs: true,
        settings: true,
      },
    };

    // Create Telegram bot
    const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

    // Create Telegram admin adapter
    const telegramAdapter = new TelegramAdminAdapter({
      bot,
      adminService: null as any, // Will be set below
      config: adminConfig,
      logger: logger.child({ component: 'telegram-admin' }),
      adminIds: env.BOT_ADMIN_IDS,
    });

    // Create admin panel
    const adminPanel = createAdminPanel({
      storage: kvStorage,
      database,
      eventBus,
      logger,
      config: adminConfig,
      platformAdapter: telegramAdapter,
    });

    // Set admin service reference
    (telegramAdapter as any).adminService = adminPanel.adminService;

    // Initialize admin panel
    await adminPanel.adminService.initialize(adminConfig);

    // Register Telegram admin commands
    telegramAdapter.registerCommands();

    // Create Hono app for routing
    const app = new Hono<{ Bindings: Env }>();

    // Admin panel routes
    app.all('/admin/*', async (c) => {
      const response = await adminPanel.connector.handleRequest(c.req.raw);
      return response;
    });

    app.all('/admin', async (c) => {
      const response = await adminPanel.connector.handleRequest(c.req.raw);
      return response;
    });

    // Telegram webhook
    app.post(`/webhook/${env.TELEGRAM_WEBHOOK_SECRET}`, async (c) => {
      try {
        const update = await c.req.json();
        await bot.handleUpdate(update);
        return c.text('OK');
      } catch (error) {
        logger.error('Webhook error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return c.text('Error', 500);
      }
    });

    // Regular bot commands
    bot.command('start', async (ctx) => {
      await ctx.reply(
        'Welcome! This bot has an admin panel.\n\n' + 'Admins can use /admin command to access it.',
      );
    });

    bot.command('help', async (ctx) => {
      const isAdmin = ctx.from && env.BOT_ADMIN_IDS.includes(ctx.from.id);

      let helpText = '📋 *Available Commands:*\n\n';
      helpText += '/start - Start the bot\n';
      helpText += '/help - Show this help message\n';

      if (isAdmin) {
        helpText += '\n*Admin Commands:*\n';
        helpText += '/admin - Get admin panel access\n';
        helpText += '/admin\\_stats - View system statistics\n';
        helpText += '/admin\\_logout - Logout from admin panel\n';
      }

      await ctx.reply(helpText, { parse_mode: 'Markdown' });
    });

    // Example: Log all messages to database
    bot.on('message', async (ctx) => {
      if (!ctx.from || !ctx.message) return;

      try {
        await database
          .prepare(
            `
          INSERT INTO messages (user_id, text, created_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `,
          )
          .bind(ctx.from.id, ctx.message.text || '')
          .run();

        // Update user activity
        await database
          .prepare(
            `
          INSERT OR REPLACE INTO user_activity (user_id, timestamp)
          VALUES (?, CURRENT_TIMESTAMP)
        `,
          )
          .bind(ctx.from.id)
          .run();
      } catch (error) {
        logger.error('Failed to log message', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: ctx.from.id,
        });
      }
    });

    // Health check endpoint
    app.get('/health', async (c) => {
      const health = await adminPanel.connector.getHealth();
      return c.json(health);
    });

    // Default route
    app.get('/', (c) => {
      return c.text('Bot is running!');
    });

    // Handle request with Hono
    return app.fetch(request, env, ctx);
  },
};

// Example wrangler.toml configuration:
/*
name = "telegram-bot-admin"
main = "dist/index.js"
compatibility_date = "2024-01-01"

[vars]
TELEGRAM_WEBHOOK_SECRET = "your-webhook-secret"
ADMIN_URL = "https://your-bot.workers.dev"
BOT_ADMIN_IDS = [123456789, 987654321]

[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"

[[d1_databases]]
binding = "DB"
database_name = "telegram-bot"
database_id = "your-d1-database-id"

[env.production.vars]
TELEGRAM_BOT_TOKEN = "your-bot-token"
*/

// Example D1 schema:
/*
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  telegram_id INTEGER UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(telegram_id)
);

CREATE TABLE IF NOT EXISTS user_activity (
  user_id INTEGER PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(telegram_id)
);

CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_user_activity_timestamp ON user_activity(timestamp);
*/
