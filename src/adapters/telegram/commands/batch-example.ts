import { logger } from '@/lib/logger'
import type { CommandHandler } from '@/types'

/**
 * Example command demonstrating how to use the request batcher
 * This shows how to send multiple messages efficiently
 */
export const batchExampleCommand: CommandHandler = async ctx => {
  const userId = ctx.from?.id

  if (!userId) {
    await ctx.reply('❌ Unable to identify user')
    return
  }

  try {
    // Check if batcher is available (it should be from middleware)
    if (!ctx.batcher) {
      await ctx.reply('Request batcher not available')
      return
    }

    const chatId = ctx.chat?.id

    if (!chatId) {
      await ctx.reply('❌ Unable to identify chat')
      return
    }

    // Example 1: Send multiple messages using the batcher
    const messagePromises = []

    // Queue multiple messages
    messagePromises.push(
      ctx.batcher.batchRequest('sendMessage', {
        chat_id: chatId,
        text: '📦 Message 1: This is sent via the batcher!'
      })
    )

    messagePromises.push(
      ctx.batcher.batchRequest('sendMessage', {
        chat_id: chatId,
        text: '🚀 Message 2: Multiple messages sent efficiently!'
      })
    )

    messagePromises.push(
      ctx.batcher.batchRequest('sendMessage', {
        chat_id: chatId,
        text: '⚡ Message 3: Great for free tier performance!'
      })
    )

    // Wait for all messages to be sent
    const results = (await Promise.all(messagePromises)) as Array<{ message_id: number }>

    logger.info('Batch messages sent', {
      userId,
      messageCount: results.length,
      queueSize: ctx.batcher.getQueueSize()
    })

    // Send a final message with statistics
    await ctx.reply(
      `✅ Successfully sent ${results.length} batched messages!\n\n` +
        `This technique improves performance by:\n` +
        `• Reducing overhead for multiple API calls\n` +
        `• Batching requests within time windows\n` +
        `• Essential for free tier's 10ms CPU limit`
    )

    // Example 2: Delete messages after a delay (demonstrating cleanup)
    setTimeout(async () => {
      try {
        const deletePromises = results.map(
          result =>
            ctx.batcher?.batchRequest('deleteMessage', {
              chat_id: chatId,
              message_id: result.message_id
            }) ?? Promise.reject(new Error('Batcher not available'))
        )

        await Promise.all(deletePromises)
        logger.info('Batch messages deleted', { userId, count: results.length })
      } catch (error) {
        logger.error('Error deleting batch messages', { error, userId })
      }
    }, 5000) // Delete after 5 seconds
  } catch (error) {
    logger.error('Error in batch example command', { error, userId })
    await ctx.reply('❌ An error occurred while demonstrating batching.')
  }
}
