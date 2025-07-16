import type { CommandHandler } from '@/types';
import { logger } from '@/lib/logger';
import { getUserService } from '@/services/user-service';
import { escapeMarkdown } from '@/lib/telegram-formatter';

export const startCommand: CommandHandler = async (ctx) => {
  const userId = ctx.from?.id;
  
  if (!userId) {
    await ctx.reply('❌ Unable to identify user');
    return;
  }

  try {
    const userService = getUserService(ctx.env);
    const user = await userService.createOrUpdateUser({
      telegramId: userId,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      languageCode: ctx.from.language_code,
      isPremium: ctx.from.is_premium,
    });

    logger.info('User started bot', {
      userId: user.id,
      telegramId: user.telegramId,
      username: user.username,
    });

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
          [
            { text: '💳 Make Payment', callback_data: 'payment' },
          ],
        ],
      },
    });

    // Store session data
    ctx.session.userId = user.id;
    ctx.session.lastCommand = 'start';
    ctx.session.lastActivity = Date.now();
  } catch (error) {
    logger.error('Error in start command', { error, userId });
    await ctx.reply('❌ An error occurred. Please try again later.');
  }
};