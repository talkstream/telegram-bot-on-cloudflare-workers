/**
 * Telegram-specific types and interfaces
 */

import type { Context as GrammyContext } from 'grammy'
import type { CallbackQuery, InlineQuery, Message } from 'grammy/types'

import type { AppContext } from '../../../types/context.js'

/**
 * Telegram bot configuration
 */
export interface TelegramConfig {
  /**
   * Telegram Bot API token
   */
  token: string

  /**
   * Webhook secret for validation
   */
  webhookSecret?: string

  /**
   * Bot username (without @)
   */
  username?: string

  /**
   * API server URL (for self-hosted servers)
   */
  apiUrl?: string

  /**
   * Default parse mode for messages
   */
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'

  /**
   * Enable link preview
   */
  linkPreview?: boolean

  /**
   * Batch message settings
   */
  batch?: {
    enabled: boolean
    maxSize?: number
    delay?: number
  }

  /**
   * Rate limiting settings
   */
  rateLimit?: {
    enabled: boolean
    maxRequests?: number
    windowMs?: number
  }

  /**
   * Allow additional properties for forward compatibility
   */
  [key: string]: unknown
}

/**
 * Extended Telegram context
 */
export type TelegramContext = GrammyContext & AppContext

/**
 * Telegram update types we handle
 */
export type SupportedUpdate =
  | { message: Message }
  | { callback_query: CallbackQuery }
  | { inline_query: InlineQuery }
  | { edited_message: Message }
  | { channel_post: Message }
  | { edited_channel_post: Message }

/**
 * Telegram command metadata
 */
export interface TelegramCommand {
  command: string
  description: string
  aliases?: string[]
  hidden?: boolean
  adminOnly?: boolean
}

/**
 * Telegram callback data
 */
export interface TelegramCallbackData {
  action: string
  data?: Record<string, unknown>
}
