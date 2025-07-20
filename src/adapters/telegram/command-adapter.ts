/**
 * Adapter for migrating legacy commands to new plugin architecture
 */

import type { Bot } from 'grammy';

import type { PluginCommand } from '../../core/plugins/plugin';
import type { EventBus } from '../../core/events/event-bus';
import type { CommandArgs } from '../../types/command-args';
import type { TelegramContext } from '../../connectors/messaging/telegram/types';
import { TelegramCommandHandler } from '../../connectors/messaging/telegram/handlers/command-handler';

import { setupCommands as setupLegacyCommands } from './commands';

import { logger } from '@/lib/logger';
import type { BotContext } from '@/types';

/**
 * Create plugin commands from legacy commands
 */
export function createPluginCommands(): PluginCommand[] {
  const commands: PluginCommand[] = [
    {
      name: 'start',
      description: 'Start the bot',
      handler: async (_args, ctx) => {
        // TODO: Implement using new architecture
        await ctx.reply(
          'Welcome to Wireframe Bot! 🎉\n\nThis bot is being migrated to a new architecture.',
        );
      },
    },
    {
      name: 'help',
      description: 'Show help message',
      handler: async (_args, ctx) => {
        const helpText = `
<b>Available Commands:</b>

/start - Start the bot
/help - Show this help message
/settings - Bot settings
/stats - View statistics
/balance - Check balance
/ask - Ask AI a question
/pay - Make a payment

<i>More commands are being migrated...</i>
        `.trim();

        await ctx.reply(helpText);
      },
    },
    {
      name: 'settings',
      description: 'Bot settings',
      handler: async (_args, ctx) => {
        await ctx.reply('⚙️ Settings (coming soon)');
      },
    },
    {
      name: 'stats',
      description: 'View statistics',
      handler: async (_args, ctx) => {
        await ctx.reply('📊 Statistics (coming soon)');
      },
    },
    {
      name: 'balance',
      description: 'Check balance',
      handler: async (_args, ctx) => {
        await ctx.reply('💰 Balance (coming soon)');
      },
    },
    {
      name: 'ask',
      description: 'Ask AI a question',
      handler: async (args, ctx) => {
        const question = (args as CommandArgs)._raw;
        if (!question) {
          await ctx.reply(
            'Please provide a question after the command.\nExample: /ask What is the weather today?',
          );
          return;
        }
        await ctx.reply(
          `🤔 Processing your question: "${question}"\n\n<i>AI integration coming soon...</i>`,
        );
      },
    },
    {
      name: 'pay',
      description: 'Make a payment',
      handler: async (_args, ctx) => {
        await ctx.reply('💳 Payment system (coming soon)');
      },
    },
    {
      name: 'batch',
      description: 'Test request batching',
      handler: async (_args, ctx) => {
        await ctx.reply('🔄 Batching test (coming soon)');
      },
    },
    // Owner commands
    {
      name: 'info',
      description: 'System information (owner only)',
      handler: async (_args, ctx) => {
        // TODO: Check owner permission
        await ctx.reply('ℹ️ System info (coming soon)');
      },
    },
    {
      name: 'admin',
      description: 'Admin management (owner only)',
      handler: async (_args, ctx) => {
        // TODO: Check owner permission
        await ctx.reply('👨‍💼 Admin management (coming soon)');
      },
    },
    {
      name: 'debug',
      description: 'Debug information (owner only)',
      handler: async (_args, ctx) => {
        // TODO: Check owner permission
        await ctx.reply('🐞 Debug info (coming soon)');
      },
    },
    // Admin commands
    {
      name: 'requests',
      description: 'View AI requests (admin only)',
      handler: async (_args, ctx) => {
        // TODO: Check admin permission
        await ctx.reply('📊 AI requests (coming soon)');
      },
    },
  ];

  return commands;
}

/**
 * Setup legacy command handlers with new TelegramConnector
 */
export function setupCommandsWithConnector(bot: Bot<TelegramContext>, eventBus: EventBus): void {
  logger.info('Setting up commands with new connector architecture');

  // Create plugin commands
  const pluginCommands = createPluginCommands();

  // Create command map
  const commandMap = new Map(pluginCommands.map((cmd) => [cmd.name, cmd]));

  // Create and register command handler
  const commandHandler = new TelegramCommandHandler(eventBus, commandMap);
  commandHandler.registerCommands(bot);

  // Set bot commands for menu
  bot.api
    .setMyCommands(
      pluginCommands.map((cmd) => ({
        command: cmd.name,
        description: cmd.description,
      })),
    )
    .catch((error) => {
      logger.error('Failed to set bot commands', { error });
    });

  logger.info('Commands setup complete with new architecture');
}

/**
 * Use legacy command setup (temporary)
 */
export function useLegacyCommands(bot: Bot<BotContext>): void {
  logger.info('Using legacy command setup');
  setupLegacyCommands(bot);
}
