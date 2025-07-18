import type { CommandHandler } from '@/types';
import { logger } from '@/lib/logger';
import { isFeatureEnabled } from '@/config/tiers';

export const askCommand: CommandHandler = async (ctx) => {
  const tier = ctx.env.TIER || 'free';

  // Check if AI service is available
  if (!ctx.services?.ai) {
    await ctx.reply(ctx.i18n('ai_not_configured'));
    return;
  }

  // Check if AI is enabled for this tier
  if (!isFeatureEnabled('aiEnabled', tier)) {
    await ctx.reply(ctx.i18n('ai_not_available_free_tier'));
    return;
  }

  const prompt = ctx.match;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    await ctx.reply(ctx.i18n('ask_prompt_needed'));
    return;
  }

  try {
    // Send typing indicator
    await ctx.replyWithChatAction('typing');

    // Generate response using AI service
    const response = await ctx.services.ai.complete(prompt, {
      trackCost: true,
    });

    // Format response with provider info
    const providerInfo = ctx.services.ai.getActiveProvider();
    const formattedResponse =
      response.content +
      '\n\n<i>' +
      ctx.i18n('powered_by', { provider: providerInfo || 'AI' }) +
      '</i>';

    // Send the AI response
    await ctx.reply(formattedResponse, {
      parse_mode: 'HTML',
    });

    logger.info('AI query processed', {
      userId: ctx.from?.id,
      promptLength: prompt.length,
      provider: response.provider,
      usage: response.usage,
      cost: response.cost,
      tier,
    });
  } catch (error) {
    logger.error('Error in ask command', { error, userId: ctx.from?.id });

    await ctx.reply(ctx.i18n('ai_error'));
  }
};
