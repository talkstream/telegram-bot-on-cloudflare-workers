/**
 * Typed In-Memory Queue Adapter for Testing
 *
 * Provides fully typed queue operations with in-memory storage
 * Perfect for unit tests and local development
 *
 * @module services/queue-adapters/typed-memory-adapter
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
 * Configuration for Memory Queue Adapter
 */
export interface MemoryQueueConfig {
  logger?: ILogger
  maxQueueSize?: number
  autoAck?: boolean
  simulateLatency?: number
  failureRate?: number // For testing error scenarios
}

/**
 * Internal message storage with metadata
 */
interface StoredMessage<T extends BaseQueueMessage> {
  id: string
  message: T
  receiveCount: number
  timestamp: Date
  visible: boolean
  ackDeadline?: Date
  dlq?: boolean
}

/**
 * Processing statistics type
 */
interface ProcessingStats {
  totalSent: number
  totalReceived: number
  totalAcked: number
  totalFailed: number
  avgProcessingTime: number
}

/**
 * Typed Memory Queue Adapter Implementation
 */
export class TypedMemoryQueueAdapter<TMessage extends BaseQueueMessage = BaseQueueMessage>
  implements QueueAdapter<TMessage>
{
  private queue: Map<string, StoredMessage<TMessage>> = new Map()
  private dlq: Map<string, StoredMessage<TMessage>> = new Map()
  private logger?: ILogger
  private maxQueueSize: number
  private autoAck: boolean
  private simulateLatency: number
  private failureRate: number
  private messageCounter = 0
  private processingStats: ProcessingStats = {
    totalSent: 0,
    totalReceived: 0,
    totalAcked: 0,
    totalFailed: 0,
    avgProcessingTime: 0
  }

  constructor(config: MemoryQueueConfig = {}) {
    this.logger = config.logger
    this.maxQueueSize = config.maxQueueSize ?? 1000
    this.autoAck = config.autoAck ?? false
    this.simulateLatency = config.simulateLatency ?? 0
    this.failureRate = config.failureRate ?? 0
  }

  /**
   * Send a single message to the queue
   */
  async send(message: TMessage): Promise<void> {
    await this.simulateDelay()

    if (this.shouldSimulateFailure()) {
      throw new Error('Simulated send failure')
    }

    if (this.queue.size >= this.maxQueueSize) {
      throw new Error(`Queue size limit reached: ${this.maxQueueSize}`)
    }

    const messageId = message.id ?? this.generateMessageId()
    const storedMessage: StoredMessage<TMessage> = {
      id: messageId,
      message: {
        ...message,
        id: messageId
      },
      receiveCount: 0,
      timestamp: new Date(),
      visible: true,
      dlq: false
    }

    this.queue.set(messageId, storedMessage)
    this.processingStats.totalSent++

    this.logger?.debug('Message sent to memory queue', {
      messageId,
      type: message.type,
      queueSize: this.queue.size
    })
  }

  /**
   * Send multiple messages as a batch
   */
  async sendBatch(messages: TMessage[]): Promise<void> {
    await this.simulateDelay()

    if (this.shouldSimulateFailure()) {
      throw new Error('Simulated batch send failure')
    }

    const remainingCapacity = this.maxQueueSize - this.queue.size
    if (messages.length > remainingCapacity) {
      throw new Error(
        `Batch size exceeds queue capacity. Capacity: ${remainingCapacity}, Batch: ${messages.length}`
      )
    }

    for (const message of messages) {
      await this.send(message)
    }

    this.logger?.info('Batch sent to memory queue', {
      count: messages.length,
      queueSize: this.queue.size
    })
  }

  /**
   * Receive messages from the queue
   */
  async receive(maxMessages?: number): Promise<ReceivedMessage<TMessage>[]> {
    await this.simulateDelay()

    const limit = maxMessages ?? 10
    const messages: ReceivedMessage<TMessage>[] = []

    for (const [_id, stored] of this.queue) {
      if (messages.length >= limit) break

      if (!stored.visible || stored.dlq) continue

      // Check ack deadline (skip messages that are being processed)
      if (stored.ackDeadline && stored.ackDeadline > new Date()) {
        continue
      }

      // Mark as invisible for processing
      stored.visible = false
      stored.ackDeadline = new Date(Date.now() + 30000) // 30 second visibility timeout
      stored.receiveCount++

      messages.push(this.wrapMessage(stored))
      this.processingStats.totalReceived++
    }

    this.logger?.debug('Messages received from memory queue', {
      count: messages.length,
      requestedCount: limit
    })

    return messages
  }

  /**
   * Delete a message (acknowledge it)
   */
  async deleteMessage(messageId: string): Promise<void> {
    await this.simulateDelay()

    const message = this.queue.get(messageId)
    if (!message) {
      this.logger?.warn('Attempted to delete non-existent message', { messageId })
      return
    }

    this.queue.delete(messageId)
    this.processingStats.totalAcked++

    this.logger?.debug('Message acknowledged', {
      messageId,
      type: message.message.type
    })
  }

  /**
   * Send message to Dead Letter Queue
   */
  async sendToDLQ(message: TMessage, error: Error): Promise<void> {
    await this.simulateDelay()

    const messageId = message.id ?? this.generateMessageId()
    const dlqMessage: TMessage = {
      ...message,
      id: messageId,
      metadata: {
        ...message.metadata,
        dlqReason: error.message,
        dlqTimestamp: Date.now(),
        originalType: message.type,
        dlqError: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      }
    }

    const storedMessage: StoredMessage<TMessage> = {
      id: messageId,
      message: dlqMessage,
      receiveCount: 0,
      timestamp: new Date(),
      visible: true,
      dlq: true
    }

    // Remove from main queue if exists
    if (message.id) {
      this.queue.delete(message.id)
    }

    // Add to DLQ
    this.dlq.set(messageId, storedMessage)
    this.processingStats.totalFailed++

    this.logger?.info('Message moved to DLQ', {
      messageId,
      type: message.type,
      reason: error.message,
      dlqSize: this.dlq.size
    })
  }

  /**
   * Receive messages from DLQ
   */
  async receiveDLQ(maxMessages?: number): Promise<ReceivedMessage<TMessage>[]> {
    await this.simulateDelay()

    const limit = maxMessages ?? 10
    const messages: ReceivedMessage<TMessage>[] = []

    for (const [_id, stored] of this.dlq) {
      if (messages.length >= limit) break

      if (!stored.visible) continue

      // Mark as invisible for processing
      stored.visible = false
      stored.ackDeadline = new Date(Date.now() + 30000)
      stored.receiveCount++

      messages.push(this.wrapMessage(stored, true))
    }

    this.logger?.debug('Messages received from DLQ', {
      count: messages.length,
      requestedCount: limit
    })

    return messages
  }

  /**
   * Get DLQ statistics
   */
  async getDLQStats(): Promise<DLQStatistics> {
    const messagesByType: Record<string, number> = {}
    let oldestMessage: Date | undefined
    let newestMessage: Date | undefined

    for (const stored of this.dlq.values()) {
      // Count by type
      const type = stored.message.type
      messagesByType[type] = (messagesByType[type] ?? 0) + 1

      // Track oldest/newest
      if (!oldestMessage || stored.timestamp < oldestMessage) {
        oldestMessage = stored.timestamp
      }
      if (!newestMessage || stored.timestamp > newestMessage) {
        newestMessage = stored.timestamp
      }
    }

    return {
      messageCount: this.dlq.size,
      oldestMessage,
      newestMessage,
      messagesByType
    }
  }

  /**
   * Wrap stored message in ReceivedMessage interface
   */
  private wrapMessage(stored: StoredMessage<TMessage>, isDLQ = false): ReceivedMessage<TMessage> {
    return {
      id: stored.id,
      body: stored.message,
      receiveCount: stored.receiveCount,

      ack: async () => {
        if (this.autoAck) {
          this.logger?.debug('Auto-ack enabled, skipping manual ack')
          return
        }

        if (isDLQ) {
          this.dlq.delete(stored.id)
        } else {
          await this.deleteMessage(stored.id)
        }
      },

      retry: async (options?: RetryOptions) => {
        const delay = options?.delaySeconds ?? 30

        // Update retry count on the message
        stored.message.retryCount = (stored.message.retryCount ?? 0) + 1

        // Make message visible again immediately for simple testing
        // In production, you'd use actual delay
        if (delay === 0 || delay < 0.1) {
          // Immediate retry for tests
          stored.visible = true
          stored.ackDeadline = undefined
        } else {
          // Schedule visibility after delay
          stored.visible = false
          stored.ackDeadline = new Date(Date.now() + delay * 1000)

          setTimeout(() => {
            stored.visible = true
            stored.ackDeadline = undefined
          }, delay * 1000)
        }

        this.processingStats.totalFailed++

        this.logger?.debug('Message scheduled for retry', {
          messageId: stored.id,
          delaySeconds: delay,
          retryCount: stored.message.retryCount
        })
      },

      moveToDLQ: async (error: Error) => {
        if (!isDLQ) {
          await this.sendToDLQ(stored.message, error)
        } else {
          // Already in DLQ, just acknowledge
          this.dlq.delete(stored.id)
        }
      }
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    this.messageCounter++
    return `mem-${Date.now()}-${this.messageCounter}`
  }

  /**
   * Simulate network latency
   */
  private async simulateDelay(): Promise<void> {
    if (this.simulateLatency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.simulateLatency))
    }
  }

  /**
   * Determine if we should simulate a failure
   */
  private shouldSimulateFailure(): boolean {
    return this.failureRate > 0 && Math.random() < this.failureRate
  }

  /**
   * Clear all messages (useful for testing)
   */
  clear(): void {
    this.queue.clear()
    this.dlq.clear()
    this.processingStats = {
      totalSent: 0,
      totalReceived: 0,
      totalAcked: 0,
      totalFailed: 0,
      avgProcessingTime: 0
    }
    this.messageCounter = 0

    this.logger?.info('Memory queue cleared')
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queueSize: number
    dlqSize: number
    processing: ProcessingStats
    visibleMessages: number
    invisibleMessages: number
  } {
    let visibleCount = 0
    let invisibleCount = 0

    for (const stored of this.queue.values()) {
      if (stored.visible) {
        visibleCount++
      } else {
        invisibleCount++
      }
    }

    return {
      queueSize: this.queue.size,
      dlqSize: this.dlq.size,
      processing: { ...this.processingStats },
      visibleMessages: visibleCount,
      invisibleMessages: invisibleCount
    }
  }

  /**
   * Peek at messages without consuming them
   */
  peekMessages(limit = 10): TMessage[] {
    const messages: TMessage[] = []

    for (const stored of this.queue.values()) {
      if (messages.length >= limit) break
      if (stored.visible && !stored.dlq) {
        messages.push(stored.message)
      }
    }

    return messages
  }

  /**
   * Peek at DLQ messages without consuming them
   */
  peekDLQ(limit = 10): TMessage[] {
    const messages: TMessage[] = []

    for (const stored of this.dlq.values()) {
      if (messages.length >= limit) break
      messages.push(stored.message)
    }

    return messages
  }
}

/**
 * Create a typed memory queue adapter
 */
export function createMemoryQueueAdapter<T extends BaseQueueMessage>(
  config?: MemoryQueueConfig
): TypedMemoryQueueAdapter<T> {
  return new TypedMemoryQueueAdapter<T>(config)
}
