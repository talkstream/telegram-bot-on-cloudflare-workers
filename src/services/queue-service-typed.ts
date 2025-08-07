/**
 * Fully Typed Queue Service with Zero `any` Types
 *
 * Provides type-safe queue operations with complete generic support
 * Includes Dead Letter Queue (DLQ) implementation for failed messages
 *
 * @module services/queue-service-typed
 */

import type { ILogger } from '../core/interfaces/logger'

/**
 * Base message type with discriminated union support
 */
export interface BaseQueueMessage {
  id?: string
  type: string
  timestamp: number
  retryCount?: number
  metadata?: Record<string, unknown>
}

/**
 * Generic queue message with typed data payload
 */
export interface QueueMessage<TType extends string = string, TData = unknown>
  extends BaseQueueMessage {
  type: TType
  data: TData
}

/**
 * Message type registry for type-safe message handling
 */
export interface MessageTypeRegistry {
  [key: string]: unknown
}

/**
 * Extract message types from registry
 */
export type MessageTypes<T extends MessageTypeRegistry> = {
  [K in keyof T]: QueueMessage<K & string, T[K]>
}[keyof T]

/**
 * Queue adapter interface with full type safety
 */
export interface QueueAdapter<TMessage extends BaseQueueMessage = BaseQueueMessage> {
  send(message: TMessage): Promise<void>
  sendBatch(messages: TMessage[]): Promise<void>
  receive(maxMessages?: number): Promise<ReceivedMessage<TMessage>[]>
  deleteMessage(messageId: string): Promise<void>

  // DLQ operations
  sendToDLQ?(message: TMessage, error: Error): Promise<void>
  receiveDLQ?(maxMessages?: number): Promise<ReceivedMessage<TMessage>[]>
  getDLQStats?(): Promise<DLQStatistics>
}

/**
 * Received message wrapper with acknowledgment
 */
export interface ReceivedMessage<TMessage extends BaseQueueMessage = BaseQueueMessage> {
  id: string
  body: TMessage
  receiveCount: number
  ack(): Promise<void>
  retry(options?: RetryOptions): Promise<void>
  moveToDLQ(error: Error): Promise<void>
}

/**
 * Retry options for failed messages
 */
export interface RetryOptions {
  delaySeconds?: number
  maxRetries?: number
  backoffMultiplier?: number
  backoffStrategy?: 'linear' | 'exponential'
}

/**
 * Queue service configuration
 */
export interface QueueServiceConfig<TMessage extends BaseQueueMessage = BaseQueueMessage> {
  adapter: QueueAdapter<TMessage>
  logger?: ILogger
  defaultRetryLimit?: number
  defaultRetryDelay?: number
  batchSize?: number
  enableDLQ?: boolean
  dlqMaxRetries?: number
  dlqBackoffStrategy?: 'linear' | 'exponential'
}

/**
 * Type-safe message handler
 */
export interface MessageHandler<TType extends string, TData> {
  type: TType
  handler: (data: TData, context: HandlerContext) => Promise<void>
  onError?: (error: Error, data: TData, context: HandlerContext) => Promise<void>
  retryable?: boolean
  maxRetries?: number
}

/**
 * Handler execution context
 */
export interface HandlerContext {
  messageId: string
  messageType: string
  retryCount: number
  timestamp: number
  metadata?: Record<string, unknown>
  logger?: ILogger
}

/**
 * Processing result statistics
 */
export interface ProcessResult {
  processed: number
  failed: number
  retried: number
  movedToDLQ: number
  errors: ProcessingError[]
}

/**
 * Processing error details
 */
export interface ProcessingError {
  messageId: string
  messageType: string
  error: Error
  timestamp: Date
  willRetry: boolean
}

/**
 * Dead Letter Queue statistics
 */
export interface DLQStatistics {
  messageCount: number
  oldestMessage?: Date
  newestMessage?: Date
  messagesByType: Record<string, number>
}

/**
 * Type-safe handler registry
 */
class HandlerRegistry<TRegistry extends MessageTypeRegistry> {
  private handlers = new Map<keyof TRegistry, MessageHandler<string, unknown>>()

  register<K extends keyof TRegistry>(
    type: K,
    handler: MessageHandler<K & string, TRegistry[K]>
  ): void {
    if (this.handlers.has(type)) {
      throw new Error(`Handler for type "${String(type)}" already registered`)
    }
    this.handlers.set(type, handler as MessageHandler<string, unknown>)
  }

  get<K extends keyof TRegistry>(type: K): MessageHandler<K & string, TRegistry[K]> | undefined {
    return this.handlers.get(type) as MessageHandler<K & string, TRegistry[K]> | undefined
  }

  has(type: string): boolean {
    return this.handlers.has(type)
  }

  getAll(): Map<keyof TRegistry, MessageHandler<string, unknown>> {
    return new Map(this.handlers)
  }
}

/**
 * Fully typed queue service
 */
export class TypedQueueService<TRegistry extends MessageTypeRegistry = MessageTypeRegistry> {
  private adapter: QueueAdapter<MessageTypes<TRegistry>>
  private logger?: ILogger
  private handlers: HandlerRegistry<TRegistry>
  private config: Omit<Required<QueueServiceConfig<MessageTypes<TRegistry>>>, 'logger'> & {
    logger?: ILogger
  }
  private processingStats = {
    totalProcessed: 0,
    totalFailed: 0,
    totalRetried: 0,
    totalMovedToDLQ: 0
  }

  constructor(config: QueueServiceConfig<MessageTypes<TRegistry>>) {
    this.adapter = config.adapter
    this.logger = config.logger
    this.handlers = new HandlerRegistry<TRegistry>()

    // Apply defaults
    this.config = {
      adapter: config.adapter,
      logger: config.logger,
      defaultRetryLimit: config.defaultRetryLimit ?? 3,
      defaultRetryDelay: config.defaultRetryDelay ?? 30,
      batchSize: config.batchSize ?? 10,
      enableDLQ: config.enableDLQ ?? true,
      dlqMaxRetries: config.dlqMaxRetries ?? 5,
      dlqBackoffStrategy: config.dlqBackoffStrategy ?? 'exponential'
    }
  }

  /**
   * Register a type-safe message handler
   */
  registerHandler<K extends keyof TRegistry>(
    type: K,
    handler: Omit<MessageHandler<K & string, TRegistry[K]>, 'type'>
  ): void {
    this.handlers.register(type, {
      ...handler,
      type: type as K & string
    })

    this.logger?.info('Message handler registered', { type: String(type) })
  }

  /**
   * Send a typed message to the queue
   */
  async send<K extends keyof TRegistry>(
    type: K,
    data: TRegistry[K],
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const message: QueueMessage<K & string, TRegistry[K]> = {
      id: this.generateMessageId(),
      type: type as K & string,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      metadata
    }

    try {
      await this.adapter.send(message as MessageTypes<TRegistry>)
      this.logger?.debug('Message sent to queue', {
        type: String(type),
        messageId: message.id
      })
    } catch (error) {
      this.logger?.error('Failed to send message', {
        type: String(type),
        error
      })
      throw error
    }
  }

  /**
   * Send multiple messages as a batch
   */
  async sendBatch<K extends keyof TRegistry>(
    messages: Array<{
      type: K
      data: TRegistry[K]
      metadata?: Record<string, unknown>
    }>
  ): Promise<void> {
    const batch = messages.map(msg => ({
      id: this.generateMessageId(),
      type: msg.type as K & string,
      data: msg.data,
      timestamp: Date.now(),
      retryCount: 0,
      metadata: msg.metadata
    }))

    try {
      await this.adapter.sendBatch(batch as MessageTypes<TRegistry>[])
      this.logger?.info('Batch sent to queue', {
        count: batch.length
      })
    } catch (error) {
      this.logger?.error('Failed to send batch', {
        count: batch.length,
        error
      })
      throw error
    }
  }

  /**
   * Process messages from the queue
   */
  async processMessages(maxMessages?: number): Promise<ProcessResult> {
    const messages = await this.adapter.receive(maxMessages ?? this.config.batchSize)
    const result: ProcessResult = {
      processed: 0,
      failed: 0,
      retried: 0,
      movedToDLQ: 0,
      errors: []
    }

    for (const message of messages) {
      try {
        await this.processMessage(message, result)
      } catch (error) {
        this.logger?.error('Failed to process message', {
          messageId: message.id,
          error
        })
      }
    }

    // Update global stats
    this.processingStats.totalProcessed += result.processed
    this.processingStats.totalFailed += result.failed
    this.processingStats.totalRetried += result.retried
    this.processingStats.totalMovedToDLQ += result.movedToDLQ

    return result
  }

  /**
   * Process a single message
   */
  private async processMessage(
    message: ReceivedMessage<MessageTypes<TRegistry>>,
    result: ProcessResult
  ): Promise<void> {
    const { type, data, metadata, retryCount = 0 } = message.body
    const handler = this.handlers.get(type as keyof TRegistry)

    if (!handler) {
      this.logger?.warn('No handler registered for message type', { type })
      await message.ack()
      return
    }

    const context: HandlerContext = {
      messageId: message.id,
      messageType: type,
      retryCount,
      timestamp: message.body.timestamp,
      metadata,
      logger: this.logger
    }

    try {
      await handler.handler(data, context)
      await message.ack()
      result.processed++
    } catch (error) {
      await this.handleProcessingError(
        message,
        handler as MessageHandler<string, unknown>,
        error as Error,
        context,
        result
      )
    }
  }

  /**
   * Handle processing errors with retry logic
   */
  private async handleProcessingError(
    message: ReceivedMessage<MessageTypes<TRegistry>>,
    handler: MessageHandler<string, unknown>,
    error: Error,
    context: HandlerContext,
    result: ProcessResult
  ): Promise<void> {
    const maxRetries = handler.maxRetries ?? this.config.defaultRetryLimit
    const retryCount = message.body.retryCount ?? 0

    // Log the error
    this.logger?.error('Message processing failed', {
      messageId: message.id,
      messageType: message.body.type,
      error: error.message,
      retryCount
    })

    // Add to errors list
    result.errors.push({
      messageId: message.id,
      messageType: message.body.type,
      error,
      timestamp: new Date(),
      willRetry: retryCount < maxRetries && (handler.retryable ?? true)
    })

    // Call error handler if provided
    if (handler.onError) {
      try {
        await handler.onError(error, message.body.data, context)
      } catch (onErrorErr) {
        this.logger?.error('Error handler failed', {
          error: onErrorErr
        })
      }
    }

    // Determine if we should retry
    if (retryCount < maxRetries && (handler.retryable ?? true)) {
      const delay = this.calculateRetryDelay(retryCount)

      // Update retry count on the message for next attempt
      message.body.retryCount = retryCount + 1

      await message.retry({
        delaySeconds: delay,
        maxRetries,
        backoffStrategy: this.config.dlqBackoffStrategy
      })
      result.retried++
    } else if (this.config.enableDLQ) {
      // Move to DLQ if retries exhausted
      await message.moveToDLQ(error)
      result.movedToDLQ++
    } else {
      // No DLQ, just acknowledge and lose the message
      await message.ack()
      result.failed++
    }
  }

  /**
   * Calculate retry delay with backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = this.config.defaultRetryDelay

    if (this.config.dlqBackoffStrategy === 'exponential') {
      return baseDelay * Math.pow(2, retryCount)
    }

    return baseDelay * (retryCount + 1)
  }

  /**
   * Process messages from Dead Letter Queue
   */
  async processDLQ(maxMessages?: number): Promise<ProcessResult> {
    if (!this.adapter.receiveDLQ) {
      throw new Error('DLQ not supported by adapter')
    }

    const messages = await this.adapter.receiveDLQ(maxMessages ?? this.config.batchSize)
    const result: ProcessResult = {
      processed: 0,
      failed: 0,
      retried: 0,
      movedToDLQ: 0,
      errors: []
    }

    for (const message of messages) {
      // Attempt to reprocess with increased retry limit
      message.body.retryCount = 0 // Reset retry count for DLQ processing
      await this.processMessage(message, result)
    }

    return result
  }

  /**
   * Get DLQ statistics
   */
  async getDLQStats(): Promise<DLQStatistics | null> {
    if (!this.adapter.getDLQStats) {
      return null
    }

    return this.adapter.getDLQStats()
  }

  /**
   * Get processing statistics
   */
  getStats(): typeof this.processingStats {
    return { ...this.processingStats }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Clear all handlers (useful for testing)
   */
  clearHandlers(): void {
    this.handlers = new HandlerRegistry<TRegistry>()
  }
}

/**
 * Create a typed queue service with message registry
 */
export function createTypedQueueService<T extends MessageTypeRegistry>(
  config: QueueServiceConfig<MessageTypes<T>>
): TypedQueueService<T> {
  return new TypedQueueService<T>(config)
}
