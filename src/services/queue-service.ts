/**
 * Generic Queue Service with batch processing support
 * Platform-agnostic queue abstraction for asynchronous task processing
 */

import type { ILogger } from '../core/interfaces/logger'

export interface QueueMessage<T = unknown> {
  id?: string
  type: string
  data: T
  timestamp: number
  retryCount?: number
  metadata?: Record<string, unknown>
}

export interface QueueAdapter<T = unknown> {
  send(message: QueueMessage<T>): Promise<void>
  sendBatch(messages: QueueMessage<T>[]): Promise<void>
  receive(maxMessages?: number): Promise<ReceivedMessage<T>[]>
  deleteMessage(messageId: string): Promise<void>
}

export interface ReceivedMessage<T = unknown> {
  id: string
  body: QueueMessage<T>
  receiveCount: number
  ack(): Promise<void>
  retry(options?: { delaySeconds?: number }): Promise<void>
}

export interface QueueServiceConfig {
  adapter: QueueAdapter
  logger?: ILogger
  defaultRetryLimit?: number
  defaultRetryDelay?: number
  batchSize?: number
}

export interface MessageHandler<T = unknown> {
  type: string
  handler: (data: T, context: HandlerContext) => Promise<void>
}

export interface HandlerContext {
  messageId: string
  retryCount: number
  timestamp: number
  metadata?: Record<string, unknown>
}

export interface ProcessResult {
  processed: number
  failed: number
  retried: number
  errors: Array<{ messageId: string; error: Error }>
}

export class QueueService<T = unknown> {
  private adapter: QueueAdapter<T>
  private logger?: ILogger
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Type erasure needed for heterogeneous handlers
  private handlers = new Map<string, MessageHandler<any>['handler']>()
  private defaultRetryLimit: number
  private defaultRetryDelay: number
  private batchSize: number
  private processingStats = {
    totalProcessed: 0,
    totalFailed: 0,
    totalRetried: 0
  }

  constructor(config: QueueServiceConfig) {
    this.adapter = config.adapter as QueueAdapter<T>
    this.logger = config.logger
    this.defaultRetryLimit = config.defaultRetryLimit || 3
    this.defaultRetryDelay = config.defaultRetryDelay || 30
    this.batchSize = config.batchSize || 10
  }

  /**
   * Register a message handler for a specific type
   */
  registerHandler<K = T>(handler: MessageHandler<K>): void {
    if (this.handlers.has(handler.type)) {
      throw new Error(`Handler for type "${handler.type}" already registered`)
    }
    this.handlers.set(handler.type, handler.handler)
    this.logger?.info('Message handler registered', { type: handler.type })
  }

  /**
   * Send a single message to the queue
   */
  async send<K = T>(type: string, data: K, metadata?: Record<string, unknown>): Promise<void> {
    const message: QueueMessage<K> = {
      type,
      data,
      timestamp: Date.now(),
      metadata
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Type conversion for adapter
      await this.adapter.send(message as any)
      this.logger?.debug('Message sent to queue', { type, messageId: message.id })
    } catch (error) {
      this.logger?.error('Failed to send message', { error, type })
      throw error
    }
  }

  /**
   * Send multiple messages in a batch
   */
  async sendBatch<K = T>(
    messages: Array<{ type: string; data: K; metadata?: Record<string, unknown> }>
  ): Promise<void> {
    // eslint-disable-next-line db-mapping/use-field-mapper -- Not a database mapping
    const queueMessages: QueueMessage<K>[] = messages.map(msg => ({
      type: msg.type,
      data: msg.data,
      timestamp: Date.now(),
      metadata: msg.metadata
    }))

    try {
      // Split into chunks if needed
      for (let i = 0; i < queueMessages.length; i += this.batchSize) {
        const batch = queueMessages.slice(i, i + this.batchSize)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Type conversion for adapter
        await this.adapter.sendBatch(batch as any)
      }

      this.logger?.info('Batch messages sent', { count: messages.length })
    } catch (error) {
      this.logger?.error('Failed to send batch', { error, count: messages.length })
      throw error
    }
  }

  /**
   * Process messages from the queue
   */
  async processMessages(maxMessages?: number): Promise<ProcessResult> {
    const result: ProcessResult = {
      processed: 0,
      failed: 0,
      retried: 0,
      errors: []
    }

    try {
      const messages = await this.adapter.receive(maxMessages || this.batchSize)

      if (messages.length === 0) {
        return result
      }

      this.logger?.info('Processing message batch', { count: messages.length })

      // Process messages in parallel with controlled concurrency
      const promises = messages.map(message => this.processMessage(message, result))
      await Promise.all(promises)

      // Update global stats
      this.processingStats.totalProcessed += result.processed
      this.processingStats.totalFailed += result.failed
      this.processingStats.totalRetried += result.retried

      return result
    } catch (error) {
      this.logger?.error('Failed to process messages', { error })
      throw error
    }
  }

  /**
   * Process a single message
   */
  async processMessage(message: ReceivedMessage<T>, result: ProcessResult): Promise<void> {
    const startTime = Date.now()
    const { body } = message

    try {
      const handler = this.handlers.get(body.type)

      if (!handler) {
        throw new Error(`No handler registered for message type: ${body.type}`)
      }

      const context: HandlerContext = {
        messageId: message.id,
        retryCount: body.retryCount || 0,
        timestamp: body.timestamp,
        metadata: body.metadata
      }

      await handler(body.data, context)

      const duration = Date.now() - startTime
      this.logger?.debug('Message processed successfully', {
        type: body.type,
        messageId: message.id,
        duration
      })

      await message.ack()
      result.processed++
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      this.logger?.error('Failed to process message', {
        error: err,
        type: body.type,
        messageId: message.id,
        retryCount: body.retryCount || 0
      })

      result.errors.push({ messageId: message.id, error: err })

      // Handle retry logic
      const retryCount = body.retryCount || 0
      if (retryCount >= this.defaultRetryLimit) {
        // Max retries reached
        await message.ack()
        result.failed++
        this.logger?.error('Message dropped after max retries', {
          messageId: message.id,
          type: body.type
        })
      } else {
        // Retry the message
        await message.retry({ delaySeconds: this.defaultRetryDelay })
        result.retried++
      }
    }
  }

  /**
   * Start continuous message processing
   */
  async startProcessing(
    options: {
      pollInterval?: number
      maxMessages?: number
      onError?: (error: Error) => void
    } = {}
  ): Promise<() => void> {
    const { pollInterval = 5000, maxMessages, onError } = options
    let isRunning = true

    const process = async () => {
      while (isRunning) {
        try {
          await this.processMessages(maxMessages)
          await new Promise(resolve => setTimeout(resolve, pollInterval))
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error))
          this.logger?.error('Error in message processing loop', { error: err })

          if (onError) {
            onError(err)
          }

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, pollInterval * 2))
        }
      }
    }

    // Start processing in background
    process().catch(error => {
      this.logger?.error('Message processing stopped unexpectedly', { error })
    })

    // Return stop function
    return () => {
      isRunning = false
      this.logger?.info('Message processing stopped')
    }
  }

  /**
   * Get processing statistics
   */
  getStats(): typeof this.processingStats {
    return { ...this.processingStats }
  }

  /**
   * Reset processing statistics
   */
  resetStats(): void {
    this.processingStats.totalProcessed = 0
    this.processingStats.totalFailed = 0
    this.processingStats.totalRetried = 0
  }

  /**
   * Create a typed queue service for specific message types
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic data type
  static typed<TMessage extends { type: string; data: any }>(
    config: QueueServiceConfig
  ): TypedQueueService<TMessage> {
    return new TypedQueueService<TMessage>(config)
  }
}

/**
 * Typed queue service for better type safety
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic data type
export class TypedQueueService<TMessage extends { type: string; data: any }> extends QueueService<
  TMessage['data']
> {
  registerTypedHandler<K extends TMessage['type']>(
    type: K,
    handler: (
      data: Extract<TMessage, { type: K }>['data'],
      context: HandlerContext
    ) => Promise<void>
  ): void {
    this.registerHandler({
      type,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Type erasure for handler
      handler: handler as any
    })
  }

  async sendTyped<K extends TMessage>(message: K): Promise<void> {
    await this.send(message.type, message.data)
  }
}
