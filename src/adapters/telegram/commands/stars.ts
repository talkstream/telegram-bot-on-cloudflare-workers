/**
 * Telegram Stars Commands (Bot API 9.1)
 *
 * Commands for managing Telegram Stars and gifts
 * @module adapters/telegram/commands/stars
 */

import type { Api, Bot } from 'grammy'
import { InlineKeyboard } from 'grammy'

import { getCloudPlatformConnector } from '@/core/cloud/cloud-platform-cache'
import { EventBus } from '@/core/events/event-bus'
import { logger } from '@/lib/logger'
import { TelegramStarsService } from '@/services/telegram-stars-service'
import type { CommandHandler } from '@/types'

// Create shared instances
let starsService: TelegramStarsService | null = null
let eventBus: EventBus | null = null

async function getStarsService(
  bot: Bot | Api,
  env: Record<string, unknown>
): Promise<TelegramStarsService> {
  if (!starsService) {
    if (!eventBus) {
      eventBus = new EventBus()
    }
    const platform = await getCloudPlatformConnector(env)
    starsService = new TelegramStarsService(bot as Bot, platform, eventBus)
    await starsService.initialize()
  }
  return starsService
}

/**
 * Handle /stars command - Check Star balance
 */
export const starsCommand: CommandHandler = async (ctx): Promise<void> => {
  try {
    const userId = ctx.from?.id
    if (!userId) {
      await ctx.reply('❌ Unable to identify user')
      return
    }

    // Get stars service
    const service = await getStarsService(ctx.api, ctx.env)

    // Get current balance
    const balance = await service.getStarBalance()

    // Get recent transactions
    const transactions = await service.getStarTransactions(0, 5)

    let message = `⭐ *Telegram Stars Balance*\n\n`
    message += `Current Balance: *${balance.toLocaleString()} Stars*\n\n`

    if (transactions.length > 0) {
      message += `📊 *Recent Transactions:*\n`
      transactions.forEach(tx => {
        const emoji =
          tx.type === 'received'
            ? '📥'
            : tx.type === 'sent'
              ? '📤'
              : tx.type === 'purchased'
                ? '💳'
                : '🔄'
        const sign = tx.type === 'received' || tx.type === 'purchased' ? '+' : '-'
        message += `${emoji} ${sign}${tx.amount} Stars - ${tx.timestamp.toLocaleDateString()}\n`
      })
    } else {
      message += `_No recent transactions_`
    }

    // Add action buttons
    const keyboard = new InlineKeyboard()
      .text('💳 Buy Stars', 'stars:buy')
      .text('🎁 Send Gift', 'stars:gift')
      .row()
      .text('📊 All Transactions', 'stars:transactions')

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    })

    logger.info('[StarsCommand] Balance displayed', { userId, balance })

    if (eventBus) {
      eventBus.emit(
        'command:stars:executed',
        {
          userId,
          action: 'balance',
          balance
        },
        'stars-command'
      )
    }
  } catch (error) {
    logger.error('[StarsCommand] Failed to get Stars balance', error)
    await ctx.reply('❌ Failed to get Stars balance. Please try again.')
  }
}

/**
 * Handle /gift command - Send or manage gifts
 */
export const giftCommand: CommandHandler = async (ctx): Promise<void> => {
  try {
    const userId = ctx.from?.id
    if (!userId) {
      await ctx.reply('❌ Unable to identify user')
      return
    }

    // Get stars service
    const service = await getStarsService(ctx.api, ctx.env)

    // Parse command arguments
    const commandText = ctx.message?.text || ''
    const args = commandText
      .replace(/^\/gift\s*/, '')
      .trim()
      .split(/\s+/)
    const action = args[0]?.toLowerCase()

    if (action === 'list') {
      // Show available gifts
      const gifts = await service.getAvailableGifts()

      if (gifts.length === 0) {
        await ctx.reply('🎁 No gifts available at the moment.')
        return
      }

      let message = `🎁 *Available Gifts*\n\n`
      gifts.forEach((gift, index) => {
        message += `${index + 1}. *${gift.name}*\n`
        message += `   💰 ${gift.price} ${gift.currency}\n`
        if (gift.description) {
          message += `   _${gift.description}_\n`
        }
        message += '\n'
      })

      const keyboard = new InlineKeyboard()
      gifts.slice(0, 5).forEach((gift, index) => {
        keyboard.text(`🎁 ${gift.name}`, `gift:select:${gift.id}`)
        if ((index + 1) % 2 === 0) keyboard.row()
      })

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      })
    } else if (action === 'send') {
      // Send a gift (requires additional parameters)
      const recipientUsername = args[1]
      const giftId = args[2]

      if (!recipientUsername || !giftId) {
        await ctx.reply(
          '🎁 *Send a Gift*\n\n' +
            'Usage: `/gift send @username gift_id [message]`\n\n' +
            'Example:\n' +
            '`/gift send @friend gift_123 Happy Birthday!`\n\n' +
            'Use `/gift list` to see available gifts.',
          { parse_mode: 'Markdown' }
        )
        return
      }

      // Note: In a real implementation, you'd need to resolve the username to user ID
      await ctx.reply(
        '🎁 Gift sending requires recipient user ID.\n' + 'This feature is coming soon!'
      )
    } else if (action === 'convert') {
      // Convert a received gift to Stars
      await ctx.reply(
        '🔄 *Convert Gift to Stars*\n\n' +
          'Reply to a message containing a gift with:\n' +
          '`/gift convert`\n\n' +
          'This will convert the gift to Stars.',
        { parse_mode: 'Markdown' }
      )
    } else {
      // Show help
      await ctx.reply(
        '🎁 *Gift Management*\n\n' +
          '• `/gift list` - Show available gifts\n' +
          '• `/gift send` - Send a gift to someone\n' +
          '• `/gift convert` - Convert gift to Stars\n' +
          '• `/gift stats` - View gift statistics\n\n' +
          '💡 *Tip:* Gifts can be purchased with Telegram Stars!',
        { parse_mode: 'Markdown' }
      )
    }

    if (eventBus) {
      eventBus.emit(
        'command:gift:executed',
        {
          userId,
          action: action || 'help'
        },
        'stars-command'
      )
    }
  } catch (error) {
    logger.error('[GiftCommand] Failed to handle gift command', error)
    await ctx.reply('❌ Failed to manage gifts. Please try again.')
  }
}

/**
 * Handle /sendstars command - Send Stars to another user
 */
export const sendStarsCommand: CommandHandler = async (ctx): Promise<void> => {
  try {
    const userId = ctx.from?.id
    if (!userId) {
      await ctx.reply('❌ Unable to identify user')
      return
    }

    // Parse command arguments
    const commandText = ctx.message?.text || ''
    const args = commandText
      .replace(/^\/sendstars\s*/, '')
      .trim()
      .split(/\s+/)

    if (args.length < 2) {
      await ctx.reply(
        '⭐ *Send Telegram Stars*\n\n' +
          'Usage: `/sendstars @username amount [message]`\n\n' +
          'Example:\n' +
          '`/sendstars @friend 100 Thanks for your help!`\n\n' +
          '⚠️ *Note:* You need sufficient Star balance.',
        { parse_mode: 'Markdown' }
      )
      return
    }

    const recipientUsername = args[0]
    const amount = parseInt(args[1] || '0', 10)
    const messageText = args.slice(2).join(' ')

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('❌ Invalid amount. Please enter a positive number.')
      return
    }

    // Get stars service
    const service = await getStarsService(ctx.api, ctx.env)

    // Check current balance
    const balance = await service.getStarBalance()

    if (balance < amount) {
      await ctx.reply(
        `❌ Insufficient Stars balance.\n\n` +
          `Current balance: *${balance} Stars*\n` +
          `Required: *${amount} Stars*\n` +
          `Shortage: *${amount - balance} Stars*`,
        { parse_mode: 'Markdown' }
      )
      return
    }

    // Note: In a real implementation, you'd need to resolve the username to user ID
    await ctx.reply(
      `⭐ Ready to send *${amount} Stars* to ${recipientUsername}\n\n` +
        `${messageText ? `Message: _${messageText}_\n\n` : ''}` +
        `⚠️ This feature requires resolving username to user ID.\n` +
        `Coming soon!`,
      { parse_mode: 'Markdown' }
    )

    if (eventBus) {
      eventBus.emit(
        'command:sendstars:attempted',
        {
          userId,
          recipientUsername,
          amount,
          message: messageText || undefined
        },
        'stars-command'
      )
    }
  } catch (error) {
    logger.error('[SendStarsCommand] Failed to send Stars', error)
    await ctx.reply('❌ Failed to send Stars. Please try again.')
  }
}

/**
 * Handle Stars-related callback queries
 */
export const handleStarsCallback: CommandHandler = async (ctx): Promise<void> => {
  try {
    const callbackQuery = ctx.callbackQuery
    if (!callbackQuery) return

    const data = callbackQuery.data as string | undefined
    if (!data || (!data.startsWith('stars:') && !data.startsWith('gift:'))) return

    const [category, action, ...params] = data.split(':')

    if (category === 'stars') {
      switch (action) {
        case 'buy':
          await ctx.answerCallbackQuery()
          await ctx.reply(
            '💳 *Buy Telegram Stars*\n\n' +
              'You can purchase Stars directly in Telegram:\n' +
              '1. Open any chat with Telegram Stars support\n' +
              '2. Click the Stars button in the attachment menu\n' +
              '3. Choose your package\n' +
              '4. Complete the purchase\n\n' +
              '⭐ Stars can be used for gifts, payments, and more!',
            { parse_mode: 'Markdown' }
          )
          break

        case 'gift':
          await ctx.answerCallbackQuery()
          await ctx.reply('🎁 Use `/gift list` to see available gifts!')
          break

        case 'transactions': {
          await ctx.answerCallbackQuery()
          const service = await getStarsService(ctx.api, ctx.env || {})
          const transactions = await service.getStarTransactions(0, 20)

          let message = '📊 *All Star Transactions*\n\n'
          if (transactions.length === 0) {
            message += '_No transactions found_'
          } else {
            transactions.forEach(tx => {
              const emoji =
                tx.type === 'received'
                  ? '📥'
                  : tx.type === 'sent'
                    ? '📤'
                    : tx.type === 'purchased'
                      ? '💳'
                      : '🔄'
              const sign = tx.type === 'received' || tx.type === 'purchased' ? '+' : '-'
              message += `${emoji} ${sign}${tx.amount} - ${tx.timestamp.toLocaleString()}\n`
            })
          }

          await ctx.reply(message, { parse_mode: 'Markdown' })
          break
        }

        default:
          await ctx.answerCallbackQuery('❌ Unknown action')
      }
    } else if (category === 'gift') {
      switch (action) {
        case 'select': {
          const giftId = params[0]
          await ctx.answerCallbackQuery()
          await ctx.reply(
            `🎁 Selected gift: ${giftId}\n\n` +
              `To send this gift, use:\n` +
              `\`/gift send @username ${giftId} [message]\``,
            { parse_mode: 'Markdown' }
          )
          break
        }

        default:
          await ctx.answerCallbackQuery('❌ Unknown action')
      }
    }
  } catch (error) {
    logger.error('[StarsCallback] Failed to handle callback', error)
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery('❌ An error occurred')
    }
  }
}
