import { InlineKeyboard } from 'grammy';

import type { CommandHandler } from '@/types';
import { logger } from '@/lib/logger';
import { getUserService } from '@/services/user-service';
import { escapeMarkdown } from '@/lib/telegram-formatter';
import { hasAccess } from '@/middleware/auth';

export const startCommand: CommandHandler = async (ctx) => {
  const userId = ctx.from?.id;

  if (!userId) {
    await ctx.reply(ctx.i18n('user_identification_error'));
    return;
  }

  try {
    const userService = getUserService(ctx.env);
    const user = await userService.createOrUpdateUser({
      telegramId: userId,
      username: ctx.from.username || undefined,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name || undefined,
      languageCode: ctx.from.language_code || undefined,
      isPremium: ctx.from.is_premium || undefined,
    });

    logger.info('User started bot', {
      userId: user.id,
      telegramId: user.telegramId,
      username: user.username,
    });

    // Check user access status
    const userHasAccess = await hasAccess(ctx);

    if (!userHasAccess) {
      // Check if user has pending request
      const pendingRequest = await ctx.env.DB.prepare(
        `
        SELECT id, status FROM access_requests 
        WHERE user_id = ? AND status = 'pending'
        ORDER BY created_at DESC 
        LIMIT 1
      `,
      )
        .bind(userId)
        .first<{ id: number; status: string }>();

      if (pendingRequest) {
        // User has pending request
        const message = ctx.i18n('access_pending');

        const keyboard = new InlineKeyboard()
          .text(ctx.i18n('access_pending'), 'access:status')
          .text(ctx.i18n('cancel_request'), `access:cancel:${pendingRequest.id}`);

        await ctx.reply(message, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      } else {
        // No access, no pending request
        const message = ctx.i18n('access_denied');

        const keyboard = new InlineKeyboard().text(ctx.i18n('request_access'), 'access:request');

        await ctx.reply(message, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      }
    } else {
      // User has access - show welcome message
      const welcomeMessage = `
🎉 *Welcome to ${escapeMarkdown(ctx.me.first_name)}\\!*

I'm your friendly bot assistant\\. Here's what I can do:

📝 /help \\- Show available commands
⚙️ /settings \\- Manage your preferences
💳 /pay \\- Make a payment with Telegram Stars
📊 /stats \\- View your statistics

Let's get started\\! What would you like to do today?
`.trim();

      await ctx.reply(welcomeMessage, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📝 Help', callback_data: 'help' },
              { text: '⚙️ Settings', callback_data: 'settings' },
            ],
            [{ text: '💳 Make Payment', callback_data: 'payment' }],
          ],
        },
      });
    }

    // Store session data
    ctx.session.userId = user.id;
    ctx.session.lastCommand = 'start';
    ctx.session.lastActivity = Date.now();
  } catch (error) {
    logger.error('Error in start command', { error, userId });
    await ctx.reply(ctx.i18n('general_error'));
  }
};
