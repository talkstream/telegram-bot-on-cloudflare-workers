import { TelegramAdapter } from '../../src/core/telegram-adapter.js';
import { CoreBot } from '../../src/core/bot.js';
import { logger } from '../../src/lib/logger.js';
import type { Context } from 'grammy';
import type { Env } from '../../src/types/env.js';

/**
 * Example Telegram bot implementation using the wireframe
 */

// Define custom commands
const customCommands = {
  // Simple hello command
  hello: async (ctx: Context) => {
    await ctx.reply("👋 Hello! I'm your friendly Telegram bot built with Cloudflare Workers!");
  },

  // Weather command (mock implementation)
  weather: async (ctx: Context) => {
    const location = ctx.match || 'World';
    await ctx.reply(`🌤️ The weather in ${location} is perfect for coding!`);
  },

  // Echo command
  echo: async (ctx: Context) => {
    const text = ctx.match || "You didn't provide any text to echo!";
    await ctx.reply(`🔊 Echo: ${text}`);
  },

  // Status command
  status: async (ctx: Context) => {
    const uptime = process.uptime ? process.uptime() : 'N/A';
    await ctx.reply(
      `🤖 Bot Status:\n` +
        `✅ Online\n` +
        `⏱️ Uptime: ${uptime} seconds\n` +
        `🌐 Platform: Cloudflare Workers\n` +
        `🚀 Framework: Telegram Bot Wireframe`,
    );
  },

  // Crypto price command (mock)
  crypto: async (ctx: Context) => {
    const coin = ctx.match || 'BTC';
    const mockPrice = Math.floor(Math.random() * 50000) + 20000;
    await ctx.reply(
      `💰 ${coin.toUpperCase()} Price:\n` +
        `📈 $${mockPrice.toLocaleString()}\n` +
        `📊 24h Change: +${(Math.random() * 10).toFixed(2)}%`,
    );
  },
};

// Export the main handler for Cloudflare Workers
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // Initialize the Telegram adapter
      const adapter = new TelegramAdapter(env);

      // Create the bot instance
      const bot = new CoreBot(env, adapter);

      // Register custom commands
      Object.entries(customCommands).forEach(([command, handler]) => {
        bot.command(command, handler);
      });

      // Add inline query handler
      bot.on('inline_query', async (ctx) => {
        const query = ctx.inlineQuery?.query || '';

        const results = [
          {
            type: 'article' as const,
            id: '1',
            title: 'Send a greeting',
            input_message_content: {
              message_text: `👋 Hello from Telegram Bot on Cloudflare Workers!`,
            },
          },
          {
            type: 'article' as const,
            id: '2',
            title: 'Send bot info',
            input_message_content: {
              message_text: `🤖 This bot is powered by Cloudflare Workers and the Telegram Bot Wireframe!`,
            },
          },
        ];

        if (query) {
          results.push({
            type: 'article' as const,
            id: '3',
            title: `Echo: ${query}`,
            input_message_content: {
              message_text: `Echo: ${query}`,
            },
          });
        }

        await ctx.answerInlineQuery(results);
      });

      // Add callback query handler for inline keyboards
      bot.on('callback_query', async (ctx) => {
        const data = ctx.callbackQuery?.data;

        switch (data) {
          case 'help':
            await ctx.answerCallbackQuery('Opening help menu...');
            await ctx.reply(
              '📚 Available Commands:\n\n' +
                '/start - Start the bot\n' +
                '/help - Show this help menu\n' +
                '/hello - Get a greeting\n' +
                '/weather [location] - Get weather info\n' +
                '/echo [text] - Echo your message\n' +
                '/status - Check bot status\n' +
                '/crypto [coin] - Get crypto price\n' +
                '/settings - Open settings menu',
            );
            break;

          case 'about':
            await ctx.answerCallbackQuery('Loading about info...');
            await ctx.reply(
              '🤖 About This Bot\n\n' +
                'This is an example Telegram bot built with:\n' +
                '• Cloudflare Workers\n' +
                '• Telegram Bot API\n' +
                '• TypeScript\n' +
                '• Grammy Framework\n\n' +
                'Source: github.com/talkstream/telegram-bot-on-cloudflare-workers',
            );
            break;

          default:
            await ctx.answerCallbackQuery('Unknown action');
        }
      });

      // Handle the request
      return await bot.handleUpdate(request);
    } catch (error) {
      logger.error('Bot error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  // Scheduled handler for periodic tasks
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    logger.info('Running scheduled task', { cron: event.cron });

    // Example: Send daily statistics to admin
    if (event.cron === '0 0 * * *') {
      // Daily at midnight
      const adapter = new TelegramAdapter(env);
      const adminId = env.ADMIN_USER_ID;

      if (adminId) {
        try {
          await adapter.bot.api.sendMessage(
            adminId,
            '📊 Daily Report:\n' +
              '• Bot is running smoothly\n' +
              '• All systems operational\n' +
              '• Have a great day!',
          );
        } catch (error) {
          logger.error('Failed to send daily report:', error);
        }
      }
    }
  },
};
