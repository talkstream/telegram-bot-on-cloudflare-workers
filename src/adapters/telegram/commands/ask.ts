import { getCloudPlatformConnector } from '@/core/cloud/cloud-platform-cache'
import { hasAICapabilities } from '@/core/interfaces/resource-constraints'
import { logger } from '@/lib/logger'
import type { CommandHandler } from '@/types'

export const askCommand: CommandHandler = async ctx => {
  // Check if AI service is available
  if (!ctx.services?.ai) {
    await ctx.reply(ctx.i18n.t('ai.general.not_configured', { namespace: 'telegram' }))
    return
  }

  // Check if AI is enabled based on resource constraints
  const cloudConnector = getCloudPlatformConnector(ctx.env)
  const constraints = cloudConnector.getResourceConstraints()
  if (!hasAICapabilities(constraints)) {
    await ctx.reply(ctx.i18n.t('ai.general.not_available_free_tier', { namespace: 'telegram' }))
    return
  }

  const prompt = ctx.match

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    await ctx.reply(ctx.i18n.t('ai.general.prompt_needed', { namespace: 'telegram' }))
    return
  }

  try {
    // Send typing indicator
    await ctx.replyWithChatAction('typing')

    // Generate response using AI service
    const response = await ctx.services.ai.complete(prompt, {
      trackCost: true
    })

    // Format response with provider info
    const providerInfo = ctx.services.ai.getActiveProvider()
    const formattedResponse =
      response.content +
      '\n\n<i>' +
      ctx.i18n.t('ai.general.powered_by', {
        namespace: 'telegram',
        params: { provider: providerInfo || 'AI' }
      }) +
      '</i>'

    // Send the AI response
    await ctx.reply(formattedResponse, {
      parse_mode: 'HTML'
    })

    logger.info('AI query processed', {
      userId: ctx.from?.id,
      promptLength: prompt.length,
      provider: response.provider,
      usage: response.usage,
      cost: response.cost
    })
  } catch (error) {
    logger.error('Error in ask command', { error, userId: ctx.from?.id })

    await ctx.reply(ctx.i18n.t('ai.general.error', { namespace: 'telegram' }))
  }
}
