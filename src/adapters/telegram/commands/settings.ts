import { escapeMarkdown } from '@/lib/telegram-formatter'
import type { CommandHandler } from '@/types'

export const settingsCommand: CommandHandler = async ctx => {
  const userId = ctx.from?.id

  if (!userId) {
    await ctx.reply('❌ Unable to identify user')
    return
  }

  const settingsMessage = `
⚙️ *Settings*

Configure your bot preferences:

🌐 *Language:* ${escapeMarkdown(ctx.from?.language_code || 'en')}
🔔 *Notifications:* Enabled
🎨 *Theme:* Default

Choose what you'd like to configure:
`.trim()

  await ctx.reply(settingsMessage, {
    parse_mode: 'MarkdownV2',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🌐 Language', callback_data: 'settings:language' },
          { text: '🔔 Notifications', callback_data: 'settings:notifications' }
        ],
        [
          { text: '🎨 Theme', callback_data: 'settings:theme' },
          { text: '🔐 Privacy', callback_data: 'settings:privacy' }
        ],
        [{ text: '🗑️ Clear Data', callback_data: 'settings:clear_data' }],
        [{ text: '🔙 Back', callback_data: 'main_menu' }]
      ]
    }
  })

  ctx.session.lastCommand = 'settings'
  ctx.session.lastActivity = Date.now()
}
