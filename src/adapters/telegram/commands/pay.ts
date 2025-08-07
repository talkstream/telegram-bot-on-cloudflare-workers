import { logger } from '@/lib/logger'
import type { CommandHandler } from '@/types'

export const payCommand: CommandHandler = async ctx => {
  const userId = ctx.from?.id

  if (!userId) {
    await ctx.reply('❌ Unable to identify user')
    return
  }

  try {
    // Create payment invoice
    await ctx.replyWithInvoice(
      'Premium Subscription',
      'Get access to premium features for 30 days',
      JSON.stringify({
        userId,
        type: 'premium_subscription',
        duration: 30
      }),
      'XTR',
      [
        {
          label: 'Premium Subscription (30 days)',
          amount: 100 // 100 Telegram Stars
        }
      ],
      {
        max_tip_amount: 500, // Maximum 500 stars as tip
        suggested_tip_amounts: [50, 100, 200], // Suggested tips
        photo_url: 'https://example.com/premium-banner.jpg',
        photo_size: 200,
        photo_width: 640,
        photo_height: 360,
        need_name: false,
        need_phone_number: false,
        need_email: false,
        need_shipping_address: false,
        is_flexible: false
      }
    )

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
`.trim()

    await ctx.reply(infoMessage, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '❓ What are Stars?',
              url: 'https://telegram.org/blog/telegram-stars'
            }
          ],
          [{ text: '🔙 Back', callback_data: 'main_menu' }]
        ]
      }
    })

    logger.info('Payment invoice sent', { userId })
  } catch (error) {
    logger.error('Error sending payment invoice', { error, userId })
    await ctx.reply('❌ Failed to create payment. Please try again later.')
  }
}
