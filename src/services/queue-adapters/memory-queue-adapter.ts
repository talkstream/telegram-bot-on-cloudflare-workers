/**
 * In-memory queue adapter for testing and development
 */

import type { QueueAdapter, QueueMessage, ReceivedMessage } from '../queue-service'

interface MemoryMessage<T> {
  id: string
  body: QueueMessage<T>
  receiveCount: number
  visibleAt: number
  acked: boolean
}

export class MemoryQueueAdapter<T = unknown> implements QueueAdapter<T> {
  private messages: MemoryMessage<T>[] = []
  private messageIdCounter = 0
  private processingMessages = new Map<string, MemoryMessage<T>>()

  async send(message: QueueMessage<T>): Promise<void> {
    const id = `msg-${++this.messageIdCounter}`
    this.messages.push({
      id,
      body: { ...message, id },
      receiveCount: 0,
      visibleAt: Date.now(),
      acked: false
    })
  }

  async sendBatch(messages: QueueMessage<T>[]): Promise<void> {
    for (const message of messages) {
      await this.send(message)
    }
  }

  async receive(maxMessages: number = 10): Promise<ReceivedMessage<T>[]> {
    const now = Date.now()
    const available = this.messages
      .filter(msg => !msg.acked && msg.visibleAt <= now)
      .slice(0, maxMessages)

    const received: ReceivedMessage<T>[] = []

    for (const msg of available) {
      // Remove from queue and add to processing
      this.messages = this.messages.filter(m => m.id !== msg.id)
      msg.receiveCount++
      this.processingMessages.set(msg.id, msg)

      received.push(new MemoryReceivedMessage(msg, this))
    }

    return received
  }

  async deleteMessage(messageId: string): Promise<void> {
    this.processingMessages.delete(messageId)
    this.messages = this.messages.filter(m => m.id !== messageId)
  }

  /**
   * Return message to queue (used by retry)
   */
  returnToQueue(message: MemoryMessage<T>, delaySeconds: number = 0): void {
    this.processingMessages.delete(message.id)
    message.visibleAt = Date.now() + delaySeconds * 1000
    this.messages.push(message)
  }

  /**
   * Acknowledge message (remove from processing)
   */
  acknowledgeMessage(messageId: string): void {
    const msg = this.processingMessages.get(messageId)
    if (msg) {
      msg.acked = true
      this.processingMessages.delete(messageId)
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      pending: this.messages.filter(m => !m.acked).length,
      processing: this.processingMessages.size,
      total: this.messages.length + this.processingMessages.size
    }
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.messages = []
    this.processingMessages.clear()
    this.messageIdCounter = 0
  }
}

/**
 * In-memory implementation of ReceivedMessage
 */
class MemoryReceivedMessage<T> implements ReceivedMessage<T> {
  constructor(
    private message: MemoryMessage<T>,
    private adapter: MemoryQueueAdapter<T>
  ) {}

  get id(): string {
    return this.message.id
  }

  get body(): QueueMessage<T> {
    return this.message.body
  }

  get receiveCount(): number {
    return this.message.receiveCount
  }

  async ack(): Promise<void> {
    this.adapter.acknowledgeMessage(this.message.id)
  }

  async retry(options?: { delaySeconds?: number }): Promise<void> {
    // Update retry count
    this.message.body.retryCount = (this.message.body.retryCount || 0) + 1

    // Return to queue with delay
    this.adapter.returnToQueue(this.message, options?.delaySeconds || 0)
  }
}
