import type { Bot } from 'grammy';
import type { BotContext } from '@/types';
import { logger } from '@/lib/logger';

// Import all command handlers
import { startCommand } from './start';
import { helpCommand } from './help';
import { payCommand } from './pay';
import { settingsCommand } from './settings';
import { statsCommand } from './stats';
import { balanceCommand } from './balance';

export function setupCommands(bot: Bot<BotContext>): void {
  logger.info('Setting up bot commands');

  // Basic commands
  bot.command('start', startCommand);
  bot.command('help', helpCommand);
  
  // Feature commands
  bot.command('pay', payCommand);
  bot.command('settings', settingsCommand);
  bot.command('stats', statsCommand);
  bot.command('balance', balanceCommand);
  
  // Set bot commands for menu
  bot.api.setMyCommands([
    { command: 'start', description: 'Start the bot' },
    { command: 'help', description: 'Show help message' },
    { command: 'pay', description: 'Make a payment' },
    { command: 'settings', description: 'Bot settings' },
    { command: 'stats', description: 'View statistics' },
    { command: 'balance', description: 'Check balance' },
  ]).catch((error) => {
    logger.error('Failed to set bot commands', { error });
  });

  logger.info('Bot commands setup complete');
}
