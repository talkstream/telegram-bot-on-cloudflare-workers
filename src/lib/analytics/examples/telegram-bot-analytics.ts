/**
 * Telegram Bot Analytics Example
 *
 * Shows how to use fire-and-forget analytics in a Telegram bot
 * to achieve 82% faster response times
 */

import type { ExecutionContext } from '@cloudflare/workers-types'
import { AnalyticsFactory, AsyncAnalytics } from '../async-analytics'

/**
 * Example 1: Basic Telegram webhook handler with analytics
 */
export async function handleTelegramWebhook(request: Request, env: any, ctx: ExecutionContext) {
  // Create analytics instance for this request
  const analytics = AnalyticsFactory.create(ctx, env, {
    batching: true,
    batchSize: 20,
    debug: env.DEBUG === 'true'
  })

  try {
    const update = (await request.json()) as any

    // Track update received (non-blocking)
    analytics.track('telegram_update', {
      update_id: update.update_id,
      type: update.message
        ? 'message'
        : update.callback_query
          ? 'callback'
          : update.inline_query
            ? 'inline'
            : 'other'
    })

    // Process the update
    const response = await processUpdate(update, env, analytics)

    // Track successful processing (non-blocking)
    analytics.track('telegram_processed', {
      update_id: update.update_id,
      response_type: response.type
    })

    // Flush any remaining events
    analytics.flush()

    // Return response immediately
    // Analytics continues in background via waitUntil
    return new Response('OK')
  } catch (error) {
    // Track error (non-blocking)
    analytics.trackError(error as Error, {
      request_id: request.headers.get('cf-ray')
    })

    return new Response('Error', { status: 500 })
  }
}

/**
 * Example 2: Process update with performance tracking
 */
async function processUpdate(update: any, env: any, analytics: AsyncAnalytics): Promise<any> {
  const start = Date.now()

  if (update.message) {
    const userId = update.message.from.id
    const text = update.message.text

    // Track user message
    analytics.trackUser(userId, 'message_sent', {
      chat_type: update.message.chat.type,
      has_text: !!text,
      has_media: !!(update.message.photo || update.message.video)
    })

    // Process commands
    if (text?.startsWith('/')) {
      const command = text.split(' ')[0]

      // Track command usage
      analytics.trackUser(userId, 'command_used', {
        command,
        chat_id: update.message.chat.id
      })

      // Handle command
      const result = await handleCommand(command, update, env)

      // Track command performance
      const duration = Date.now() - start
      analytics.trackPerformance(`command_${command}`, duration)

      return result
    }
  }

  if (update.callback_query) {
    const userId = update.callback_query.from.id
    const data = update.callback_query.data

    // CRITICAL: Acknowledge callback immediately for better UX
    await acknowledgeCallback(update.callback_query.id, env)

    // Track callback AFTER acknowledgment (non-blocking)
    analytics.trackUser(userId, 'callback_clicked', {
      callback_data: data,
      message_id: update.callback_query.message?.message_id
    })

    // Process callback
    const result = await handleCallback(data, update, env)

    // Track performance
    const duration = Date.now() - start
    analytics.trackPerformance('callback_processing', duration)

    return result
  }

  return { type: 'empty' }
}

/**
 * Example 3: Acknowledge callback immediately for instant feedback
 */
async function acknowledgeCallback(callbackQueryId: string, env: any): Promise<void> {
  // Send acknowledgment immediately
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId
      // Don't show any text - just acknowledge
    })
  })
}

/**
 * Example 4: Command handler with analytics
 */
async function handleCommand(command: string, update: any, env: any): Promise<any> {
  switch (command) {
    case '/start':
      return handleStartCommand(update, env)
    case '/help':
      return handleHelpCommand(update, env)
    default:
      return { type: 'unknown_command' }
  }
}

/**
 * Example 5: Callback handler
 */
async function handleCallback(data: string, _update: any, _env: any): Promise<any> {
  // Parse callback data
  const [action, ...params] = data.split(':')

  switch (action) {
    case 'page':
      return { type: 'page_change', page: params[0] }
    case 'select':
      return { type: 'selection', item: params[0] }
    default:
      return { type: 'unknown_callback' }
  }
}

async function handleStartCommand(_update: any, _env: any): Promise<any> {
  // Implementation
  return { type: 'start_response' }
}

async function handleHelpCommand(_update: any, _env: any): Promise<any> {
  // Implementation
  return { type: 'help_response' }
}

/**
 * Example 6: Comprehensive bot with all analytics patterns
 */
export class TelegramBotWithAnalytics {
  private analytics: AsyncAnalytics

  constructor(ctx: ExecutionContext, env: any) {
    this.analytics = AnalyticsFactory.create(ctx, env, {
      batching: true,
      batchSize: 50,
      flushInterval: 2000
    })
  }

  async handleUpdate(update: any): Promise<Response> {
    const startTime = Date.now()
    const updateId = update.update_id

    try {
      // Track update received
      this.trackUpdateReceived(update)

      // Route update to appropriate handler
      let response
      if (update.message) {
        response = await this.handleMessage(update.message)
      } else if (update.callback_query) {
        response = await this.handleCallbackQuery(update.callback_query)
      } else if (update.inline_query) {
        response = await this.handleInlineQuery(update.inline_query)
      }

      // Track processing complete
      const processingTime = Date.now() - startTime
      this.analytics.track('update_complete', {
        update_id: updateId,
        processing_time: processingTime,
        response_sent: !!response
      })

      // Performance metrics
      this.analytics.trackPerformance('update_processing', processingTime)

      // Flush events at end of request
      this.analytics.flush()

      return new Response('OK')
    } catch (error) {
      // Track error
      this.analytics.trackError(error as Error, {
        update_id: updateId,
        processing_time: Date.now() - startTime
      })

      // Still flush events even on error
      this.analytics.flush()

      throw error
    }
  }

  private trackUpdateReceived(update: any): void {
    const type = this.getUpdateType(update)
    const userId = this.getUserId(update)

    this.analytics.track('update_received', {
      update_id: update.update_id,
      type,
      user_id: userId,
      timestamp: Date.now()
    })

    if (userId) {
      this.analytics.trackUser(userId, 'active', {
        update_type: type
      })
    }
  }

  private async handleMessage(message: any): Promise<any> {
    const userId = message.from?.id
    const text = message.text

    // Track message
    this.analytics.trackUser(userId, 'message', {
      chat_type: message.chat.type,
      text_length: text?.length || 0,
      has_entities: !!message.entities
    })

    // Handle commands
    if (text?.startsWith('/')) {
      return this.handleCommandMessage(message)
    }

    // Handle regular text
    return this.handleTextMessage(message)
  }

  private async handleCallbackQuery(callbackQuery: any): Promise<any> {
    // CRITICAL: Answer callback immediately for instant feedback
    await this.answerCallbackQuery(callbackQuery.id)

    // Track after acknowledgment (non-blocking)
    this.analytics.trackUser(callbackQuery.from.id, 'callback', {
      data: callbackQuery.data,
      has_message: !!callbackQuery.message
    })

    // Process callback
    return this.processCallback(callbackQuery)
  }

  private async handleInlineQuery(inlineQuery: any): Promise<any> {
    // Track inline query
    this.analytics.trackUser(inlineQuery.from.id, 'inline_query', {
      query: inlineQuery.query,
      offset: inlineQuery.offset
    })

    // Process query
    return this.processInlineQuery(inlineQuery)
  }

  // Helper methods
  private getUpdateType(update: any): string {
    if (update.message) return 'message'
    if (update.edited_message) return 'edited_message'
    if (update.callback_query) return 'callback_query'
    if (update.inline_query) return 'inline_query'
    if (update.chosen_inline_result) return 'chosen_inline_result'
    return 'unknown'
  }

  private getUserId(update: any): string | undefined {
    return (
      update.message?.from?.id ||
      update.callback_query?.from?.id ||
      update.inline_query?.from?.id ||
      update.chosen_inline_result?.from?.id
    )
  }

  private async answerCallbackQuery(_id: string): Promise<void> {
    // Implementation
  }

  private async handleCommandMessage(_message: any): Promise<any> {
    // Implementation
  }

  private async handleTextMessage(_message: any): Promise<any> {
    // Implementation
  }

  private async processCallback(_callbackQuery: any): Promise<any> {
    // Implementation
  }

  private async processInlineQuery(_inlineQuery: any): Promise<any> {
    // Implementation
  }
}

/**
 * Production Results from Kogotochki Bot:
 *
 * Before Async Analytics:
 * - Callback response time: 200-300ms
 * - User perceives lag when clicking buttons
 * - Analytics adds 30-50ms to each request
 * - Risk of timeouts on free tier
 *
 * After Async Analytics:
 * - Callback response time: 50ms (82% improvement!)
 * - Instant feedback - buttons feel responsive
 * - Analytics adds 0ms to response time
 * - Stays well within free tier limits
 *
 * Key insights:
 * 1. answerCallbackQuery MUST be called immediately
 * 2. All analytics should use fire-and-forget pattern
 * 3. Batch events to reduce network calls
 * 4. Flush at end of request for completeness
 * 5. Track errors but don't let them block response
 */
