/**
 * Adapter for migrating legacy callbacks to new callback handler architecture
 */

import type { CallbackHandler } from '../../connectors/messaging/telegram/handlers/callback-handler'
import { TelegramCallbackHandler } from '../../connectors/messaging/telegram/handlers/callback-handler'

/**
 * Create callback handlers from legacy callbacks
 */
export function createCallbackHandlers(): Map<string, CallbackHandler> {
  const handlers = new Map<string, CallbackHandler>()

  // Menu callbacks
  handlers.set('main_menu', async ctx => {
    await ctx.edit('<b>Main Menu</b>\n\n' + 'Select an option:', {
      replyMarkup: {
        inline_keyboard: [
          [{ text: '❓ Help', callback_data: 'help' }],
          [{ text: '⚙️ Settings', callback_data: 'settings' }],
          [{ text: '💰 Balance', callback_data: 'balance' }],
          [{ text: '📊 Stats', callback_data: 'stats' }],
          [{ text: '💳 Payment', callback_data: 'payment' }]
        ]
      }
    })
    await ctx.answer()
  })

  handlers.set('help', async ctx => {
    await ctx.edit(
      '<b>Help</b>\n\n' +
        'Available commands:\n' +
        '/start - Start the bot\n' +
        '/help - Show this help\n' +
        '/settings - Bot settings\n' +
        '/balance - Check balance\n' +
        '/stats - View statistics\n' +
        '/pay - Make a payment\n' +
        '/ask - Ask AI a question',
      {
        replyMarkup: {
          inline_keyboard: [[{ text: '« Back', callback_data: 'main_menu' }]]
        }
      }
    )
    await ctx.answer()
  })

  handlers.set('settings', async ctx => {
    await ctx.edit('<b>Settings</b>\n\n' + 'Configure your bot preferences:', {
      replyMarkup: {
        inline_keyboard: [
          [{ text: '🌐 Language', callback_data: 'settings:language' }],
          [{ text: '🔔 Notifications', callback_data: 'settings:notifications' }],
          [{ text: '🗑 Clear Data', callback_data: 'settings:clear_data' }],
          [{ text: '« Back', callback_data: 'main_menu' }]
        ]
      }
    })
    await ctx.answer()
  })

  handlers.set('balance', async ctx => {
    await ctx.edit(
      '<b>Balance</b>\n\n' +
        '💰 Your balance: 0 credits\n\n' +
        '<i>Balance feature coming soon...</i>',
      {
        replyMarkup: {
          inline_keyboard: [[{ text: '« Back', callback_data: 'main_menu' }]]
        }
      }
    )
    await ctx.answer()
  })

  handlers.set('stats', async ctx => {
    await ctx.edit(
      '<b>Statistics</b>\n\n' +
        '📊 Total requests: 0\n' +
        '💬 Messages sent: 0\n' +
        '⏱ Uptime: 0 hours\n\n' +
        '<i>Stats feature coming soon...</i>',
      {
        replyMarkup: {
          inline_keyboard: [[{ text: '« Back', callback_data: 'main_menu' }]]
        }
      }
    )
    await ctx.answer()
  })

  handlers.set('payment', async ctx => {
    await ctx.edit(
      '<b>Payment</b>\n\n' +
        '💳 Payment options:\n' +
        '• Credit card\n' +
        '• Telegram Stars\n' +
        '• Cryptocurrency\n\n' +
        '<i>Payment feature coming soon...</i>',
      {
        replyMarkup: {
          inline_keyboard: [[{ text: '« Back', callback_data: 'main_menu' }]]
        }
      }
    )
    await ctx.answer()
  })

  // Settings callbacks
  handlers.set('settings:language', async ctx => {
    await ctx.edit('<b>Language Settings</b>\n\n' + 'Select your preferred language:', {
      replyMarkup: {
        inline_keyboard: [
          [{ text: '🇬🇧 English', callback_data: 'set_language:en' }],
          [{ text: '🇪🇸 Español', callback_data: 'set_language:es' }],
          [{ text: '🇫🇷 Français', callback_data: 'set_language:fr' }],
          [{ text: '🇩🇪 Deutsch', callback_data: 'set_language:de' }],
          [{ text: '🇷🇺 Русский', callback_data: 'set_language:ru' }],
          [{ text: '« Back', callback_data: 'settings' }]
        ]
      }
    })
    await ctx.answer()
  })

  handlers.set('settings:notifications', async ctx => {
    await ctx.edit(
      '<b>Notification Settings</b>\n\n' +
        '🔔 Notifications are currently: <b>ON</b>\n\n' +
        'Toggle notifications for updates and alerts:',
      {
        replyMarkup: {
          inline_keyboard: [
            [{ text: '🔕 Turn OFF', callback_data: 'toggle_notifications:off' }],
            [{ text: '« Back', callback_data: 'settings' }]
          ]
        }
      }
    )
    await ctx.answer()
  })

  handlers.set('settings:clear_data', async ctx => {
    await ctx.edit(
      '<b>Clear Data</b>\n\n' +
        '⚠️ This will delete all your data including:\n' +
        '• Settings\n' +
        '• History\n' +
        '• Preferences\n\n' +
        'Are you sure?',
      {
        replyMarkup: {
          inline_keyboard: [
            [
              { text: '✅ Yes, clear', callback_data: 'confirm_clear_data' },
              { text: '❌ Cancel', callback_data: 'settings' }
            ]
          ]
        }
      }
    )
    await ctx.answer()
  })

  handlers.set('confirm_clear_data', async ctx => {
    await ctx.edit('✅ <b>Data cleared successfully!</b>\n\n' + 'All your data has been removed.', {
      replyMarkup: {
        inline_keyboard: [[{ text: '« Back to Settings', callback_data: 'settings' }]]
      }
    })
    await ctx.answer('Data cleared!')
  })

  // Language handlers with regex pattern support
  handlers.set('set_language:en', async ctx => {
    await ctx.edit('✅ Language set to English')
    await ctx.answer('Language updated!')
  })

  handlers.set('set_language:es', async ctx => {
    await ctx.edit('✅ Idioma establecido en Español')
    await ctx.answer('¡Idioma actualizado!')
  })

  handlers.set('set_language:fr', async ctx => {
    await ctx.edit('✅ Langue définie sur Français')
    await ctx.answer('Langue mise à jour!')
  })

  handlers.set('set_language:de', async ctx => {
    await ctx.edit('✅ Sprache auf Deutsch eingestellt')
    await ctx.answer('Sprache aktualisiert!')
  })

  handlers.set('set_language:ru', async ctx => {
    await ctx.edit('✅ Язык установлен на Русский')
    await ctx.answer('Язык обновлен!')
  })

  // Notification toggle handlers
  handlers.set('toggle_notifications:off', async ctx => {
    await ctx.edit('<b>Notification Settings</b>\n\n' + '🔕 Notifications are now: <b>OFF</b>', {
      replyMarkup: {
        inline_keyboard: [
          [{ text: '🔔 Turn ON', callback_data: 'toggle_notifications:on' }],
          [{ text: '« Back', callback_data: 'settings' }]
        ]
      }
    })
    await ctx.answer('Notifications disabled')
  })

  handlers.set('toggle_notifications:on', async ctx => {
    await ctx.edit('<b>Notification Settings</b>\n\n' + '🔔 Notifications are now: <b>ON</b>', {
      replyMarkup: {
        inline_keyboard: [
          [{ text: '🔕 Turn OFF', callback_data: 'toggle_notifications:off' }],
          [{ text: '« Back', callback_data: 'settings' }]
        ]
      }
    })
    await ctx.answer('Notifications enabled')
  })

  // Access control callbacks (simplified for now)
  handlers.set('access:request', async ctx => {
    await ctx.edit(
      '<b>Access Request</b>\n\n' +
        'Request access to premium features.\n\n' +
        '<i>Access control coming soon...</i>',
      {
        replyMarkup: {
          inline_keyboard: [[{ text: '« Back', callback_data: 'main_menu' }]]
        }
      }
    )
    await ctx.answer()
  })

  handlers.set('access:status', async ctx => {
    await ctx.edit(
      '<b>Access Status</b>\n\n' +
        'Your current access level: Basic\n\n' +
        '<i>Access control coming soon...</i>',
      {
        replyMarkup: {
          inline_keyboard: [[{ text: '« Back', callback_data: 'main_menu' }]]
        }
      }
    )
    await ctx.answer()
  })

  return handlers
}

/**
 * Setup callbacks with new TelegramConnector architecture
 */
export function setupCallbacksWithConnector(callbackHandler: TelegramCallbackHandler): void {
  // Create all callback handlers
  const handlers = createCallbackHandlers()

  // Register each handler
  handlers.forEach((handler, action) => {
    callbackHandler.register(action, handler)
  })

  // Register regex patterns for dynamic callbacks
  // For now, we'll handle these with exact matches created above
  // In the future, we can add regex support to the callback handler
}
