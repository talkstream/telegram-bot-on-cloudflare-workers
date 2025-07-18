import type { Bot } from 'grammy';

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
import {
  handleAccessRequest,
  handleAccessStatus,
  handleAccessCancel,
  handleAccessApprove,
  handleAccessReject,
  handleAccessNext,
} from './access';

import type { BotContext } from '@/types';
import { logger } from '@/lib/logger';

// Import callback handlers

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

  // Access control callbacks
  bot.callbackQuery('access:request', async (ctx) => await handleAccessRequest(ctx));
  bot.callbackQuery('access:status', async (ctx) => await handleAccessStatus(ctx));
  bot.callbackQuery(/^access:cancel:(\d+)$/, async (ctx) => {
    const data = ctx.callbackQuery.data;
    const match = data?.match(/^access:cancel:(\d+)$/);
    if (match?.[1]) await handleAccessCancel(ctx, match[1]);
  });
  bot.callbackQuery(/^access:approve:(\d+)$/, async (ctx) => {
    const data = ctx.callbackQuery.data;
    const match = data?.match(/^access:approve:(\d+)$/);
    if (match?.[1]) await handleAccessApprove(ctx, match[1]);
  });
  bot.callbackQuery(/^access:reject:(\d+)$/, async (ctx) => {
    const data = ctx.callbackQuery.data;
    const match = data?.match(/^access:reject:(\d+)$/);
    if (match?.[1]) await handleAccessReject(ctx, match[1]);
  });
  bot.callbackQuery(/^access:next:(\d+)$/, async (ctx) => {
    const data = ctx.callbackQuery.data;
    const match = data?.match(/^access:next:(\d+)$/);
    if (match?.[1]) await handleAccessNext(ctx, match[1]);
  });
  bot.callbackQuery('view_requests', async (ctx) => {
    await ctx.answerCallbackQuery();
    // Simply notify about using the command
    await ctx.reply(ctx.i18n('use_requests_command'));
  });

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
