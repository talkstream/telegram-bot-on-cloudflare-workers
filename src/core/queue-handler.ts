/**
 * Queue Handler
 *
 * Processes messages from Cloudflare Queues
 */

import type { Env } from '../config/env'
import type { ICloudPlatformConnector } from '../core/interfaces/cloud-platform'

import { getCloudPlatformConnector } from './cloud/cloud-platform-cache'
import { EventBus } from './events/event-bus'

interface MessageBatch<T = unknown> {
  readonly queue: string
  readonly messages: Array<{
    readonly id: string
    readonly timestamp: Date
    readonly body: T
    readonly attempts: number
    ack(): void
    retry(options?: { delaySeconds?: number }): void
  }>
  ackAll(): void
  retryAll(options?: { delaySeconds?: number }): void
}

/**
 * Handle queue messages
 */
export async function handleQueue(
  batch: MessageBatch<unknown>,
  env: Env,
  _ctx: ExecutionContext
): Promise<void> {
  const eventBus = new EventBus()
  const platform = await getCloudPlatformConnector(env)

  // Process messages silently

  for (const message of batch.messages) {
    try {
      // Emit event for message processing
      await eventBus.emit(
        'queue:message:received',
        {
          id: message.id,
          body: message.body,
          attempts: message.attempts,
          queue: batch.queue
        },
        'queue'
      )

      // Process message based on type
      const messageBody = message.body as Record<string, unknown>
      if (messageBody.type === 'task') {
        // Handle task message
        await processTask(messageBody, eventBus, platform)
      }

      // Acknowledge successful processing
      message.ack()

      await eventBus.emit(
        'queue:message:processed',
        {
          id: message.id,
          queue: batch.queue
        },
        'queue'
      )
    } catch (error) {
      console.error(`[Queue] Error processing message ${message.id}:`, error)

      // Retry with exponential backoff
      const delaySeconds = Math.min(300, Math.pow(2, message.attempts) * 10)
      message.retry({ delaySeconds })

      await eventBus.emit(
        'queue:message:failed',
        {
          id: message.id,
          error,
          queue: batch.queue
        },
        'queue'
      )
    }
  }
}

async function processTask(
  task: Record<string, unknown>,
  eventBus: EventBus,
  _platform: ICloudPlatformConnector
): Promise<void> {
  // Task processing logic - process silently
  await eventBus.emit('task:processing', { task }, 'queue')

  // Simulate task processing
  await new Promise(resolve => setTimeout(resolve, 100))

  await eventBus.emit('task:completed', { task }, 'queue')
}
