/**
 * Callback query handler for Telegram connector
 */

import type { CallbackQuery, InlineKeyboardMarkup } from 'grammy/types'

import type { EventBus } from '../../../../core/events/event-bus.js'
import type { TelegramContext } from '../types.js'

/**
 * Callback handler for inline keyboard buttons
 */
export class TelegramCallbackHandler {
  private handlers: Map<string, CallbackHandler> = new Map()

  constructor(private eventBus: EventBus) {}

  /**
   * Register a callback handler
   */
  register(action: string, handler: CallbackHandler): void {
    this.handlers.set(action, handler)
  }

  /**
   * Handle callback query
   */
  async handleCallback(ctx: TelegramContext): Promise<void> {
    const query = ctx.callbackQuery
    if (!query || !query.data) return

    try {
      // Parse callback data
      const data = this.parseCallbackData(query.data)

      // Find handler
      const handler = this.handlers.get(data.action)

      if (!handler) {
        await ctx.answerCallbackQuery({
          text: 'This action is no longer available',
          show_alert: true
        })
        return
      }

      // Create callback context
      const callbackContext: CallbackContext = {
        query,
        data,
        answer: async (text?: string, options?: AnswerOptions) => {
          await ctx.answerCallbackQuery({
            text,
            show_alert: options?.showAlert,
            url: options?.url,
            cache_time: options?.cacheTime
          })
        },
        edit: async (text: string, options?: EditOptions) => {
          if (query.message) {
            await ctx.editMessageText(text, {
              parse_mode: options?.parseMode || 'HTML',
              reply_markup: options?.replyMarkup as InlineKeyboardMarkup | undefined
            })
          }
        },
        delete: async () => {
          if (query.message) {
            await ctx.deleteMessage()
          }
        },
        ctx
      }

      // Execute handler
      await handler(callbackContext)

      // Emit event
      this.eventBus.emit(
        'telegram:callback_handled',
        {
          action: data.action,
          data: data.data,
          from: query.from
        },
        'TelegramCallbackHandler'
      )
    } catch (error) {
      this.eventBus.emit(
        'telegram:callback_error',
        {
          error: error instanceof Error ? error.message : 'Callback handling failed',
          query
        },
        'TelegramCallbackHandler'
      )

      await ctx.answerCallbackQuery({
        text: '❌ An error occurred',
        show_alert: true
      })
    }
  }

  /**
   * Parse callback data
   */
  private parseCallbackData(dataString: string): ParsedCallbackData {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(dataString)
      return {
        action: parsed.action || dataString,
        data: parsed.data || {}
      }
    } catch {
      // Fallback to simple string
      return {
        action: dataString,
        data: {}
      }
    }
  }
}

/**
 * Callback handler function type
 */
export type CallbackHandler = (context: CallbackContext) => Promise<void>

/**
 * Callback context
 */
export interface CallbackContext {
  query: CallbackQuery
  data: ParsedCallbackData
  answer: (text?: string, options?: AnswerOptions) => Promise<void>
  edit: (text: string, options?: EditOptions) => Promise<void>
  delete: () => Promise<void>
  ctx: TelegramContext
}

/**
 * Parsed callback data
 */
export interface ParsedCallbackData {
  action: string
  data: Record<string, unknown>
}

/**
 * Answer options
 */
export interface AnswerOptions {
  showAlert?: boolean
  url?: string
  cacheTime?: number
}

/**
 * Edit options
 */
export interface EditOptions {
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  replyMarkup?: unknown
}

/**
 * Create default callback handlers
 */
export function createDefaultCallbackHandlers(): Map<string, CallbackHandler> {
  const handlers = new Map<string, CallbackHandler>()

  // Example: Close button handler
  handlers.set('close', async ctx => {
    await ctx.delete()
    await ctx.answer('Closed')
  })

  // Example: Confirm action handler
  handlers.set('confirm', async ctx => {
    await ctx.edit('✅ Action confirmed!')
    await ctx.answer('Confirmed')
  })

  // Example: Cancel action handler
  handlers.set('cancel', async ctx => {
    await ctx.edit('❌ Action cancelled')
    await ctx.answer('Cancelled')
  })

  return handlers
}
