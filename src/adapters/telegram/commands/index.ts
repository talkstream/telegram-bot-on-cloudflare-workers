import type { Bot } from 'grammy';

// Import all command handlers
import { startCommand } from './start';
import { helpCommand } from './help';
import { payCommand } from './pay';
import { settingsCommand } from './settings';
import { statsCommand } from './stats';
import { balanceCommand } from './balance';
import { askCommand } from './ask';
import { batchCommand } from './batch';
// Import role-based commands
import { infoCommand, adminCommand, debugCommand } from './owner';
import { requestsCommand } from './admin';

// Import middleware
import { createAuthMiddleware } from '@/middleware/auth-universal';
import { logger } from '@/lib/logger';
import type { BotContext } from '@/types';
import { UniversalRoleService } from '@/core/services/role-service';
import {
  requireOwner as legacyRequireOwner,
  requireAdmin as legacyRequireAdmin,
} from '@/middleware/auth';

// Default auth middleware for backward compatibility
function createDefaultAuthMiddleware() {
  return {
    requireOwner: legacyRequireOwner,
    requireAdmin: legacyRequireAdmin,
    requireAccess: async (_ctx: BotContext, next: () => Promise<void>) => {
      // Default behavior for access check
      await next();
    },
  };
}

export function setupCommands(bot: Bot<BotContext>, roleService?: UniversalRoleService): void {
  logger.info('Setting up bot commands');

  // Create auth middleware factory
  const auth = roleService ? createAuthMiddleware(roleService) : createDefaultAuthMiddleware();

  // Basic commands
  bot.command('start', startCommand);
  bot.command('help', helpCommand);

  // Feature commands
  bot.command('pay', payCommand);
  bot.command('settings', settingsCommand);
  bot.command('stats', statsCommand);
  bot.command('balance', balanceCommand);
  bot.command('ask', askCommand);
  bot.command('batch', batchCommand);

  // Owner commands
  bot.command('info', auth.requireOwner, infoCommand);
  bot.command('admin', auth.requireOwner, adminCommand);
  bot.command('debug', auth.requireOwner, debugCommand);

  // Admin commands
  bot.command('requests', auth.requireAdmin, requestsCommand);

  // Set bot commands for menu
  bot.api
    .setMyCommands([
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Show help message' },
      { command: 'pay', description: 'Make a payment' },
      { command: 'settings', description: 'Bot settings' },
      { command: 'stats', description: 'View statistics' },
      { command: 'balance', description: 'Check balance' },
      { command: 'ask', description: 'Ask AI a question' },
      { command: 'batch', description: 'Test request batching' },
    ])
    .catch((error) => {
      logger.error('Failed to set bot commands', { error });
    });

  logger.info('Bot commands setup complete');
}
