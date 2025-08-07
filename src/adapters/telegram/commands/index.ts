import type { Bot, MiddlewareFn } from 'grammy';

// Import all command handlers
import { createAuthMiddleware } from '../middleware/auth';

import { startCommand } from './start';
import { helpCommand } from './help';
import { payCommand } from './pay';
import { settingsCommand } from './settings';
import { statsCommand } from './stats';
import { balanceCommand } from './balance';
import { askCommand } from './ask';
import { batchCommand } from './batch';
// Import Bot API 9.1 commands
import { checklistCommand, tasksCommand, todoCommand } from './checklist';
import { starsCommand, giftCommand, sendStarsCommand } from './stars';
// Import role-based commands
import { infoCommand, adminCommand, debugCommand } from './owner';
import { requestsCommand } from './admin';

// Import middleware
import { logger } from '@/lib/logger';
import type { BotContext } from '@/types';
import { UniversalRoleService } from '@/core/services/role-service';
// Legacy imports removed - using only universal auth

// Error when role service is not provided
function createDefaultAuthMiddleware() {
  const errorMiddleware: MiddlewareFn<BotContext> = async () => {
    throw new Error('RoleService is required. Please configure UniversalRoleService.');
  };

  return {
    requireOwner: errorMiddleware,
    requireAdmin: errorMiddleware,
    requireAccess: errorMiddleware,
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

  // Bot API 9.1 commands
  bot.command('checklist', checklistCommand);
  bot.command('tasks', tasksCommand);
  bot.command('todo', todoCommand);
  bot.command('stars', starsCommand);
  bot.command('gift', giftCommand);
  bot.command('sendstars', sendStarsCommand);

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
      { command: 'checklist', description: '📝 Create a checklist' },
      { command: 'tasks', description: '📋 Manage tasks' },
      { command: 'todo', description: '✅ Quick todo list' },
      { command: 'stars', description: '⭐ Telegram Stars balance' },
      { command: 'gift', description: '🎁 Send or manage gifts' },
      { command: 'sendstars', description: '💫 Send Stars to user' },
    ])
    .catch((error) => {
      logger.error('Failed to set bot commands', { error });
    });

  logger.info('Bot commands setup complete');
}
