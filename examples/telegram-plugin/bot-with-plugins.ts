import { CoreBot } from '../../src/core/bot.js'
import { EventBus } from '../../src/core/events/event-bus.js'
import { PluginManager } from '../../src/core/plugins/plugin-manager.js'
import { TelegramAdapter } from '../../src/core/telegram-adapter.js'
import { logger } from '../../src/lib/logger.js'
import type { Env } from '../../src/types/env.js'
import createReminderPlugin from './reminder-plugin.js'

/**
 * Example: Telegram Bot with Plugin System
 *
 * This example shows how to use the plugin system to extend
 * your Telegram bot with modular functionality.
 */

// Mock storage factory for plugins
const createPluginStorage = (pluginId: string, env: Env) => {
  const prefix = `plugin:${pluginId}:`

  return {
    async get<T = unknown>(key: string): Promise<T | null> {
      try {
        const value = await env.KV_CACHE.get(`${prefix}${key}`)
        return value ? JSON.parse(value) : null
      } catch {
        return null
      }
    },

    async set<T = unknown>(key: string, value: T): Promise<void> {
      await env.KV_CACHE.put(`${prefix}${key}`, JSON.stringify(value))
    },

    async delete(key: string): Promise<void> {
      await env.KV_CACHE.delete(`${prefix}${key}`)
    },

    async has(key: string): Promise<boolean> {
      const value = await env.KV_CACHE.get(`${prefix}${key}`)
      return value !== null
    },

    async clear(): Promise<void> {
      // This would need to be implemented with list operations
      logger.warn('Plugin storage clear not implemented')
    },

    async keys(): Promise<string[]> {
      // This would need to be implemented with list operations
      return []
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // Initialize core components
      const eventBus = new EventBus({ debug: env.ENVIRONMENT === 'development' })
      const adapter = new TelegramAdapter(env)
      const bot = new CoreBot(env, adapter)

      // Initialize plugin manager
      const pluginManager = new PluginManager(
        eventBus,
        logger,
        pluginId => createPluginStorage(pluginId, env),
        '/tmp/plugins' // Data directory (not used in Workers)
      )

      // Install and activate plugins
      const reminderPlugin = createReminderPlugin()
      await pluginManager.install(reminderPlugin, {
        maxRemindersPerUser: 10,
        maxReminderDays: 30
      })
      await pluginManager.activate(reminderPlugin.id)

      // Register plugin commands with the bot
      const pluginCommands = pluginManager.getCommands()
      pluginCommands.forEach(cmd => {
        bot.command(cmd.name, async ctx => {
          const args = ctx.match || ''
          await cmd.handler(args, {
            sender: ctx.from,
            args: { text: args },
            reply: async (message: string) => {
              await ctx.reply(message)
            },
            plugin: pluginManager['createPluginContext'](reminderPlugin, {})
          })
        })

        // Register aliases
        cmd.aliases?.forEach(alias => {
          bot.command(alias, async ctx => {
            const args = ctx.match || ''
            await cmd.handler(args, {
              sender: ctx.from,
              args: { text: args },
              reply: async (message: string) => {
                await ctx.reply(message)
              },
              plugin: pluginManager['createPluginContext'](reminderPlugin, {})
            })
          })
        })
      })

      // Listen to plugin events
      eventBus.on('reminder:triggered', async event => {
        logger.info('Reminder triggered:', event.payload)
      })

      // Add plugin management commands
      bot.command('plugins', async ctx => {
        const plugins = pluginManager.getAll()
        const activePlugins = pluginManager.getActive()

        const pluginList = plugins
          .map(p => {
            const isActive = activePlugins.includes(p)
            const status = isActive ? '✅' : '❌'
            return `${status} ${p.name} v${p.version}`
          })
          .join('\n')

        await ctx.reply(
          `🔌 **Installed Plugins:**\n\n${pluginList}\n\n` +
            `Total: ${plugins.length} | Active: ${activePlugins.length}`,
          { parse_mode: 'Markdown' }
        )
      })

      bot.command('plugin_info', async ctx => {
        const pluginName = ctx.match
        if (!pluginName) {
          await ctx.reply('Usage: /plugin_info [plugin-name]')
          return
        }

        const plugin = pluginManager.get(pluginName)
        if (!plugin) {
          await ctx.reply(`❌ Plugin "${pluginName}" not found`)
          return
        }

        const isActive = pluginManager.isActive(plugin.id)
        const commands = plugin.getCommands?.() || []

        await ctx.reply(
          `🔌 **Plugin Information**\n\n` +
            `**Name:** ${plugin.name}\n` +
            `**ID:** ${plugin.id}\n` +
            `**Version:** ${plugin.version}\n` +
            `**Status:** ${isActive ? '✅ Active' : '❌ Inactive'}\n` +
            `**Description:** ${plugin.description}\n` +
            `**Commands:** ${commands.map(c => `/${c.name}`).join(', ') || 'None'}\n` +
            `**Author:** ${plugin.author || 'Unknown'}`,
          { parse_mode: 'Markdown' }
        )
      })

      // Enhanced help command showing plugin commands
      bot.command('help', async ctx => {
        const coreCommands = [
          '/start - Start the bot',
          '/help - Show this help menu',
          '/plugins - List installed plugins',
          '/plugin_info [name] - Get plugin details'
        ]

        const pluginCommands = pluginManager
          .getCommands()
          .map(cmd => `/${cmd.name} - ${cmd.description}`)
          .sort()

        let helpText = '📚 **Available Commands**\n\n'
        helpText += '**Core Commands:**\n' + coreCommands.join('\n')

        if (pluginCommands.length > 0) {
          helpText += '\n\n**Plugin Commands:**\n' + pluginCommands.join('\n')
        }

        await ctx.reply(helpText, { parse_mode: 'Markdown' })
      })

      // Handle the update
      return await bot.handleUpdate(request)
    } catch (error) {
      logger.error('Bot error:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  },

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    logger.info('Running scheduled task', { cron: event.cron })

    // Plugin system could handle scheduled tasks too
    const eventBus = new EventBus()
    eventBus.emit(
      'scheduled:task',
      {
        cron: event.cron,
        timestamp: Date.now()
      },
      'scheduler'
    )
  }
}
