/**
 * Cloudflare Queue adapter for QueueService
 */

import type { Message, MessageBatch, Queue } from '@cloudflare/workers-types'

import type { QueueAdapter, QueueMessage, ReceivedMessage } from '../queue-service'

export class CloudflareQueueAdapter<T = unknown> implements QueueAdapter<T> {
  constructor(private queue: Queue<QueueMessage<T>>) {}

  async send(message: QueueMessage<T>): Promise<void> {
    await this.queue.send(message)
  }

  async sendBatch(messages: QueueMessage<T>[]): Promise<void> {
    // Cloudflare Queues have a batch limit of 100 messages
    const BATCH_LIMIT = 100

    for (let i = 0; i < messages.length; i += BATCH_LIMIT) {
      const batch = messages.slice(i, i + BATCH_LIMIT)
      await this.queue.sendBatch(batch.map(msg => ({ body: msg })))
    }
  }

  async receive(_maxMessages: number = 10): Promise<ReceivedMessage<T>[]> {
    // In Cloudflare Workers, messages are typically received via the queue handler
    // This method would not be used in typical Cloudflare Workers setup
    throw new Error(
      'CloudflareQueueAdapter.receive() is not implemented. ' +
        'Use the queue handler in your worker instead.'
    )
  }

  async deleteMessage(_messageId: string): Promise<void> {
    // Message deletion is handled via ack() in Cloudflare Queues
    throw new Error(
      'CloudflareQueueAdapter.deleteMessage() is not implemented. ' + 'Use message.ack() instead.'
    )
  }

  /**
   * Convert Cloudflare MessageBatch to ReceivedMessage array
   * This is used in the queue handler
   */
  static fromMessageBatch<T>(batch: MessageBatch<QueueMessage<T>>): ReceivedMessage<T>[] {
    return batch.messages.map(msg => new CloudflareReceivedMessage(msg))
  }
}

/**
 * Cloudflare implementation of ReceivedMessage
 */
class CloudflareReceivedMessage<T> implements ReceivedMessage<T> {
  constructor(private message: Message<QueueMessage<T>>) {}

  get id(): string {
    return this.message.id
  }

  get body(): QueueMessage<T> {
    return this.message.body
  }

  get receiveCount(): number {
    return this.message.attempts || 1
  }

  async ack(): Promise<void> {
    this.message.ack()
  }

  async retry(options?: { delaySeconds?: number }): Promise<void> {
    // Update retry count in the message body
    this.message.body.retryCount = (this.message.body.retryCount || 0) + 1

    // Retry message
    this.message.retry({
      delaySeconds: options?.delaySeconds
    })
  }
}

/**
 * Helper to create a queue handler for Cloudflare Workers
 */
export function createCloudflareQueueHandler<T>(
  queueService: import('../queue-service').QueueService<T>
) {
  return async (batch: MessageBatch<QueueMessage<T>>) => {
    const messages = CloudflareQueueAdapter.fromMessageBatch(batch)
    const result = {
      processed: 0,
      failed: 0,
      retried: 0,
      errors: [] as Array<{ messageId: string; error: Error }>
    }

    // Process each message using the queue service
    const promises = messages.map(message => queueService.processMessage(message, result))

    await Promise.all(promises)

    // Log results
    if (result.errors.length > 0) {
      console.error('Queue processing errors:', result.errors)
    }

    return result
  }
}
