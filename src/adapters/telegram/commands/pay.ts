import type { CommandHandler } from '@/types';
import { logger } from '@/lib/logger';
import { escapeMarkdown } from '@/lib/telegram-formatter';

export const payCommand: CommandHandler = async (ctx) => {
  const userId = ctx.from?.id;
  
  if (!userId) {
    await ctx.reply('❌ Unable to identify user');
    return;
  }

  try {
    // Create payment invoice
    await ctx.replyWithInvoice({
      title: 'Premium Subscription',
      description: 'Get access to premium features for 30 days',
      payload: JSON.stringify({
        userId,
        type: 'premium_subscription',
        duration: 30,
      }),
      currency: 'XTR',
      prices: [
        {
          label: 'Premium Subscription (30 days)',
          amount: 100, // 100 Telegram Stars
        },
      ],
      maxTipAmount: 500, // Maximum 500 stars as tip
      suggestedTipAmounts: [50, 100, 200], // Suggested tips
      photoUrl: 'https://example.com/premium-banner.jpg',
      photoSize: 200,
      photoWidth: 640,
      photoHeight: 360,
      needName: false,
      needPhoneNumber: false,
      needEmail: false,
      needShippingAddress: false,
      isFlexible: false,
    });

    // Send additional information
    const infoMessage = `
⭐ *Payment with Telegram Stars*

You're about to purchase a Premium Subscription for *100 Stars*\\.

*What you get:*
✅ Ad\\-free experience
✅ Priority support
✅ Exclusive features
✅ Early access to new updates

*Note:* Payments are processed securely through Telegram\\.
`.trim();

    await ctx.reply(infoMessage, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '❓ What are Stars?', url: 'https://telegram.org/blog/telegram-stars' },
          ],
          [
            { text: '🔙 Back', callback_data: 'main_menu' },
          ],
        ],
      },
    });

    logger.info('Payment invoice sent', { userId });
  } catch (error) {
    logger.error('Error sending payment invoice', { error, userId });
    await ctx.reply('❌ Failed to create payment. Please try again later.');
  }
};