/**
 * Command Router Pattern
 *
 * This pattern demonstrates the flexible command routing system used in the
 * Telegram Bot Cloudflare Workers Wireframe. It shows how to organize commands
 * with support for subcommands, aliases, permissions, and dynamic loading.
 *
 * Files in wireframe using this pattern:
 * - /src/adapters/telegram/commands/index.ts - Command registration
 * - /src/core/telegram-adapter.ts - Command routing implementation
 * - /src/adapters/telegram/commands/owner/admin.ts - Subcommand example
 * - /src/adapters/telegram/commands/owner/debug.ts - Permission-based commands
 *
 * Key features demonstrated:
 * 1. Modular command organization
 * 2. Subcommand support (e.g., /admin add, /admin remove)
 * 3. Permission-based access control
 * 4. Command aliases for user convenience
 * 5. Dynamic command loading and registration
 */

// Command Registry
export class CommandRouter {
  constructor(bot, options = {}) {
    this.bot = bot
    this.commands = new Map()
    this.aliases = new Map()
    this.middleware = []
    this.options = {
      prefix: '/',
      caseSensitive: false,
      defaultCommand: 'help',
      ...options
    }
  }

  // Register a command
  register(command, handler, options = {}) {
    const cmd = this.normalizeCommand(command)

    this.commands.set(cmd, {
      handler,
      description: options.description || '',
      usage: options.usage || `/${command}`,
      aliases: options.aliases || [],
      permissions: options.permissions || [],
      hidden: options.hidden || false,
      category: options.category || 'general',
      middleware: options.middleware || []
    })

    // Register aliases
    if (options.aliases) {
      options.aliases.forEach(alias => {
        this.aliases.set(this.normalizeCommand(alias), cmd)
      })
    }

    // Register with bot
    this.bot.command(command, ...this.middleware, ...options.middleware, handler)

    return this
  }

  // Register multiple commands from a module
  registerModule(module) {
    Object.entries(module).forEach(([name, config]) => {
      if (typeof config === 'function') {
        this.register(name, config)
      } else {
        this.register(name, config.handler, config)
      }
    })

    return this
  }

  // Add global middleware
  use(middleware) {
    this.middleware.push(middleware)
    return this
  }

  // Get command info
  getCommand(command) {
    const cmd = this.normalizeCommand(command)
    return this.commands.get(cmd) || this.commands.get(this.aliases.get(cmd))
  }

  // List all commands
  list(options = {}) {
    const { category, includeHidden = false } = options

    return Array.from(this.commands.entries())
      .filter(([_, cmd]) => {
        if (!includeHidden && cmd.hidden) return false
        if (category && cmd.category !== category) return false
        return true
      })
      .map(([name, cmd]) => ({
        name,
        ...cmd
      }))
  }

  // Generate help text
  generateHelp(ctx, category = null) {
    const commands = this.list({ category })
    const categories = {}

    // Group by category
    commands.forEach(cmd => {
      if (!categories[cmd.category]) {
        categories[cmd.category] = []
      }
      categories[cmd.category].push(cmd)
    })

    // Build help text
    let help = '📚 **Available Commands**\n\n'

    Object.entries(categories).forEach(([cat, cmds]) => {
      help += `**${this.formatCategory(cat)}**\n`
      cmds.forEach(cmd => {
        help += `• \`${cmd.usage}\` - ${cmd.description}\n`
      })
      help += '\n'
    })

    return help
  }

  // Normalize command name
  normalizeCommand(command) {
    let cmd = command.replace(this.options.prefix, '')
    if (!this.options.caseSensitive) {
      cmd = cmd.toLowerCase()
    }
    return cmd
  }

  // Format category name
  formatCategory(category) {
    return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ')
  }
}

// Command with Subcommands Pattern
export class SubcommandRouter {
  constructor(name, options = {}) {
    this.name = name
    this.subcommands = new Map()
    this.defaultSubcommand = options.defaultSubcommand || 'help'
    this.options = options
  }

  // Add subcommand
  on(subcommand, handler, options = {}) {
    this.subcommands.set(subcommand, {
      handler,
      ...options
    })
    return this
  }

  // Create the main handler
  handler() {
    return async ctx => {
      const args = ctx.match?.trim().split(/\s+/) || []
      const subcommand = args[0] || this.defaultSubcommand

      const sub = this.subcommands.get(subcommand)
      if (!sub) {
        return this.handleUnknownSubcommand(ctx, subcommand)
      }

      // Check permissions
      if (sub.permissions) {
        const hasPermission = await this.checkPermissions(ctx, sub.permissions)
        if (!hasPermission) {
          return ctx.reply("🚫 You don't have permission to use this command.")
        }
      }

      // Update context with parsed arguments
      ctx.args = args.slice(1)
      ctx.subcommand = subcommand

      // Execute handler
      return sub.handler(ctx)
    }
  }

  // Handle unknown subcommand
  async handleUnknownSubcommand(ctx, subcommand) {
    const available = Array.from(this.subcommands.keys())
      .filter(key => !this.subcommands.get(key).hidden)
      .join(', ')

    return ctx.reply(
      `❓ Unknown subcommand: ${subcommand}\n\n` +
        `Available subcommands: ${available}\n` +
        `Use \`/${this.name} help\` for more information.`,
      { parse_mode: 'Markdown' }
    )
  }

  // Check permissions
  async checkPermissions(ctx, permissions) {
    for (const permission of permissions) {
      if (typeof permission === 'function') {
        const allowed = await permission(ctx)
        if (!allowed) return false
      }
    }
    return true
  }

  // Generate help for subcommands
  generateHelp() {
    let help = `📋 **${this.name} commands**\n\n`

    this.subcommands.forEach((sub, name) => {
      if (!sub.hidden) {
        help += `• \`/${this.name} ${name}\``
        if (sub.usage) help += ` ${sub.usage}`
        if (sub.description) help += ` - ${sub.description}`
        help += '\n'
      }
    })

    return help
  }
}

// Dynamic Command Loading
export async function loadCommands(router, directory) {
  // Implementation would need to include file system operations
  // This is a conceptual example
  const getCommandFiles = async _dir => {
    // Return array of command file paths
    return []
  }

  const getCommandName = filePath => {
    // Extract command name from file path
    return filePath.split('/').pop().replace('.js', '')
  }

  const commandFiles = await getCommandFiles(directory)

  for (const file of commandFiles) {
    const module = await import(file)
    const commandName = getCommandName(file)

    if (module.default) {
      router.register(commandName, module.default, module.config || {})
    } else if (module.command) {
      router.register(commandName, module.command, module.config || {})
    }
  }
}

// Permission Middleware
export const permissions = {
  owner: ctx => {
    const ownerIds = ctx.env.BOT_OWNER_IDS?.split(',').map(id => parseInt(id)) || []
    return ownerIds.includes(ctx.from?.id)
  },

  admin: ctx => {
    const adminIds = ctx.env.BOT_ADMIN_IDS?.split(',').map(id => parseInt(id)) || []
    const ownerIds = ctx.env.BOT_OWNER_IDS?.split(',').map(id => parseInt(id)) || []
    return [...ownerIds, ...adminIds].includes(ctx.from?.id)
  },

  user: async ctx => {
    // Check if user has access
    if (!ctx.env.DB) return true // No DB, allow all

    const result = await ctx.env.DB.prepare(
      'SELECT role FROM user_roles WHERE user_id = (SELECT id FROM users WHERE telegram_id = ?)'
    )
      .bind(ctx.from?.id)
      .first()

    return result !== null
  },

  private: ctx => ctx.chat?.type === 'private',

  group: ctx => ['group', 'supergroup'].includes(ctx.chat?.type),

  custom: checkFn => checkFn
}

// Command Parsing Utilities
export function parseCommand(text) {
  const match = text.match(/^\/([^\s@]+)(?:@(\S+))?\s*(.*)?$/)
  if (!match) return null

  return {
    command: match[1],
    botUsername: match[2],
    args: match[3]?.trim() || '',
    argsArray: match[3]?.trim().split(/\s+/).filter(Boolean) || []
  }
}

// Argument Parser
export class ArgumentParser {
  constructor(args) {
    this.args = Array.isArray(args) ? args : args.split(/\s+/).filter(Boolean)
    this.position = 0
  }

  // Get positional argument
  get(index) {
    return this.args[index]
  }

  // Get all remaining arguments
  rest() {
    return this.args.slice(this.position).join(' ')
  }

  // Parse flags
  flags() {
    const flags = {}
    const positional = []

    for (let i = 0; i < this.args.length; i++) {
      const arg = this.args[i]

      if (arg.startsWith('--')) {
        const key = arg.slice(2)
        const next = this.args[i + 1]

        if (next && !next.startsWith('-')) {
          flags[key] = next
          i++
        } else {
          flags[key] = true
        }
      } else if (arg.startsWith('-')) {
        const chars = arg.slice(1).split('')
        chars.forEach(char => {
          flags[char] = true
        })
      } else {
        positional.push(arg)
      }
    }

    return { flags, positional }
  }
}

// Usage Examples
/*
// Basic Setup
const router = new CommandRouter(bot, {
  defaultCommand: 'start'
});

// Register commands with options
router
  .register('start', startCommand, {
    description: 'Start the bot',
    category: 'basic'
  })
  .register('help', helpCommand, {
    description: 'Show help message',
    aliases: ['h', '?'],
    category: 'basic'
  })
  .register('admin', adminCommand, {
    description: 'Admin panel',
    permissions: [permissions.admin],
    hidden: true,
    category: 'admin'
  });

// Subcommands
const settingsRouter = new SubcommandRouter('settings');

settingsRouter
  .on('show', async (ctx) => {
    await ctx.reply('Current settings: ...');
  })
  .on('language', async (ctx) => {
    const lang = ctx.args[0];
    await ctx.reply(`Language set to: ${lang}`);
  })
  .on('help', async (ctx) => {
    await ctx.reply(settingsRouter.generateHelp());
  });

router.register('settings', settingsRouter.handler(), {
  description: 'Bot settings',
  usage: '/settings <subcommand>'
});

// Dynamic help command
router.register('help', async (ctx) => {
  const category = ctx.args[0];
  const help = router.generateHelp(ctx, category);
  await ctx.reply(help, { parse_mode: 'Markdown' });
});

// Argument parsing example
router.register('remind', async (ctx) => {
  const parser = new ArgumentParser(ctx.match);
  const { flags, positional } = parser.flags();
  
  const time = positional[0];
  const message = positional.slice(1).join(' ');
  const urgent = flags.urgent || flags.u;
  
  await scheduleReminder(ctx.from.id, message, time, { urgent });
  await ctx.reply(`Reminder set for ${time}: "${message}"`);
}, {
  description: 'Set a reminder',
  usage: '/remind <time> <message> [--urgent]'
});
*/
