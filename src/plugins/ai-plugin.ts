/**
 * AI Commands Plugin
 * Provides AI-powered commands like /ask
 */

import type { Plugin, PluginCommand, PluginContext } from '../core/plugins/plugin'
import type { CommandArgs } from '../types/command-args'

export class AIPlugin implements Plugin {
  id = 'ai-plugin'
  name = 'AI Commands Plugin'
  version = '1.0.0'
  description = 'Provides AI-powered commands and features'
  author = 'Wireframe Team'
  homepage = 'https://github.com/yourusername/wireframe'

  private context?: PluginContext
  private pendingRequests = new Map<string, { userId: string; timestamp: number }>()

  /**
   * Install the plugin
   */
  async install(context: PluginContext): Promise<void> {
    this.context = context

    // Register the ask command
    const askCommand: PluginCommand = {
      name: 'ask',
      description: 'Ask AI a question',
      aliases: ['ai', 'chat'],
      handler: async (args, commandContext) => {
        const question = (args as CommandArgs)._raw

        if (!question || question.trim().length === 0) {
          await commandContext.reply(
            '❓ Please provide a question after the command.\n\n' +
              'Example: <code>/ask What is the weather today?</code>'
          )
          return
        }

        // Generate request ID
        const requestId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const userId = commandContext.sender.id

        // Store pending request
        this.pendingRequests.set(requestId, { userId, timestamp: Date.now() })

        // Send typing indicator
        await commandContext.reply('🤔 Thinking...')

        // Emit AI request event
        context.eventBus.emit(
          'ai:complete',
          {
            prompt: question,
            requestId,
            options: {
              maxTokens: 500,
              temperature: 0.7
            }
          },
          this.id
        )

        // Set up response handlers
        const successHandler = context.eventBus.once('ai:complete:success', async event => {
          const payload = event.payload as {
            requestId: string
            response: { content: string; usage?: { totalTokens?: number } }
          }
          if (payload.requestId === requestId) {
            const { response } = payload

            // Send AI response
            await commandContext.reply(`💡 <b>AI Response:</b>\n\n${response.content}`)

            // Clean up
            this.pendingRequests.delete(requestId)

            // Track usage
            await this.trackUsage(userId, 'ask', response.usage?.totalTokens || 0)
          }
        })

        const errorHandler = context.eventBus.once('ai:complete:error', async event => {
          const payload = event.payload as { requestId: string; error: unknown }
          if (payload.requestId === requestId) {
            await commandContext.reply(
              '❌ Sorry, I encountered an error while processing your request.\n' +
                'Please try again later.'
            )

            // Clean up
            this.pendingRequests.delete(requestId)

            context.logger.error('AI request failed', {
              requestId,
              error: payload.error
            })
          }
        })

        // Set timeout
        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId)
            successHandler()
            errorHandler()

            commandContext.reply('⏱ Request timed out. Please try again.')
          }
        }, 30000) // 30 second timeout
      }
    }

    // Register clear command
    const clearCommand: PluginCommand = {
      name: 'clear',
      description: 'Clear AI conversation history',
      handler: async (_args, commandContext) => {
        const userId = commandContext.sender.id

        // Clear conversation history
        await context.storage.delete(`ai:history:${userId}`)

        await commandContext.reply('🗑 Your AI conversation history has been cleared.')

        context.logger.info('AI history cleared', { userId })
      }
    }

    context.commands.set('ask', askCommand)
    context.commands.set('clear', clearCommand)

    // Set up cleanup interval
    setInterval(() => {
      this.cleanupPendingRequests()
    }, 60000) // Clean up every minute
  }

  /**
   * Track AI usage
   */
  private async trackUsage(userId: string, command: string, tokens: number): Promise<void> {
    if (!this.context) return

    const key = `ai:usage:${userId}`
    const usage = (await this.context.storage.get<{
      totalRequests: number
      totalTokens: number
      commands: Record<string, number>
      lastUsed?: number
    }>(key)) || {
      totalRequests: 0,
      totalTokens: 0,
      commands: {}
    }

    usage.totalRequests += 1
    usage.totalTokens += tokens
    usage.commands[command] = (usage.commands[command] || 0) + 1
    usage.lastUsed = Date.now()

    await this.context.storage.set(key, usage)

    // Emit usage event
    this.context.eventBus.emit(
      'ai:usage:tracked',
      {
        userId,
        command,
        tokens
      },
      this.id
    )
  }

  /**
   * Clean up old pending requests
   */
  private cleanupPendingRequests(): void {
    const now = Date.now()
    const timeout = 60000 // 1 minute

    for (const [requestId, data] of this.pendingRequests) {
      if (now - data.timestamp > timeout) {
        this.pendingRequests.delete(requestId)
      }
    }
  }

  /**
   * Activate the plugin
   */
  async activate(): Promise<void> {
    this.context?.logger.info('AI plugin activated')
  }

  /**
   * Deactivate the plugin
   */
  async deactivate(): Promise<void> {
    // Clear pending requests
    this.pendingRequests.clear()
    this.context?.logger.info('AI plugin deactivated')
  }

  /**
   * Uninstall the plugin
   */
  async uninstall(): Promise<void> {
    // Remove commands
    this.context?.commands.delete('ask')
    this.context?.commands.delete('clear')

    this.context?.logger.info('AI plugin uninstalled')
  }

  /**
   * Get plugin commands
   */
  getCommands(): PluginCommand[] {
    const commands: PluginCommand[] = []

    const askCommand = this.context?.commands.get('ask')
    if (askCommand) commands.push(askCommand)

    const clearCommand = this.context?.commands.get('clear')
    if (clearCommand) commands.push(clearCommand)

    return commands
  }
}
