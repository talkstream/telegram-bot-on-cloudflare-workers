/**
 * @wireframe/connector-telegram
 *
 * Telegram Bot API connector for Wireframe
 */

import { Bot, webhookCallback } from 'grammy'
import type { Context } from 'grammy'
import type { Connector, Message } from '@wireframe/core'
import { ConnectorType } from '@wireframe/core'

export interface TelegramConfig {
  token: string
  webhookUrl?: string
  pollingTimeout?: number
  apiRoot?: string
}

export class TelegramConnector implements Connector {
  name = '@wireframe/connector-telegram'
  version = '2.0.0-alpha.1'
  type = ConnectorType.MESSAGING as ConnectorType

  private bot?: Bot
  private config?: TelegramConfig

  async initialize(config: unknown): Promise<void> {
    this.config = config as TelegramConfig

    if (!this.config.token) {
      throw new Error('Telegram bot token is required')
    }

    this.bot = new Bot(this.config.token, {
      client: {
        apiRoot: this.config.apiRoot
      }
    })
  }

  async start(): Promise<void> {
    if (!this.bot) {
      throw new Error('Connector not initialized')
    }

    if (this.config?.webhookUrl) {
      // Webhook mode
      await this.bot.api.setWebhook(this.config.webhookUrl)
    } else {
      // Long polling mode
      this.bot.start({
        drop_pending_updates: true,
        allowed_updates: [],
        onStart: () => console.info('Telegram bot started')
      })
    }
  }

  async stop(): Promise<void> {
    if (this.bot) {
      await this.bot.stop()
    }
  }

  async dispose(): Promise<void> {
    await this.stop()
    this.bot = undefined
    this.config = undefined
  }

  /**
   * Get webhook handler for serverless environments
   */
  getWebhookHandler() {
    if (!this.bot) {
      throw new Error('Connector not initialized')
    }
    return webhookCallback(this.bot, 'cloudflare-mod')
  }

  /**
   * Convert Grammy context to Wireframe message
   */
  private convertMessage(ctx: Context): Message {
    const msg = ctx.message || ctx.editedMessage || ctx.channelPost || ctx.editedChannelPost
    
    if (!msg) {
      throw new Error('No message found in context')
    }

    return {
      id: String(msg.message_id),
      text: msg.text || '',
      from: msg.from ? {
        id: String(msg.from.id),
        username: msg.from.username,
        firstName: msg.from.first_name,
        lastName: msg.from.last_name,
        isBot: msg.from.is_bot
      } : {
        id: 'unknown',
        username: undefined,
        firstName: undefined,
        lastName: undefined,
        isBot: false
      },
      chat: {
        id: String(msg.chat.id),
        type: msg.chat.type,
        title: msg.chat.title
      },
      date: new Date(msg.date * 1000),
      reply: async (text: string, options?: { parseMode?: string; replyToMessageId?: string | number }) => {
        await ctx.reply(text, {
          parse_mode: options?.parseMode as ('HTML' | 'Markdown' | 'MarkdownV2' | undefined),
          reply_to_message_id: options?.replyToMessageId
            ? Number(options.replyToMessageId)
            : undefined
        })
      }
    }
  }

  /**
   * Register message handler
   */
  onMessage(handler: (message: Message) => Promise<void>): void {
    if (!this.bot) {
      throw new Error('Connector not initialized')
    }

    this.bot.on('message', async ctx => {
      const message = this.convertMessage(ctx)
      await handler(message)
    })
  }

  /**
   * Send message to a chat
   */
  async sendMessage(chatId: string, text: string, options?: Record<string, unknown>): Promise<void> {
    if (!this.bot) {
      throw new Error('Connector not initialized')
    }

    await this.bot.api.sendMessage(chatId, text, options)
  }
}

// Default export for easy registration
export default new TelegramConnector()
