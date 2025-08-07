import { logger } from '@/lib/logger'
import { escapeMarkdown } from '@/lib/telegram-formatter'
import { getUserService } from '@/services/user-service'
import type { CommandHandler } from '@/types'

export const statsCommand: CommandHandler = async (ctx): Promise<void> => {
  const userId = ctx.from?.id

  if (!userId) {
    await ctx.reply('❌ Unable to identify user')
    return
  }

  try {
    const userService = getUserService(ctx.env)
    if (!userService) {
      // If no database, show demo stats
      const stats = [
        '📊 <b>Demo Statistics</b>',
        '',
        '👤 User: Demo Mode',
        '📅 Started: Just now',
        '💬 Messages: 0',
        '',
        '<i>Configure database to track real statistics</i>'
      ].join('\n')

      await ctx.reply(stats, { parse_mode: 'HTML' })
      return
    }

    const user = await userService.getByTelegramId(userId)

    if (!user) {
      await ctx.reply('❌ User not found. Please /start the bot first.')
      return
    }

    // Calculate some example statistics
    const joinDate = new Date(user.createdAt)
    const daysActive = Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24))

    const statsMessage = `
📊 *Your Statistics*

👤 *Profile:*
• Username: ${user.username ? `@${escapeMarkdown(user.username)}` : 'Not set'}
• User ID: \`${user.id}\`
• Joined: ${escapeMarkdown(joinDate.toLocaleDateString())}

📈 *Activity:*
• Days active: ${daysActive}
• Last seen: Just now
• Total commands: ${Math.floor(Math.random() * 100) + 1}

💳 *Payments:*
• Total spent: 0 ⭐
• Premium status: ${user.isPremium ? '✅ Active' : '❌ Inactive'}

🏆 *Achievements:*
• Early Adopter ${daysActive > 30 ? '✅' : '🔒'}
• Power User 🔒
• Supporter 🔒
`.trim()

    await ctx.reply(statsMessage, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Get Premium', callback_data: 'payment' }],
          [{ text: '🔙 Back', callback_data: 'main_menu' }]
        ]
      }
    })

    logger.info('Stats displayed', { userId: user.id })
  } catch (error) {
    logger.error('Error in stats command', { error, userId })
    await ctx.reply('❌ Failed to load statistics. Please try again later.')
  }

  ctx.session.lastCommand = 'stats'
  ctx.session.lastActivity = Date.now()
}
