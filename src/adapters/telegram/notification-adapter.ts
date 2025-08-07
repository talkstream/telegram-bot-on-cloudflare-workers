/**
 * Telegram notification adapter
 * Implements notification delivery via Telegram Bot API
 */

import { Bot } from 'grammy'
import type { InlineKeyboardButton } from 'grammy/types'

import type { INotificationAdapter, NotificationTemplate } from '../../core/interfaces/notification'

// Telegram-specific types
interface TelegramError extends Error {
  error_code?: number
  description?: string
}

interface TelegramButton {
  text: string
  callbackData?: string
  url?: string
}

interface TelegramFormattedMessage {
  text: string
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  inlineKeyboard?: TelegramButton[][]
}

interface TelegramTemplateContent {
  body: string
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  buttons?: TelegramButton[][]
}

export interface TelegramNotificationAdapterDeps {
  bot: Bot
  defaultLocale?: string
}

export class TelegramNotificationAdapter implements INotificationAdapter {
  private bot: Bot
  private defaultLocale: string

  constructor(deps: TelegramNotificationAdapterDeps) {
    this.bot = deps.bot
    this.defaultLocale = deps.defaultLocale || 'en'
  }

  async deliver(recipientId: string, message: unknown): Promise<void> {
    const formattedMessage = message as TelegramFormattedMessage
    const telegramId = parseInt(recipientId)
    if (isNaN(telegramId)) {
      throw new Error(`Invalid Telegram ID: ${recipientId}`)
    }

    try {
      const options: Parameters<typeof this.bot.api.sendMessage>[2] = {
        parse_mode: formattedMessage.parseMode || 'HTML'
      }

      // Add inline keyboard if provided
      if (formattedMessage.inlineKeyboard) {
        options.reply_markup = {
          inline_keyboard: this.convertToTelegramKeyboard(formattedMessage.inlineKeyboard)
        }
      }

      await this.bot.api.sendMessage(telegramId, formattedMessage.text, options)
    } catch (error) {
      // Check for specific Telegram errors
      const telegramError = error as TelegramError
      if (telegramError.error_code === 403) {
        throw new Error('USER_BLOCKED')
      }
      throw error
    }
  }

  async checkReachability(recipientId: string): Promise<boolean> {
    const telegramId = parseInt(recipientId)
    if (isNaN(telegramId)) {
      return false
    }

    try {
      // Try to get chat info
      await this.bot.api.getChat(telegramId)
      return true
    } catch (error) {
      const telegramError = error as TelegramError
      // 400 Bad Request: chat not found
      // 403 Forbidden: bot was blocked by user
      if (telegramError.error_code === 400 || telegramError.error_code === 403) {
        return false
      }
      // For other errors, assume user might be reachable
      return true
    }
  }

  async getUserInfo(recipientId: string): Promise<{
    locale?: string
    timezone?: string
    blocked?: boolean
  }> {
    const telegramId = parseInt(recipientId)
    if (isNaN(telegramId)) {
      throw new Error(`Invalid Telegram ID: ${recipientId}`)
    }

    try {
      const chat = await this.bot.api.getChat(telegramId)

      // Type guard for private chat
      if (chat.type === 'private') {
        const privateChat = chat as {
          type: 'private'
          language_code?: string
          first_name?: string
          last_name?: string
          username?: string
        }
        return {
          locale: privateChat.language_code || this.defaultLocale
        }
      }

      return {
        locale: this.defaultLocale
      }
    } catch (_error) {
      // Return minimal info if we can't get chat details
      return {
        locale: this.defaultLocale
      }
    }
  }

  async formatMessage(
    template: NotificationTemplate,
    params: Record<string, unknown>,
    locale: string
  ): Promise<unknown> {
    // Get localized content
    const content = template.content[locale] || template.content[this.defaultLocale]
    if (!content) {
      throw new Error(`No content found for template ${template.id} in locale ${locale}`)
    }

    // Simple template replacement
    let text = content.body
    for (const [key, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`{{${key}}}`, 'g'), String(value))
    }

    // Type guard for telegram content
    const telegramContent = content as TelegramTemplateContent

    const formatted: TelegramFormattedMessage = {
      text,
      parseMode: telegramContent.parseMode || 'HTML'
    }

    // Add buttons if provided
    if (telegramContent.buttons) {
      formatted.inlineKeyboard = telegramContent.buttons.map(row =>
        row.map(button => ({
          text: this.replaceParams(button.text, params),
          callbackData: button.callbackData
            ? this.replaceParams(button.callbackData, params)
            : undefined,
          url: button.url ? this.replaceParams(button.url, params) : undefined
        }))
      )
    }

    return formatted
  }

  isRetryableError(error: unknown): boolean {
    const telegramError = error as TelegramError
    if (!telegramError.error_code) {
      return true // Retry on unknown errors
    }

    const errorCode = telegramError.error_code

    // Don't retry on these errors
    const nonRetryableErrors = [
      400, // Bad Request
      403, // Forbidden (user blocked bot)
      404 // Not Found
    ]

    return !nonRetryableErrors.includes(errorCode)
  }

  private convertToTelegramKeyboard(keyboard: TelegramButton[][]): InlineKeyboardButton[][] {
    return keyboard.map(row =>
      row.map(button => {
        if (button.url) {
          return {
            text: button.text,
            url: button.url
          }
        } else if (button.callbackData) {
          return {
            text: button.text,
            callback_data: button.callbackData
          }
        } else {
          // Default to callback button with text as data
          return {
            text: button.text,
            callback_data: button.text
          }
        }
      })
    )
  }

  private replaceParams(text: string, params: Record<string, unknown>): string {
    let result = text
    for (const [key, value] of Object.entries(params)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value))
    }
    return result
  }
}
