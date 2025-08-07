import type { CallbackHandler } from '@/types'

export const mainMenuCallback: CallbackHandler = async ctx => {
  await ctx.answerCallbackQuery()

  const menuMessage = `
🏠 *Main Menu*

Choose an option:
`.trim()

  await ctx.editMessageText(menuMessage, {
    parse_mode: 'MarkdownV2',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📝 Help', callback_data: 'help' },
          { text: '⚙️ Settings', callback_data: 'settings' }
        ],
        [
          { text: '💳 Payment', callback_data: 'payment' },
          { text: '💰 Balance', callback_data: 'balance' }
        ],
        [{ text: '📊 Statistics', callback_data: 'stats' }]
      ]
    }
  })
}

export const helpCallback: CallbackHandler = async ctx => {
  await ctx.answerCallbackQuery()

  const helpMessage = `
📚 *Quick Help*

Here are the main features:

• 💳 *Payments* \\- Purchase premium features
• 💰 *Balance* \\- Check your Stars balance
• 📊 *Stats* \\- View your usage statistics
• ⚙️ *Settings* \\- Configure preferences

Need more help? Use /help command\\.
`.trim()

  await ctx.editMessageText(helpMessage, {
    parse_mode: 'MarkdownV2',
    reply_markup: {
      inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'main_menu' }]]
    }
  })
}

export const settingsCallback: CallbackHandler = async ctx => {
  await ctx.answerCallbackQuery()

  // Reuse the settings command logic
  const { settingsCommand } = await import('../commands/settings')
  await settingsCommand(ctx)
}

export const paymentCallback: CallbackHandler = async ctx => {
  await ctx.answerCallbackQuery()

  // Reuse the pay command logic
  const { payCommand } = await import('../commands/pay')
  await payCommand(ctx)
}

export const balanceCallback: CallbackHandler = async ctx => {
  await ctx.answerCallbackQuery()

  // Reuse the balance command logic
  const { balanceCommand } = await import('../commands/balance')
  await balanceCommand(ctx)
}

export const statsCallback: CallbackHandler = async ctx => {
  await ctx.answerCallbackQuery()

  // Reuse the stats command logic
  const { statsCommand } = await import('../commands/stats')
  await statsCommand(ctx)
}
