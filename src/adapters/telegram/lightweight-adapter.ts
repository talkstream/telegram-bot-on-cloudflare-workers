/**
 * Lightweight Telegram Bot Adapter
 *
 * Minimal bot adapter for webhook processing
 */

import type { Env } from '../../config/env'
import type { EventBus } from '../../core/events/event-bus'
import type { ICloudPlatformConnector } from '../../core/interfaces/cloud-platform'

interface BotConfig {
  token: string
  eventBus: EventBus
  platform: ICloudPlatformConnector
  env: Env
}

interface TelegramBot {
  handleUpdate(update: unknown): Promise<void>
}

/**
 * Create a lightweight bot instance
 */
export async function createBot(config: BotConfig): Promise<TelegramBot> {
  const { token, eventBus } = config

  // Dynamically import Grammy when needed
  const { Bot } = await import('grammy')

  const bot = new Bot(token)

  // Set up basic commands
  bot.command('start', async ctx => {
    await ctx.reply('Welcome to Wireframe Bot!')
    await eventBus.emit('telegram:command:start', { userId: ctx.from?.id }, 'telegram')
  })

  bot.command('help', async ctx => {
    await ctx.reply('Available commands:\n/start - Start the bot\n/help - Show this help')
    await eventBus.emit('telegram:command:help', { userId: ctx.from?.id }, 'telegram')
  })

  // Handle text messages
  bot.on('message:text', async ctx => {
    await eventBus.emit(
      'telegram:message:text',
      {
        userId: ctx.from?.id,
        text: ctx.message.text,
        chatId: ctx.chat.id
      },
      'telegram'
    )
  })

  return {
    async handleUpdate(update: unknown): Promise<void> {
      // Handle update with proper typing
      await bot.handleUpdate(update as Parameters<typeof bot.handleUpdate>[0])
    }
  }
}
