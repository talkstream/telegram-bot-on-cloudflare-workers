import { logger } from '@/lib/logger'
import type { CallbackHandler } from '@/types'

export const languageSettingCallback: CallbackHandler = async ctx => {
  await ctx.answerCallbackQuery()

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'zh', name: '中文', flag: '🇨🇳' }
  ]

  await ctx.editMessageText('🌐 *Select your language:*', {
    parse_mode: 'MarkdownV2',
    reply_markup: {
      inline_keyboard: [
        ...languages.map(lang => [
          {
            text: `${lang.flag} ${lang.name}`,
            callback_data: `set_language:${lang.code}`
          }
        ]),
        [{ text: '🔙 Back', callback_data: 'settings' }]
      ]
    }
  })
}

export const setLanguageCallback: CallbackHandler = async ctx => {
  const data = ctx.callbackQuery?.data
  const languageCode = data?.split(':')[1]

  if (!languageCode) {
    await ctx.answerCallbackQuery('Invalid language selection')
    return
  }

  // Save language preference
  ctx.session.languageCode = languageCode

  await ctx.answerCallbackQuery('✅ Language updated')

  // Return to settings
  const { settingsCallback } = await import('./menu')
  await settingsCallback(ctx)

  logger.info('Language changed', {
    userId: ctx.from?.id,
    language: languageCode
  })
}

export const notificationSettingCallback: CallbackHandler = async ctx => {
  await ctx.answerCallbackQuery()

  const currentState = ctx.session.customData?.notifications ?? true

  await ctx.editMessageText(
    `🔔 *Notifications*\n\nCurrent status: ${currentState ? 'Enabled ✅' : 'Disabled ❌'}\n\nToggle notifications on or off:`,
    {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: currentState ? '🔕 Disable' : '🔔 Enable',
              callback_data: `toggle_notifications:${!currentState}`
            }
          ],
          [{ text: '🔙 Back', callback_data: 'settings' }]
        ]
      }
    }
  )
}

export const toggleNotificationsCallback: CallbackHandler = async ctx => {
  const data = ctx.callbackQuery?.data
  const enable = data?.split(':')[1] === 'true'

  // Save notification preference
  if (!ctx.session.customData) {
    ctx.session.customData = {}
  }
  ctx.session.customData.notifications = enable

  await ctx.answerCallbackQuery(enable ? '✅ Notifications enabled' : '🔕 Notifications disabled')

  // Refresh the notification settings page
  await notificationSettingCallback(ctx)

  logger.info('Notifications toggled', {
    userId: ctx.from?.id,
    enabled: enable
  })
}

export const clearDataCallback: CallbackHandler = async ctx => {
  await ctx.answerCallbackQuery()

  await ctx.editMessageText(
    '⚠️ *Clear Data*\\n\\nAre you sure you want to clear all your data?\\n\\nThis action cannot be undone\\!',
    {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Yes, clear', callback_data: 'confirm_clear_data' },
            { text: '❌ Cancel', callback_data: 'settings' }
          ]
        ]
      }
    }
  )
}

export const confirmClearDataCallback: CallbackHandler = async ctx => {
  const userId = ctx.from?.id

  if (!userId) {
    await ctx.answerCallbackQuery('Unable to identify user')
    return
  }

  try {
    // Clear session data
    ctx.session = undefined

    // TODO: Clear user data from database
    // await getUserService(ctx.env).deleteUserData(userId);

    await ctx.answerCallbackQuery('✅ Data cleared successfully')

    await ctx.editMessageText(
      '✅ *Data Cleared*\\n\\nAll your data has been cleared\\. Use /start to begin again\\.',
      {
        parse_mode: 'MarkdownV2'
      }
    )

    logger.info('User data cleared', { userId })
  } catch (error) {
    logger.error('Error clearing user data', { error, userId })
    await ctx.answerCallbackQuery('❌ Failed to clear data')
  }
}
