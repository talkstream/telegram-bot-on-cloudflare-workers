import type { CommandHandler } from '@/types';
import { logger } from '@/lib/logger';
import { isFeatureEnabled } from '@/config/tiers';

export const askCommand: CommandHandler = async (ctx) => {
  const tier = ctx.env.TIER || 'free';
  
  // Check if AI is enabled for this tier
  if (!isFeatureEnabled('aiEnabled', tier)) {
    await ctx.reply(
      '🚫 AI features are not available in the free tier.\n\n' +
      'Upgrade to the paid tier to access:\n' +
      '• AI-powered responses\n' +
      '• Advanced text generation\n' +
      '• Smart assistance'
    );
    return;
  }

  const prompt = ctx.match;
  
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    await ctx.reply(
      '💭 Please provide a question or prompt after the command.\n\n' +
      'Example: /ask What is the weather like today?'
    );
    return;
  }

  try {
    // Check if Gemini service is available
    if (!ctx.services?.gemini) {
      await ctx.reply('❌ AI service is not configured properly.');
      logger.error('Gemini service not available in context');
      return;
    }

    // Send typing indicator
    await ctx.replyWithChatAction('typing');

    // Generate response
    const response = await ctx.services.gemini.generateText(prompt);

    // Send the AI response
    await ctx.reply(response, {
      parse_mode: 'HTML',
    });

    logger.info('AI query processed', {
      userId: ctx.from?.id,
      promptLength: prompt.length,
      tier,
    });
  } catch (error) {
    logger.error('Error in ask command', { error, userId: ctx.from?.id });
    
    await ctx.reply(
      '❌ Sorry, I encountered an error while processing your request.\n' +
      'Please try again later.'
    );
  }
};