/**
 * Settings Plugin
 * Provides user settings and preferences management
 */

import type { Plugin, PluginCommand, PluginContext } from '../core/plugins/plugin'
import type { CommandArgs } from '../types/command-args'

interface UserSettings {
  language: string
  notifications: boolean
  theme: 'light' | 'dark'
  timezone: string
}

export class SettingsPlugin implements Plugin {
  id = 'settings-plugin'
  name = 'Settings Plugin'
  version = '1.0.0'
  description = 'Manages user settings and preferences'
  author = 'Wireframe Team'
  homepage = 'https://github.com/yourusername/wireframe'

  private context?: PluginContext
  private defaultSettings: UserSettings = {
    language: 'en',
    notifications: true,
    theme: 'light',
    timezone: 'UTC'
  }

  /**
   * Install the plugin
   */
  async install(context: PluginContext): Promise<void> {
    this.context = context

    // Register settings command
    const settingsCommand: PluginCommand = {
      name: 'settings',
      description: 'Bot settings',
      aliases: ['preferences', 'config'],
      handler: async (_args, commandContext) => {
        const userId = commandContext.sender.id
        const settings = await this.getUserSettings(userId)

        await commandContext.reply(
          `⚙️ <b>Your Settings</b>\n\n` +
            `🌐 Language: ${this.getLanguageName(settings.language)}\n` +
            `🔔 Notifications: ${settings.notifications ? 'ON' : 'OFF'}\n` +
            `🎨 Theme: ${settings.theme}\n` +
            `🕐 Timezone: ${settings.timezone}\n\n` +
            `Use the buttons below to change your settings:`
        )

        // Emit event to show settings menu
        context.eventBus.emit(
          'settings:show_menu',
          {
            userId,
            currentSettings: settings
          },
          this.id
        )
      }
    }

    // Register language command
    const languageCommand: PluginCommand = {
      name: 'language',
      description: 'Change bot language',
      aliases: ['lang'],
      handler: async (args, commandContext) => {
        const langCode = (args as CommandArgs)._positional?.[0]

        if (!langCode) {
          await commandContext.reply(
            '🌐 <b>Available Languages:</b>\n\n' +
              '• <code>en</code> - English\n' +
              '• <code>es</code> - Español\n' +
              '• <code>fr</code> - Français\n' +
              '• <code>de</code> - Deutsch\n' +
              '• <code>ru</code> - Русский\n\n' +
              'Usage: <code>/language en</code>'
          )
          return
        }

        const userId = commandContext.sender.id
        await this.updateUserSetting(userId, 'language', langCode)

        await commandContext.reply(`✅ Language changed to ${this.getLanguageName(langCode)}`)
      }
    }

    context.commands.set('settings', settingsCommand)
    context.commands.set('language', languageCommand)

    // Listen for settings events
    context.eventBus.on('settings:update', async event => {
      const payload = event.payload as {
        userId: string
        setting: keyof UserSettings
        value: unknown
      }
      await this.updateUserSetting(payload.userId, payload.setting, payload.value)
    })

    // Register callback handlers
    this.registerCallbackHandlers()
  }

  /**
   * Get user settings
   */
  private async getUserSettings(userId: string): Promise<UserSettings> {
    if (!this.context) return this.defaultSettings

    const key = `settings:${userId}`
    const settings = await this.context.storage.get<Partial<UserSettings>>(key)

    return {
      ...this.defaultSettings,
      ...(settings || {})
    }
  }

  /**
   * Update user setting
   */
  private async updateUserSetting(
    userId: string,
    setting: keyof UserSettings,
    value: unknown
  ): Promise<void> {
    if (!this.context) return

    const settings = await this.getUserSettings(userId)
    // Type-safe setting update
    const mutableSettings = settings as Record<keyof UserSettings, unknown>
    mutableSettings[setting] = value

    const key = `settings:${userId}`
    await this.context.storage.set(key, settings)

    // Emit setting changed event
    this.context.eventBus.emit(
      'settings:changed',
      {
        userId,
        setting,
        value,
        allSettings: settings
      },
      this.id
    )

    this.context.logger.info('User setting updated', {
      userId,
      setting,
      value
    })
  }

  /**
   * Register callback handlers for settings
   */
  private registerCallbackHandlers(): void {
    if (!this.context) return

    // Language selection callbacks
    const languages = ['en', 'es', 'fr', 'de', 'ru']
    languages.forEach(lang => {
      this.context?.eventBus.on(`telegram:callback:set_language:${lang}`, async event => {
        const payload = event.payload as { from: { id: number } }
        await this.updateUserSetting(payload.from.id.toString(), 'language', lang)
      })
    })

    // Notification toggle callbacks
    this.context.eventBus.on('telegram:callback:toggle_notifications:on', async event => {
      const payload = event.payload as { from: { id: number } }
      await this.updateUserSetting(payload.from.id.toString(), 'notifications', true)
    })

    this.context.eventBus.on('telegram:callback:toggle_notifications:off', async event => {
      const payload = event.payload as { from: { id: number } }
      await this.updateUserSetting(payload.from.id.toString(), 'notifications', false)
    })
  }

  /**
   * Get language display name
   */
  private getLanguageName(code: string): string {
    const languages: Record<string, string> = {
      en: 'English 🇬🇧',
      es: 'Español 🇪🇸',
      fr: 'Français 🇫🇷',
      de: 'Deutsch 🇩🇪',
      ru: 'Русский 🇷🇺'
    }

    return languages[code] || code
  }

  /**
   * Activate the plugin
   */
  async activate(): Promise<void> {
    this.context?.logger.info('Settings plugin activated')
  }

  /**
   * Deactivate the plugin
   */
  async deactivate(): Promise<void> {
    this.context?.logger.info('Settings plugin deactivated')
  }

  /**
   * Uninstall the plugin
   */
  async uninstall(): Promise<void> {
    // Remove commands
    this.context?.commands.delete('settings')
    this.context?.commands.delete('language')

    // Remove event listeners
    this.context?.eventBus.off('settings:update')

    this.context?.logger.info('Settings plugin uninstalled')
  }

  /**
   * Get plugin commands
   */
  getCommands(): PluginCommand[] {
    const commands: PluginCommand[] = []

    const settingsCommand = this.context?.commands.get('settings')
    if (settingsCommand) commands.push(settingsCommand)

    const languageCommand = this.context?.commands.get('language')
    if (languageCommand) commands.push(languageCommand)

    return commands
  }
}
