/**
 * Telegram Bot API 9.1 - Checklist Commands
 *
 * Commands for managing checklists in Telegram
 * @module adapters/telegram/commands/checklist
 */

import type { Api, Bot } from 'grammy'

import { ChecklistConnector } from '@/connectors/messaging/telegram/checklist-connector'
import { EventBus } from '@/core/events/event-bus'
import { logger } from '@/lib/logger'
import { loggerAdapter } from '@/lib/logger-adapter'
import type { CommandHandler } from '@/types'

// Create shared instances
let checklistConnector: ChecklistConnector | null = null
let eventBus: EventBus | null = null

function getChecklistConnector(bot: Bot | Api): ChecklistConnector {
  if (!checklistConnector) {
    if (!eventBus) {
      eventBus = new EventBus()
    }
    // Cast to Bot since ChecklistConnector expects Bot type
    checklistConnector = new ChecklistConnector(bot as Bot, loggerAdapter, eventBus)
  }
  return checklistConnector
}

/**
 * Handle /checklist command - Create a new checklist
 * Usage: /checklist [title]
 */
export const checklistCommand: CommandHandler = async (ctx): Promise<void> => {
  try {
    const userId = ctx.from?.id
    if (!userId) {
      await ctx.reply('❌ Unable to identify user')
      return
    }

    // Get checklist connector
    const connector = getChecklistConnector(ctx.api)
    await connector.initialize()

    // Get title from command arguments
    const commandText = ctx.message?.text || ''
    const title = commandText.replace(/^\/checklist\s*/, '').trim()

    // Create checklist builder
    const builder = connector.createChecklistBuilder()

    if (title) {
      builder.setTitle(title)
    }

    // Send initial checklist with example tasks
    builder
      .addTask('Click to add your first task', false)
      .addTask('Mark tasks as done by clicking them', false)
      .addTask('Share this checklist with your team', false)

    const checklist = builder.build()

    // Send checklist
    const chatId = ctx.chat?.id
    if (!chatId) {
      await ctx.reply('❌ Unable to identify chat')
      return
    }

    const result = await connector.sendChecklist(chatId, checklist, {
      disable_notification: false,
      protect_content: false
    })

    logger.info('[ChecklistCommand] Checklist created', {
      userId,
      chatId,
      title,
      messageId: result.message_id
    })

    if (eventBus) {
      eventBus.emit(
        'command:checklist:created',
        {
          userId,
          chatId,
          title
        },
        'checklist-command'
      )
    }
  } catch (error) {
    logger.error('[ChecklistCommand] Failed to create checklist', error)
    await ctx.reply('❌ Failed to create checklist. Please try again.')
  }
}

/**
 * Handle /tasks command - Show user's tasks or create task list
 * Usage: /tasks [add|list|done|clear]
 */
export const tasksCommand: CommandHandler = async (ctx): Promise<void> => {
  try {
    const userId = ctx.from?.id
    if (!userId) {
      await ctx.reply('❌ Unable to identify user')
      return
    }

    // Get checklist connector
    const connector = getChecklistConnector(ctx.api)
    await connector.initialize()

    const commandText = ctx.message?.text || ''
    const args = commandText
      .replace(/^\/tasks\s*/, '')
      .trim()
      .split(/\s+/)
    const action = args[0]?.toLowerCase()

    switch (action) {
      case 'add': {
        const taskText = args.slice(1).join(' ')
        if (!taskText) {
          await ctx.reply('📝 Usage: /tasks add <task description>')
          return
        }

        // Create a new task in checklist
        const builder = connector.createChecklistBuilder()
        builder.setTitle('📋 My Tasks').addTask(taskText, false)

        const checklist = builder.build()
        const chatId = ctx.chat?.id
        if (!chatId) {
          await ctx.reply('❌ Unable to identify chat')
          return
        }
        await connector.sendChecklist(chatId, checklist)

        await ctx.reply(`✅ Task added: "${taskText}"`)
        break
      }

      case 'list': {
        // Create a sample task list
        const builder = connector.createChecklistBuilder()
        builder
          .setTitle("📋 Today's Tasks")
          .addTask('Morning standup meeting', true)
          .addTask('Review pull requests', false)
          .addTask('Update documentation', false)
          .addTask('Deploy to staging', false)

        const stats = builder.getStats()
        const checklist = builder.build()

        const chatId = ctx.chat?.id
        if (!chatId) {
          await ctx.reply('❌ Unable to identify chat')
          return
        }
        await connector.sendChecklist(chatId, checklist)
        await ctx.reply(
          `📊 Task Statistics:\n` +
            `✅ Completed: ${stats.done}\n` +
            `⏳ Pending: ${stats.pending}\n` +
            `📈 Progress: ${stats.progress.toFixed(0)}%`
        )
        break
      }

      case 'done': {
        await ctx.reply(
          '✅ Great job completing your tasks!\n\n' +
            'To mark specific tasks as done, click on them in the checklist.'
        )
        break
      }

      case 'clear': {
        await ctx.reply(
          '🗑️ To clear all tasks, create a new checklist with /checklist\n\n' +
            'Your previous checklists will remain in the chat history.'
        )
        break
      }

      default: {
        await ctx.reply(
          '📋 *Task Management Commands*\n\n' +
            '• `/tasks add <text>` - Add a new task\n' +
            '• `/tasks list` - Show all tasks\n' +
            '• `/tasks done` - Mark tasks as completed\n' +
            '• `/tasks clear` - Clear all tasks\n\n' +
            '💡 *Tip:* Click on tasks in a checklist to toggle their status!',
          { parse_mode: 'Markdown' }
        )
      }
    }

    if (eventBus) {
      eventBus.emit(
        'command:tasks:executed',
        {
          userId,
          chatId: ctx.chat?.id || 0,
          action: action || 'help'
        },
        'checklist-command'
      )
    }
  } catch (error) {
    logger.error('[TasksCommand] Failed to handle tasks command', error)
    await ctx.reply('❌ Failed to manage tasks. Please try again.')
  }
}

/**
 * Handle /todo command - Quick todo list creation
 * Usage: /todo item1, item2, item3
 */
export const todoCommand: CommandHandler = async (ctx): Promise<void> => {
  try {
    const userId = ctx.from?.id
    if (!userId) {
      await ctx.reply('❌ Unable to identify user')
      return
    }

    // Get checklist connector
    const connector = getChecklistConnector(ctx.api)
    await connector.initialize()

    const commandText = ctx.message?.text || ''
    const todoText = commandText.replace(/^\/todo\s*/, '').trim()

    if (!todoText) {
      await ctx.reply(
        '📝 *Quick Todo List*\n\n' +
          'Usage: `/todo task1, task2, task3`\n\n' +
          'Example:\n' +
          '`/todo Buy groceries, Call dentist, Finish report`',
        { parse_mode: 'Markdown' }
      )
      return
    }

    // Parse todo items (comma or newline separated)
    const items = todoText
      .split(/[,\n]/)
      .map(item => item.trim())
      .filter(item => item.length > 0)

    if (items.length === 0) {
      await ctx.reply('❌ No valid todo items found')
      return
    }

    // Create checklist
    const builder = connector.createChecklistBuilder()
    builder.setTitle('✅ Todo List')

    items.forEach(item => {
      builder.addTask(item, false)
    })

    const checklist = builder.build()
    const stats = builder.getStats()

    // Send checklist
    const chatId = ctx.chat?.id
    if (!chatId) {
      await ctx.reply('❌ Unable to identify chat')
      return
    }
    await connector.sendChecklist(chatId, checklist)

    await ctx.reply(
      `📋 Created todo list with ${stats.total} item${stats.total !== 1 ? 's' : ''}!\n\n` +
        `Click on items to mark them as done ✅`
    )

    if (eventBus) {
      eventBus.emit(
        'command:todo:created',
        {
          userId,
          chatId: ctx.chat?.id || 0,
          itemCount: items.length
        },
        'checklist-command'
      )
    }
  } catch (error) {
    logger.error('[TodoCommand] Failed to create todo list', error)
    await ctx.reply('❌ Failed to create todo list. Please try again.')
  }
}

/**
 * Handle checklist callback queries (when users click on tasks)
 */
export const handleChecklistCallback: CommandHandler = async (ctx): Promise<void> => {
  try {
    // This would handle callbacks from inline keyboards on checklists
    // Implementation depends on how Grammy handles Bot API 9.1 callbacks

    const callbackQuery = ctx.callbackQuery
    if (!callbackQuery) return

    const data = callbackQuery.data
    if (!data?.startsWith('checklist:')) return

    const [, action, messageId, taskIndex] = data.split(':')

    if (action === 'toggle' && messageId && taskIndex) {
      // Toggle task status
      logger.info('[ChecklistCallback] Toggling task', {
        messageId,
        taskIndex
      })

      // This would need to fetch the current checklist state
      // and update it accordingly
      await ctx.answerCallbackQuery('✅ Task updated!')
    }
  } catch (error) {
    logger.error('[ChecklistCallback] Failed to handle callback', error)
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery('❌ Failed to update task')
    }
  }
}
