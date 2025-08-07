import { logger } from '@/lib/logger'
import type { BotContext } from '@/types'

interface BatchedRequest<T = unknown> {
  method: string
  params: Record<string, unknown>
  resolve: (value: T) => void
  reject: (error: unknown) => void
  timestamp: number
}

interface BatcherOptions {
  maxBatchSize?: number
  batchIntervalMs?: number
  maxRetries?: number
  timeoutMs?: number
}

/**
 * Telegram API Request Batcher
 * Batches multiple Telegram API requests to reduce overhead and improve performance.
 * Especially useful for the free tier's 10ms CPU limit.
 */
export class TelegramRequestBatcher {
  private queue: BatchedRequest<unknown>[] = []
  private timer: NodeJS.Timeout | null = null
  private processing = false
  private readonly options: Required<BatcherOptions>

  constructor(options: BatcherOptions = {}) {
    this.options = {
      maxBatchSize: options.maxBatchSize ?? 30,
      batchIntervalMs: options.batchIntervalMs ?? 25,
      maxRetries: options.maxRetries ?? 3,
      timeoutMs: options.timeoutMs ?? 5000
    }
  }

  /**
   * Add a request to the batch queue
   */
  async batchRequest<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
    return new Promise((_resolve, _reject) => {
      const request: BatchedRequest<T> = {
        method,
        params,
        resolve: _resolve,
        reject: _reject,
        timestamp: Date.now()
      }

      this.queue.push(request as BatchedRequest<unknown>)
      this.scheduleProcessing()
    })
  }

  /**
   * Schedule batch processing
   */
  private scheduleProcessing(): void {
    if (this.processing) return

    // If we've reached max batch size, process immediately
    if (this.queue.length >= this.options.maxBatchSize) {
      this.processBatch()
      return
    }

    // Otherwise, schedule processing after interval
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.processBatch()
      }, this.options.batchIntervalMs)
    }
  }

  /**
   * Process the current batch of requests
   */
  private async processBatch(): Promise<void> {
    if (this.processing || this.queue.length === 0) return

    this.processing = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    // Extract batch
    const batch = this.queue.splice(0, this.options.maxBatchSize)
    const startTime = Date.now()

    try {
      // For Telegram Bot API, we can't truly batch requests in a single HTTP call,
      // but we can execute them concurrently to save time
      const results = await Promise.allSettled(
        batch.map(async request => {
          try {
            // Add timeout to individual requests
            const result = await Promise.race([
              this.executeRequest(request),
              new Promise((_resolve, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), this.options.timeoutMs)
              )
            ])
            request.resolve(result)
          } catch (error) {
            request.reject(error)
          }
        })
      )

      const duration = Date.now() - startTime
      logger.info('Batch processed', {
        batchSize: batch.length,
        duration,
        successCount: results.filter(r => r.status === 'fulfilled').length,
        failureCount: results.filter(r => r.status === 'rejected').length
      })
    } catch (error) {
      logger.error('Batch processing error', { error })
      // Reject all requests in the batch
      batch.forEach(request => request.reject(error))
    } finally {
      this.processing = false

      // If there are more requests, schedule next batch
      if (this.queue.length > 0) {
        this.scheduleProcessing()
      }
    }
  }

  /**
   * Execute a single request (to be implemented based on Grammy context)
   */
  protected async executeRequest(_request: BatchedRequest): Promise<unknown> {
    // This is a placeholder - actual implementation would use Grammy's bot API
    // For now, we'll throw an error to indicate this needs to be connected
    throw new Error(
      'TelegramRequestBatcher.executeRequest must be implemented with Grammy bot instance'
    )
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length
  }

  /**
   * Clear the queue and cancel pending requests
   */
  clearQueue(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    this.queue.forEach(request => {
      request.reject(new Error('Queue cleared'))
    })

    this.queue = []
  }
}

/**
 * Grammy-integrated Telegram Request Batcher
 */
class GrammyTelegramBatcher extends TelegramRequestBatcher {
  constructor(
    private ctx: BotContext,
    options?: BatcherOptions
  ) {
    super(options)
  }

  protected override async executeRequest(request: BatchedRequest<unknown>): Promise<unknown> {
    const { method, params } = request

    // Map common methods to Grammy API calls
    switch (method) {
      case 'sendMessage':
        return await this.ctx.api.sendMessage(
          params.chat_id as string | number,
          params.text as string,
          params
        )
      case 'editMessageText':
        return await this.ctx.api.editMessageText(
          params.chat_id as string | number,
          params.message_id as number,
          params.text as string,
          params
        )
      case 'answerCallbackQuery':
        return await this.ctx.api.answerCallbackQuery(params.callback_query_id as string, params)
      case 'deleteMessage':
        return await this.ctx.api.deleteMessage(
          params.chat_id as string | number,
          params.message_id as number
        )
      case 'sendPhoto':
        return await this.ctx.api.sendPhoto(
          params.chat_id as string | number,
          params.photo as string,
          params
        )
      case 'sendDocument':
        return await this.ctx.api.sendDocument(
          params.chat_id as string | number,
          params.document as string,
          params
        )
      default:
        // For other methods, we need to use the raw API
        // This is a limitation we need to handle properly
        throw new Error(`Method ${method} not implemented in batcher`)
    }
  }
}

/**
 * Factory function to create a request batcher with Grammy integration
 */
export function createTelegramBatcher(
  ctx: BotContext,
  options?: BatcherOptions
): TelegramRequestBatcher {
  return new GrammyTelegramBatcher(ctx, options)
}

/**
 * Middleware to inject batcher into context
 */
export function batcherMiddleware(options?: BatcherOptions) {
  return async (ctx: BotContext, next: () => Promise<void>) => {
    // Create a batcher instance for this request
    ctx.batcher = createTelegramBatcher(ctx, options)

    try {
      await next()
    } finally {
      // Clear any pending requests when the handler completes
      ctx.batcher?.clearQueue()
    }
  }
}
