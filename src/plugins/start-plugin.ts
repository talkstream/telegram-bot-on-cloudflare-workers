/**
 * Start command plugin
 * Handles the /start command for new users
 */

import type { Plugin, PluginCommand, PluginContext } from '../core/plugins/plugin'

export class StartPlugin implements Plugin {
  id = 'start-plugin'
  name = 'Start Command Plugin'
  version = '1.0.0'
  description = 'Handles the /start command for new users'
  author = 'Wireframe Team'
  homepage = 'https://github.com/yourusername/wireframe'

  private context?: PluginContext

  /**
   * Install the plugin
   */
  async install(context: PluginContext): Promise<void> {
    this.context = context

    // Register the start command
    const startCommand: PluginCommand = {
      name: 'start',
      description: 'Start the bot',
      handler: async (_args, commandContext) => {
        const userId = commandContext.sender.id
        const userName = commandContext.sender.firstName || 'there'

        // Emit event for new user
        context.eventBus.emit(
          'user:started',
          {
            userId,
            timestamp: Date.now()
          },
          this.id
        )

        // Send welcome message
        await commandContext.reply(
          `<b>Welcome to Wireframe Bot, ${userName}!</b> 🎉\n\n` +
            `I'm a powerful AI assistant built with the Wireframe platform.\n\n` +
            `Here's what I can do:\n` +
            `• 🤖 Answer questions using AI\n` +
            `• 💬 Have conversations\n` +
            `• 📊 Track statistics\n` +
            `• 💰 Handle payments\n` +
            `• ⚙️ Customize settings\n\n` +
            `Type /help to see all available commands.`
        )

        // Log analytics
        context.logger.info('User started bot', {
          userId,
          userName
        })

        // Check if user exists in storage
        const userData = await context.storage.get(`user:${userId}`)
        if (!userData) {
          // First time user
          await context.storage.set(`user:${userId}`, {
            id: userId,
            firstName: commandContext.sender.firstName,
            lastName: commandContext.sender.lastName,
            username: commandContext.sender.username,
            firstSeen: Date.now(),
            lastSeen: Date.now()
          })

          // Emit first time user event
          context.eventBus.emit(
            'user:first_time',
            {
              userId,
              userData: commandContext.sender
            },
            this.id
          )
        } else {
          // Returning user
          await context.storage.set(`user:${userId}`, {
            ...userData,
            lastSeen: Date.now()
          })
        }
      }
    }

    context.commands.set('start', startCommand)

    // Listen for user events
    context.eventBus.on('user:started', async _event => {
      // Track user starts
      const stats = (await context.storage.get<{ total: number }>('plugin:start:stats')) || {
        total: 0
      }
      stats.total += 1
      await context.storage.set('plugin:start:stats', stats)
    })
  }

  /**
   * Activate the plugin
   */
  async activate(): Promise<void> {
    this.context?.logger.info('Start plugin activated')
  }

  /**
   * Deactivate the plugin
   */
  async deactivate(): Promise<void> {
    this.context?.logger.info('Start plugin deactivated')
  }

  /**
   * Uninstall the plugin
   */
  async uninstall(): Promise<void> {
    // Remove command
    this.context?.commands.delete('start')

    // Remove event listeners
    this.context?.eventBus.off('user:started')

    this.context?.logger.info('Start plugin uninstalled')
  }

  /**
   * Get plugin commands
   */
  getCommands(): PluginCommand[] {
    const startCommand = this.context?.commands.get('start')
    return startCommand ? [startCommand] : []
  }
}
