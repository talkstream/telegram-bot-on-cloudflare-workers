import type { CommandHandler } from '@/types';

export const helpCommand: CommandHandler = async (ctx) => {
  const helpMessage = `
📚 *Available Commands*

*Basic Commands:*
/start \\- Start the bot
/help \\- Show this help message
/settings \\- Manage your preferences
/about \\- About this bot

*Features:*
/pay \\- Make a payment with Telegram Stars
/balance \\- Check your balance
/history \\- View transaction history
/stats \\- View your statistics

*Support:*
/support \\- Contact support
/feedback \\- Send feedback

*Admin:* \\(if applicable\\)
/admin \\- Admin panel

Use the buttons below for quick access to main features\\!
`.trim();

  await ctx.reply(helpMessage, {
    parse_mode: 'MarkdownV2',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💳 Payment', callback_data: 'payment' },
          { text: '💰 Balance', callback_data: 'balance' },
        ],
        [
          { text: '📊 Stats', callback_data: 'stats' },
          { text: '⚙️ Settings', callback_data: 'settings' },
        ],
        [{ text: '💬 Support', url: 'https://t.me/support' }],
      ],
    },
  });

  // Update session
  ctx.session.lastCommand = 'help';
  ctx.session.lastActivity = Date.now();
};
