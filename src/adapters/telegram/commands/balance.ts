import { logger } from '@/lib/logger'
import { StarsService } from '@/services/stars.service'
import type { CommandHandler } from '@/types'

export const balanceCommand: CommandHandler = async ctx => {
  const userId = ctx.from?.id

  if (!userId) {
    await ctx.reply('❌ Unable to identify user')
    return
  }

  try {
    // Check if DB is available (demo mode check)
    if (!ctx.env.DB) {
      await ctx.reply(
        '🎯 Demo Mode: This feature requires a database.\nConfigure D1 database to enable this functionality.'
      )
      return
    }

    const starsService = new StarsService(ctx.env.DB)
    const stars = await starsService.getStarsBalance(userId)

    const balanceMessage = `
💰 *Your Balance*

⭐ *Telegram Stars:* ${stars}

*Recent Transactions:*
_Transaction history coming soon_

*Available Actions:*
• Buy more Stars in Telegram Settings
• Spend Stars on premium features
• Send Stars to other users
`.trim()

    await ctx.reply(balanceMessage, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💳 Make Payment', callback_data: 'payment' },
            { text: '📊 View History', callback_data: 'history' }
          ],
          [{ text: '🎁 Send Stars', callback_data: 'send_stars' }],
          [{ text: '🔙 Back', callback_data: 'main_menu' }]
        ]
      }
    })

    logger.info('Balance displayed', { userId, balance: stars })
  } catch (error) {
    logger.error('Error in balance command', { error, userId })
    await ctx.reply('❌ Failed to load balance. Please try again later.')
  }

  ctx.session.lastCommand = 'balance'
  ctx.session.lastActivity = Date.now()
}
