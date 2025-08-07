/**
 * Typed Cloudflare Queue Adapter
 *
 * Fully typed implementation of queue adapter for Cloudflare Queues
 * Includes DLQ support and batch operations
 *
 * @module services/queue-adapters/typed-cloudflare-adapter
 */

import type { ILogger } from '../../core/interfaces/logger'
import type {
  BaseQueueMessage,
  DLQStatistics,
  QueueAdapter,
  ReceivedMessage,
  RetryOptions
} from '../queue-service-typed'

/**
 * Cloudflare Queue binding types
 */
interface CloudflareQueue<T = unknown> {
  send(message: T, options?: QueueSendOptions): Promise<void>
  sendBatch(messages: MessageSendRequest<T>[]): Promise<void>
}

interface QueueSendOptions {
  contentType?: 'json' | 'text' | 'bytes' | 'v8'
  delaySeconds?: number
}

interface MessageSendRequest<T = unknown> {
  body: T
  contentType?: 'json' | 'text' | 'bytes' | 'v8'
  delaySeconds?: number
}

interface CloudflareReceivedMessage<T = unknown> {
  readonly id: string
  readonly timestamp: Date
  readonly body: T
  readonly attempts: number
  ack(): void
  retry(options?: { delaySeconds?: number }): void
}

interface MessageBatch<T = unknown> {
  readonly queue: string
  readonly messages: CloudflareReceivedMessage<T>[]
  ackAll(): void
  retryAll(options?: { delaySeconds?: number }): void
}

/**
 * Configuration for Cloudflare Queue Adapter
 */
export interface CloudflareQueueConfig {
  queue: CloudflareQueue
  dlqQueue?: CloudflareQueue
  logger?: ILogger
  maxBatchSize?: number
  defaultContentType?: 'json' | 'text' | 'bytes' | 'v8'
}

/**
 * Typed Cloudflare Queue Adapter Implementation
 */
export class TypedCloudflareQueueAdapter<TMessage extends BaseQueueMessage = BaseQueueMessage>
  implements QueueAdapter<TMessage>
{
  private queue: CloudflareQueue<TMessage>
  private dlqQueue?: CloudflareQueue<TMessage>
  private logger?: ILogger
  private maxBatchSize: number
  private defaultContentType: 'json' | 'text' | 'bytes' | 'v8'
  private pendingMessages: CloudflareReceivedMessage<TMessage>[] = []
  private dlqStats: Map<string, number> = new Map()

  constructor(config: CloudflareQueueConfig) {
    this.queue = config.queue as CloudflareQueue<TMessage>
    this.dlqQueue = config.dlqQueue as CloudflareQueue<TMessage> | undefined
    this.logger = config.logger
    this.maxBatchSize = config.maxBatchSize ?? 25 // Cloudflare limit
    this.defaultContentType = config.defaultContentType ?? 'json'
  }

  /**
   * Send a single message to the queue
   */
  async send(message: TMessage): Promise<void> {
    try {
      await this.queue.send(message, {
        contentType: this.defaultContentType,
        delaySeconds: 0
      })

      this.logger?.debug('Message sent to Cloudflare Queue', {
        messageId: message.id,
        type: message.type
      })
    } catch (error) {
      this.logger?.error('Failed to send message to Cloudflare Queue', {
        messageId: message.id,
        error
      })
      throw error
    }
  }

  /**
   * Send multiple messages as a batch
   */
  async sendBatch(messages: TMessage[]): Promise<void> {
    // Split into chunks if exceeding max batch size
    const chunks = this.chunkArray(messages, this.maxBatchSize)

    for (const chunk of chunks) {
      const batch: MessageSendRequest<TMessage>[] = chunk.map(msg => ({
        body: msg,
        contentType: this.defaultContentType,
        delaySeconds: 0
      }))

      try {
        await this.queue.sendBatch(batch)

        this.logger?.debug('Batch sent to Cloudflare Queue', {
          count: chunk.length
        })
      } catch (error) {
        this.logger?.error('Failed to send batch to Cloudflare Queue', {
          count: chunk.length,
          error
        })
        throw error
      }
    }
  }

  /**
   * Receive messages from the queue
   * Note: In Cloudflare Workers, messages are pushed via queue handler
   */
  async receive(maxMessages?: number): Promise<ReceivedMessage<TMessage>[]> {
    const messages = this.pendingMessages.splice(0, maxMessages ?? this.maxBatchSize)

    return messages.map(msg => this.wrapMessage(msg, false))
  }

  /**
   * Delete a message (acknowledge it)
   */
  async deleteMessage(messageId: string): Promise<void> {
    // In Cloudflare, acknowledgment is handled via message.ack()
    // This is called after the message wrapper calls ack
    this.logger?.debug('Message acknowledged', { messageId })
  }

  /**
   * Send message to Dead Letter Queue
   */
  async sendToDLQ(message: TMessage, error: Error): Promise<void> {
    if (!this.dlqQueue) {
      throw new Error('DLQ not configured')
    }

    // Add error information to metadata
    const dlqMessage: TMessage = {
      ...message,
      metadata: {
        ...message.metadata,
        dlqReason: error.message,
        dlqTimestamp: Date.now(),
        originalType: message.type
      }
    }

    try {
      await this.dlqQueue.send(dlqMessage, {
        contentType: this.defaultContentType
      })

      // Update DLQ stats
      const count = this.dlqStats.get(message.type) ?? 0
      this.dlqStats.set(message.type, count + 1)

      this.logger?.info('Message moved to DLQ', {
        messageId: message.id,
        type: message.type,
        reason: error.message
      })
    } catch (dlqError) {
      this.logger?.error('Failed to send message to DLQ', {
        messageId: message.id,
        error: dlqError
      })
      throw dlqError
    }
  }

  /**
   * Receive messages from DLQ
   */
  async receiveDLQ(_maxMessages?: number): Promise<ReceivedMessage<TMessage>[]> {
    // In production, this would be handled by a separate queue handler
    // For now, return empty array
    return []
  }

  /**
   * Get DLQ statistics
   */
  async getDLQStats(): Promise<DLQStatistics> {
    const messagesByType: Record<string, number> = {}

    for (const [type, count] of this.dlqStats) {
      messagesByType[type] = count
    }

    const totalMessages = Array.from(this.dlqStats.values()).reduce((a, b) => a + b, 0)

    return {
      messageCount: totalMessages,
      oldestMessage: undefined, // Would need to track this
      newestMessage: totalMessages > 0 ? new Date() : undefined,
      messagesByType
    }
  }

  /**
   * Handle incoming message batch from Cloudflare
   * This is called by the queue handler in the worker
   */
  async handleBatch(batch: MessageBatch<TMessage>): Promise<void> {
    // Store messages for processing
    this.pendingMessages.push(...batch.messages)

    this.logger?.info('Received message batch from Cloudflare', {
      count: batch.messages.length,
      queue: batch.queue
    })
  }

  /**
   * Wrap Cloudflare message in our interface
   */
  private wrapMessage(
    cfMessage: CloudflareReceivedMessage<TMessage>,
    isDLQ: boolean
  ): ReceivedMessage<TMessage> {
    return {
      id: cfMessage.id,
      body: cfMessage.body,
      receiveCount: cfMessage.attempts,

      ack: async () => {
        cfMessage.ack()
        await this.deleteMessage(cfMessage.id)
      },

      retry: async (options?: RetryOptions) => {
        const delay = options?.delaySeconds ?? 30
        cfMessage.retry({ delaySeconds: delay })

        this.logger?.debug('Message scheduled for retry', {
          messageId: cfMessage.id,
          delaySeconds: delay
        })
      },

      moveToDLQ: async (error: Error) => {
        if (!isDLQ && this.dlqQueue) {
          await this.sendToDLQ(cfMessage.body, error)
          cfMessage.ack() // Acknowledge original message
        } else {
          // If already in DLQ or no DLQ configured, just acknowledge
          cfMessage.ack()
        }
      }
    }
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []

    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }

    return chunks
  }

  /**
   * Get adapter statistics
   */
  getStats(): {
    pendingMessages: number
    dlqMessages: number
    maxBatchSize: number
  } {
    const dlqMessages = Array.from(this.dlqStats.values()).reduce((a, b) => a + b, 0)

    return {
      pendingMessages: this.pendingMessages.length,
      dlqMessages,
      maxBatchSize: this.maxBatchSize
    }
  }
}

/**
 * Create a typed Cloudflare Queue adapter
 */
export function createCloudflareQueueAdapter<T extends BaseQueueMessage>(
  config: CloudflareQueueConfig
): TypedCloudflareQueueAdapter<T> {
  return new TypedCloudflareQueueAdapter<T>(config)
}
