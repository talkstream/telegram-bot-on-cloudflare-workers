import type { CommandHandler } from '@/types';
import { logger } from '@/lib/logger';
import { escapeMarkdown } from '@/lib/telegram-formatter';
import { getStarsService } from '@/services/stars.service';

export const balanceCommand: CommandHandler = async (ctx) => {
  const userId = ctx.from?.id;
  
  if (!userId) {
    await ctx.reply('❌ Unable to identify user');
    return;
  }

  try {
    const starsService = getStarsService(ctx.env);
    const balance = await starsService.getUserBalance(userId);
    
    const balanceMessage = `
💰 *Your Balance*

⭐ *Telegram Stars:* ${balance.stars}
💎 *Bonus Points:* ${balance.bonusPoints || 0}

*Recent Transactions:*
${balance.recentTransactions?.length > 0 
  ? balance.recentTransactions.map(tx => 
      `${tx.type === 'credit' ? '➕' : '➖'} ${tx.amount} ⭐ \\- ${escapeMarkdown(tx.description)}`
    ).join('\\n')
  : '_No recent transactions_'
}

*Available Actions:*
• Buy more Stars in Telegram Settings
• Spend Stars on premium features
• Send Stars to other users
`.trim();

    await ctx.reply(balanceMessage, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💳 Make Payment', callback_data: 'payment' },
            { text: '📊 View History', callback_data: 'history' },
          ],
          [
            { text: '🎁 Send Stars', callback_data: 'send_stars' },
          ],
          [
            { text: '🔙 Back', callback_data: 'main_menu' },
          ],
        ],
      },
    });

    logger.info('Balance displayed', { userId, balance: balance.stars });
  } catch (error) {
    logger.error('Error in balance command', { error, userId });
    await ctx.reply('❌ Failed to load balance. Please try again later.');
  }

  ctx.session.lastCommand = 'balance';
  ctx.session.lastActivity = Date.now();
};