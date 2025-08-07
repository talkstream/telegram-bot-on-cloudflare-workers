/**
 * Command handler for Telegram connector
 */

import type { Bot } from 'grammy'

import type { EventBus } from '../../../../core/events/event-bus.js'
import { CommonEventType } from '../../../../core/events/event-bus.js'
import type { PluginCommand, PluginContext } from '../../../../core/plugins/plugin.js'
import type { TelegramContext } from '../types.js'

/**
 * Command handler that integrates with plugin system
 */
export class TelegramCommandHandler {
  constructor(
    private eventBus: EventBus,
    private commands: Map<string, PluginCommand>
  ) {}

  /**
   * Handle command from Telegram
   */
  async handleCommand(ctx: TelegramContext, commandName: string): Promise<void> {
    const command = this.commands.get(commandName)

    if (!command) {
      await ctx.reply('Unknown command. Type /help for available commands.')
      return
    }

    try {
      // Extract arguments
      const text = ctx.message?.text || ''
      const args = this.parseCommandArgs(text, commandName)

      // Create command context
      const commandContext = {
        sender: {
          id: ctx.from?.id.toString() || 'unknown',
          username: ctx.from?.username,
          firstName: ctx.from?.first_name,
          lastName: ctx.from?.last_name
        },
        args,
        reply: async (message: string) => {
          await ctx.reply(message, { parse_mode: 'HTML' })
        },
        plugin: {
          eventBus: this.eventBus
        } as PluginContext // Plugin context would be injected by plugin manager
      }

      // Execute command
      await command.handler(args, commandContext)

      // Emit event
      this.eventBus.emit(
        CommonEventType.COMMAND_EXECUTED,
        {
          command: commandName,
          args,
          sender: commandContext.sender
        },
        'TelegramCommandHandler'
      )
    } catch (error) {
      this.eventBus.emit(
        CommonEventType.COMMAND_ERROR,
        {
          command: commandName,
          error: error instanceof Error ? error.message : 'Command execution failed'
        },
        'TelegramCommandHandler'
      )

      await ctx.reply('❌ An error occurred while executing the command.')
    }
  }

  /**
   * Register all commands with bot
   */
  registerCommands(bot: Bot<TelegramContext>): void {
    this.commands.forEach((command, name) => {
      bot.command(name, async ctx => {
        await this.handleCommand(ctx as TelegramContext, name)
      })

      // Register aliases
      command.aliases?.forEach(alias => {
        bot.command(alias, async ctx => {
          await this.handleCommand(ctx as TelegramContext, name)
        })
      })
    })
  }

  /**
   * Parse command arguments
   */
  private parseCommandArgs(text: string, commandName: string): Record<string, unknown> {
    // Remove command from text
    const argString = text.replace(`/${commandName}`, '').trim()

    // Simple argument parsing (can be enhanced)
    const args: Record<string, unknown> = {
      _raw: argString
    }

    // Parse key=value pairs
    const matches = argString.matchAll(/(\w+)=([^\s]+)/g)
    for (const match of matches) {
      if (match[1]) {
        args[match[1]] = match[2]
      }
    }

    // Parse positional arguments
    const positional = argString
      .replace(/\w+=\S+/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)

    if (positional.length > 0) {
      args._positional = positional
    }

    return args
  }
}

/**
 * Create default commands
 */
export function createDefaultCommands(): PluginCommand[] {
  return [
    {
      name: 'start',
      description: 'Start the bot',
      handler: async (_args, ctx) => {
        await ctx.reply(
          '<b>Welcome to Wireframe Bot!</b>\n\n' +
            'This bot is built using the Wireframe platform - ' +
            'a universal framework for AI assistants.\n\n' +
            'Type /help to see available commands.'
        )
      }
    },
    {
      name: 'help',
      description: 'Show help message',
      handler: async (_args, ctx) => {
        const commands = [
          '/start - Start the bot',
          '/help - Show this help message',
          '/info - Show bot information'
        ]

        await ctx.reply('<b>Available Commands:</b>\n\n' + commands.join('\n'))
      }
    },
    {
      name: 'info',
      description: 'Show bot information',
      handler: async (_args, ctx) => {
        await ctx.reply(
          '<b>Bot Information</b>\n\n' +
            '🤖 <b>Platform:</b> Wireframe v1.2\n' +
            '💬 <b>Connector:</b> Telegram\n' +
            '⚡ <b>Runtime:</b> Cloudflare Workers\n' +
            '🔧 <b>Architecture:</b> Event-driven with plugins\n\n' +
            '<i>Built with TypeScript and 100% type safety</i>'
        )
      }
    }
  ]
}
