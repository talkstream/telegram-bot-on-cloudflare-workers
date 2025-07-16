import type { Bot } from 'grammy';
import type { BotContext } from '@/types';
import { logger } from '@/lib/logger';

// Import callback handlers
import {
  mainMenuCallback,
  helpCallback,
  settingsCallback,
  paymentCallback,
  balanceCallback,
  statsCallback,
} from './menu';

import {
  languageSettingCallback,
  setLanguageCallback,
  notificationSettingCallback,
  toggleNotificationsCallback,
  clearDataCallback,
  confirmClearDataCallback,
} from './settings';

export function setupCallbacks(bot: Bot<BotContext>): void {
  logger.info('Setting up callback handlers');

  // Menu callbacks
  bot.callbackQuery('main_menu', mainMenuCallback);
  bot.callbackQuery('help', helpCallback);
  bot.callbackQuery('settings', settingsCallback);
  bot.callbackQuery('payment', paymentCallback);
  bot.callbackQuery('balance', balanceCallback);
  bot.callbackQuery('stats', statsCallback);
  
  // Settings callbacks
  bot.callbackQuery('settings:language', languageSettingCallback);
  bot.callbackQuery(/^set_language:/, setLanguageCallback);
  bot.callbackQuery('settings:notifications', notificationSettingCallback);
  bot.callbackQuery(/^toggle_notifications:/, toggleNotificationsCallback);
  bot.callbackQuery('settings:clear_data', clearDataCallback);
  bot.callbackQuery('confirm_clear_data', confirmClearDataCallback);
  
  // Generic callback handler for unhandled callbacks
  bot.on('callback_query:data', async (ctx) => {
    logger.warn('Unhandled callback query', { 
      data: ctx.callbackQuery.data,
      userId: ctx.from?.id,
    });
    await ctx.answerCallbackQuery('This feature is not yet implemented');
  });

  logger.info('Callback handlers setup complete');
}
