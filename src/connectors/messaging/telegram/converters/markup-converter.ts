/**
 * Converter for keyboard markup between Telegram and UnifiedMessage formats
 */

import { InlineKeyboard, Keyboard } from 'grammy'
import type { InlineKeyboardMarkup, ReplyKeyboardMarkup } from 'grammy/types'

import type {
  InlineButton,
  KeyboardButton,
  MessageMarkup
} from '../../../../core/interfaces/messaging.js'

/**
 * Convert UnifiedMessage markup to Telegram markup
 */
export function unifiedMarkupToTelegram(
  markup?: MessageMarkup
): InlineKeyboardMarkup | ReplyKeyboardMarkup | { remove_keyboard: true } | undefined {
  if (!markup) return undefined

  if (markup.type === 'remove') {
    return { remove_keyboard: true }
  }

  if (markup.type === 'inline' && markup.inline_keyboard) {
    return {
      inline_keyboard: markup.inline_keyboard.map(row =>
        row.map(button => {
          if (button.callback_data) {
            return {
              text: button.text,
              callback_data: button.callback_data
            }
          }
          if (button.url) {
            return {
              text: button.text,
              url: button.url
            }
          }
          if (button.switch_inline_query) {
            return {
              text: button.text,
              switch_inline_query: button.switch_inline_query
            }
          }
          if (button.switch_inline_query_current_chat) {
            return {
              text: button.text,
              switch_inline_query_current_chat: button.switch_inline_query_current_chat
            }
          }

          // Default callback button
          return {
            text: button.text,
            callback_data: 'noop'
          }
        })
      )
    }
  }

  if (markup.type === 'keyboard' && markup.keyboard) {
    return {
      keyboard: markup.keyboard.map(row =>
        row.map(button => {
          if (button.request_contact) {
            return {
              text: button.text,
              request_contact: button.request_contact
            }
          }
          if (button.request_location) {
            return {
              text: button.text,
              request_location: button.request_location
            }
          }
          if (button.request_poll) {
            return {
              text: button.text,
              request_poll: button.request_poll
            }
          }

          // Regular text button
          return button.text
        })
      ),
      resize_keyboard: markup.resize_keyboard,
      one_time_keyboard: markup.one_time_keyboard,
      selective: markup.selective
    }
  }

  return undefined
}

/**
 * Create inline keyboard from UnifiedMessage buttons
 */
export function createInlineKeyboard(buttons: InlineButton[][]): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  buttons.forEach(row => {
    row.forEach((button, index) => {
      if (button.url) {
        keyboard.url(button.text, button.url)
      } else if (button.callback_data) {
        keyboard.text(button.text, button.callback_data)
      } else if (button.switch_inline_query) {
        keyboard.switchInline(button.text, button.switch_inline_query)
      } else if (button.switch_inline_query_current_chat) {
        keyboard.switchInlineCurrent(button.text, button.switch_inline_query_current_chat)
      }

      // Add new row after each button except last in row
      if (index < row.length - 1) {
        keyboard.row()
      }
    })
    keyboard.row()
  })

  return keyboard
}

/**
 * Create reply keyboard from UnifiedMessage buttons
 */
export function createReplyKeyboard(
  buttons: KeyboardButton[][],
  options?: {
    resize_keyboard?: boolean
    one_time_keyboard?: boolean
    selective?: boolean
  }
): Keyboard {
  const keyboard = new Keyboard()

  buttons.forEach(row => {
    row.forEach((button, index) => {
      if (button.request_contact) {
        keyboard.requestContact(button.text)
      } else if (button.request_location) {
        keyboard.requestLocation(button.text)
      } else if (button.request_poll) {
        keyboard.requestPoll(button.text, button.request_poll.type)
      } else {
        keyboard.text(button.text)
      }

      // Add new row after each button except last in row
      if (index < row.length - 1) {
        keyboard.row()
      }
    })
    keyboard.row()
  })

  if (options?.resize_keyboard) {
    keyboard.resized()
  }
  if (options?.one_time_keyboard) {
    keyboard.oneTime()
  }
  if (options?.selective) {
    keyboard.selected()
  }

  return keyboard
}

/**
 * Convert Telegram inline keyboard to unified format
 */
export function telegramInlineKeyboardToUnified(
  keyboard?: InlineKeyboardMarkup
): MessageMarkup | undefined {
  if (!keyboard || !keyboard.inline_keyboard) return undefined

  const inline_keyboard: InlineButton[][] = keyboard.inline_keyboard.map(row =>
    row.map(button => {
      const unifiedButton: InlineButton = {
        text: button.text
      }

      if ('callback_data' in button) {
        unifiedButton.callback_data = button.callback_data
      }
      if ('url' in button) {
        unifiedButton.url = button.url
      }
      if ('switch_inline_query' in button) {
        unifiedButton.switch_inline_query = button.switch_inline_query
      }
      if ('switch_inline_query_current_chat' in button) {
        unifiedButton.switch_inline_query_current_chat = button.switch_inline_query_current_chat
      }

      return unifiedButton
    })
  )

  return {
    type: 'inline',
    inline_keyboard
  }
}

/**
 * Convert Telegram reply keyboard to unified format
 */
export function telegramReplyKeyboardToUnified(
  keyboard?: ReplyKeyboardMarkup
): MessageMarkup | undefined {
  if (!keyboard || !keyboard.keyboard) return undefined

  const keyboardButtons: KeyboardButton[][] = keyboard.keyboard.map(row =>
    row.map(button => {
      // Handle both string and object button types
      if (typeof button === 'string') {
        return { text: button }
      }

      const unifiedButton: KeyboardButton = {
        text: button.text
      }

      if ('request_contact' in button && button.request_contact) {
        unifiedButton.request_contact = button.request_contact
      }
      if ('request_location' in button && button.request_location) {
        unifiedButton.request_location = button.request_location
      }
      if ('request_poll' in button && button.request_poll) {
        unifiedButton.request_poll = button.request_poll
      }

      return unifiedButton
    })
  )

  return {
    type: 'keyboard',
    keyboard: keyboardButtons,
    resize_keyboard: keyboard.resize_keyboard,
    one_time_keyboard: keyboard.one_time_keyboard,
    selective: keyboard.selective
  }
}
