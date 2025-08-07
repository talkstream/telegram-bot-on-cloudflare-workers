import { InlineKeyboard } from 'grammy'

import { logger } from '@/lib/logger'
import { escapeMarkdown } from '@/lib/telegram-formatter'
import { getUserService } from '@/services/user-service'
import type { CommandHandler } from '@/types'
// Auth check will use roleService from context

export const startCommand: CommandHandler = async (ctx): Promise<void> => {
  const userId = ctx.from?.id

  if (!userId) {
    await ctx.reply(ctx.i18n.t('system.errors.user_identification', { namespace: 'core' }))
    return
  }

  try {
    const userService = getUserService(ctx.env)
    if (!userService) {
      // If no database, just send welcome message
      const message =
        '👋 Welcome to Demo Mode!\n\nThis bot is running without a database.\nConfigure DB to enable full features.'
      await ctx.reply(message, {
        parse_mode: 'HTML'
      })
      return
    }

    const user = await userService.createOrUpdateUser({
      telegramId: userId,
      username: ctx.from.username || undefined,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name || undefined,
      languageCode: ctx.from.language_code || undefined,
      isPremium: ctx.from.is_premium || undefined
    })

    logger.info('User started bot', {
      userId: user.id,
      telegramId: user.telegramId,
      username: user.username
    })

    // Check user access status using roleService
    const userHasAccess = ctx.roleService
      ? await ctx.roleService.hasAccess(`telegram_${userId}`)
      : true

    if (!userHasAccess) {
      // Check if DB is available (demo mode check)
      if (!ctx.env.DB) {
        await ctx.reply(
          '🎯 Demo Mode: This feature requires a database.\nConfigure D1 database to enable this functionality.'
        )
        return
      }

      // Check if user has pending request
      const pendingRequest = await ctx.env.DB.prepare(
        `
        SELECT id, status FROM access_requests 
        WHERE user_id = ? AND status = 'pending'
        ORDER BY created_at DESC 
        LIMIT 1
      `
      )
        .bind(userId)
        .first<{ id: number; status: string }>()

      if (pendingRequest) {
        // User has pending request
        const message = ctx.i18n.t('status.pending', { namespace: 'access' })

        const keyboard = new InlineKeyboard()
          .text(ctx.i18n.t('status.pending', { namespace: 'access' }), 'access:status')
          .text(
            ctx.i18n.t('buttons.cancel_request', { namespace: 'access' }),
            `access:cancel:${pendingRequest.id}`
          )

        await ctx.reply(message, {
          parse_mode: 'HTML',
          reply_markup: keyboard
        })
      } else {
        // No access, no pending request
        const message = ctx.i18n.t('status.denied', { namespace: 'access' })

        const keyboard = new InlineKeyboard().text(
          ctx.i18n.t('buttons.request_access', { namespace: 'access' }),
          'access:request'
        )

        await ctx.reply(message, {
          parse_mode: 'HTML',
          reply_markup: keyboard
        })
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
`.trim()

      await ctx.reply(welcomeMessage, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📝 Help', callback_data: 'help' },
              { text: '⚙️ Settings', callback_data: 'settings' }
            ],
            [{ text: '💳 Make Payment', callback_data: 'payment' }]
          ]
        }
      })
    }

    // Store session data
    ctx.session.userId = user.id
    ctx.session.lastCommand = 'start'
    ctx.session.lastActivity = Date.now()
  } catch (error) {
    logger.error('Error in start command', { error, userId })
    await ctx.reply(ctx.i18n.t('system.errors.general', { namespace: 'core' }))
  }
}
