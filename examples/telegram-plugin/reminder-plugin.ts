import dayjs from 'dayjs'
import type { Context } from 'grammy'
import type { PluginCommand } from '../../src/core/plugins/plugin.js'
import { BasePlugin } from '../../src/core/plugins/plugin.js'

/**
 * Reminder Plugin for Telegram Bot
 *
 * This plugin adds reminder functionality to your Telegram bot.
 * Users can set reminders and receive notifications at specified times.
 */
export class ReminderPlugin extends BasePlugin {
  id = 'reminder-plugin'
  name = 'Reminder Plugin'
  version = '1.0.0'
  description = 'Set and manage reminders in Telegram'

  private reminders: Map<string, Reminder[]> = new Map()
  private timers: Map<string, NodeJS.Timeout> = new Map()

  async onInstall(): Promise<void> {
    this.logger.info('Installing Reminder Plugin...')

    // Load existing reminders from storage
    const savedReminders = await this.storage.get<SavedReminders>('reminders')
    if (savedReminders) {
      // Restore reminders
      Object.entries(savedReminders).forEach(([userId, userReminders]) => {
        this.reminders.set(userId, userReminders)
        // Reschedule active reminders
        userReminders.forEach(reminder => {
          if (!reminder.completed) {
            this.scheduleReminder(userId, reminder)
          }
        })
      })
    }
  }

  async onActivate(): Promise<void> {
    this.logger.info('Reminder Plugin activated')
  }

  async onDeactivate(): Promise<void> {
    this.logger.info('Reminder Plugin deactivated')

    // Clear all timers
    this.timers.forEach(timer => clearTimeout(timer))
    this.timers.clear()
  }

  async onUninstall(): Promise<void> {
    this.logger.info('Uninstalling Reminder Plugin...')

    // Save reminders before uninstalling
    await this.saveReminders()
  }

  getCommands(): PluginCommand[] {
    return [
      {
        name: 'remind',
        description: 'Set a reminder',
        aliases: ['reminder', 'r'],
        handler: this.handleRemindCommand.bind(this)
      },
      {
        name: 'reminders',
        description: 'List your reminders',
        aliases: ['myreminders'],
        handler: this.handleListCommand.bind(this)
      },
      {
        name: 'cancel_reminder',
        description: 'Cancel a reminder',
        aliases: ['cancelreminder'],
        handler: this.handleCancelCommand.bind(this)
      }
    ]
  }

  private async handleRemindCommand(args: string, ctx: Context): Promise<void> {
    if (!ctx.from) {
      await ctx.reply('❌ Unable to identify user')
      return
    }

    // Parse reminder format: /remind in 5 minutes to take a break
    const match = args.match(/in\s+(\d+)\s+(minute|minutes|hour|hours|day|days)\s+to\s+(.+)/i)

    if (!match) {
      await ctx.reply(
        '📝 Reminder Usage:\n\n' +
          '`/remind in [number] [minutes/hours/days] to [message]`\n\n' +
          'Examples:\n' +
          '• `/remind in 30 minutes to call mom`\n' +
          '• `/remind in 2 hours to check the oven`\n' +
          '• `/remind in 1 day to pay bills`',
        { parse_mode: 'Markdown' }
      )
      return
    }

    const [, amount, unit, message] = match
    const userId = ctx.from.id.toString()

    // Calculate reminder time
    const now = new Date()
    const reminderTime = new Date(now)
    const num = parseInt(amount)

    switch (unit.toLowerCase()) {
      case 'minute':
      case 'minutes':
        reminderTime.setMinutes(reminderTime.getMinutes() + num)
        break
      case 'hour':
      case 'hours':
        reminderTime.setHours(reminderTime.getHours() + num)
        break
      case 'day':
      case 'days':
        reminderTime.setDate(reminderTime.getDate() + num)
        break
    }

    // Create reminder
    const reminder: Reminder = {
      id: `${userId}-${Date.now()}`,
      message,
      createdAt: now,
      remindAt: reminderTime,
      completed: false
    }

    // Store reminder
    const userReminders = this.reminders.get(userId) || []
    userReminders.push(reminder)
    this.reminders.set(userId, userReminders)

    // Schedule reminder
    this.scheduleReminder(userId, reminder)

    // Save to storage
    await this.saveReminders()

    // Confirm to user
    await ctx.reply(
      `✅ Reminder set!\n\n` +
        `📅 Time: ${dayjs(reminderTime).format('MMMM D, YYYY h:mm A')}\n` +
        `💬 Message: "${message}"\n\n` +
        `I'll remind you when the time comes! ⏰`
    )
  }

  private async handleListCommand(_args: string, ctx: Context): Promise<void> {
    if (!ctx.from) {
      await ctx.reply('❌ Unable to identify user')
      return
    }

    const userId = ctx.from.id.toString()
    const userReminders = this.reminders.get(userId) || []
    const activeReminders = userReminders.filter(r => !r.completed)

    if (activeReminders.length === 0) {
      await ctx.reply('📭 You have no active reminders.')
      return
    }

    const reminderList = activeReminders
      .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime())
      .map(
        (r, index) =>
          `${index + 1}. 📅 ${dayjs(r.remindAt).format('MMM D, YYYY h:mm A')}\n   💬 "${r.message}"`
      )
      .join('\n\n')

    await ctx.reply(
      `📋 Your Active Reminders:\n\n${reminderList}\n\n` +
        `Use /cancel_reminder [number] to cancel a reminder.`
    )
  }

  private async handleCancelCommand(args: string, ctx: Context): Promise<void> {
    if (!ctx.from) {
      await ctx.reply('❌ Unable to identify user')
      return
    }

    const userId = ctx.from.id.toString()
    const userReminders = this.reminders.get(userId) || []
    const activeReminders = userReminders.filter(r => !r.completed)

    if (activeReminders.length === 0) {
      await ctx.reply('📭 You have no active reminders to cancel.')
      return
    }

    const index = parseInt(args) - 1
    if (isNaN(index) || index < 0 || index >= activeReminders.length) {
      await ctx.reply(
        '❌ Invalid reminder number.\n\n' +
          'Use `/reminders` to see your reminder list with numbers.'
      )
      return
    }

    const reminder = activeReminders[index]
    reminder.completed = true

    // Cancel timer
    const timerId = `${userId}-${reminder.id}`
    const timer = this.timers.get(timerId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(timerId)
    }

    await this.saveReminders()

    await ctx.reply(`✅ Reminder cancelled!\n\n` + `💬 "${reminder.message}"`)
  }

  private scheduleReminder(userId: string, reminder: Reminder): void {
    const now = new Date()
    const delay = reminder.remindAt.getTime() - now.getTime()

    if (delay <= 0) {
      // Reminder is in the past, mark as completed
      reminder.completed = true
      return
    }

    const timerId = `${userId}-${reminder.id}`

    const timer = setTimeout(async () => {
      await this.sendReminder(userId, reminder)
      reminder.completed = true
      await this.saveReminders()
      this.timers.delete(timerId)
    }, delay)

    this.timers.set(timerId, timer)
  }

  private async sendReminder(userId: string, reminder: Reminder): Promise<void> {
    try {
      const context = this.context
      if (!context) return

      // Emit reminder event
      this.eventBus.emit(
        'reminder:triggered',
        {
          userId,
          reminder
        },
        this.id
      )

      // Send notification through the messaging connector
      const connector = context.getConnector('telegram')
      if (connector && 'sendMessage' in connector) {
        await connector.sendMessage(userId, {
          content: {
            text: `⏰ **Reminder!**\n\n${reminder.message}`,
            entities: [{ type: 'bold' as const, offset: 0, length: 11 }]
          }
        })
      }
    } catch (error) {
      this.logger.error('Failed to send reminder:', error)
    }
  }

  private async saveReminders(): Promise<void> {
    const savedReminders: SavedReminders = {}

    this.reminders.forEach((reminders, userId) => {
      savedReminders[userId] = reminders
    })

    await this.storage.set('reminders', savedReminders)
  }
}

// Types
interface Reminder {
  id: string
  message: string
  createdAt: Date
  remindAt: Date
  completed: boolean
}

type SavedReminders = Record<string, Reminder[]>

// Export plugin factory
export default function createReminderPlugin(): ReminderPlugin {
  return new ReminderPlugin()
}
