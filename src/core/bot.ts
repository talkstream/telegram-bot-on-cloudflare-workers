import { Bot, InlineKeyboard } from 'grammy';

import type { Env, BotContext } from '@/types';
import { SessionService } from '@/services/session-service';
import { GeminiService } from '@/services/gemini-service';
import { getMessage } from '@/lib/i18n';
import { TelegramStarsService } from '@/domain/services/telegram-stars.service';
import { PaymentRepository } from '@/domain/payments/repository';
import { batcherMiddleware } from '@/lib/telegram-batcher';
import { MultiLayerCache } from '@/lib/multi-layer-cache';

export function createBot(env: Env) {
  const bot = new Bot<BotContext>(env.TELEGRAM_BOT_TOKEN);
  const tier = env.TIER || 'free';
  
  // Create multi-layer cache if cache namespace is available
  const multiLayerCache = env.CACHE ? new MultiLayerCache(env.CACHE, tier) : undefined;
  
  const sessionService = new SessionService(env.SESSIONS, tier, multiLayerCache);
  const geminiService = new GeminiService(env.GEMINI_API_KEY, tier);
  const paymentRepo = new PaymentRepository(env.DB);
  const telegramStarsService = new TelegramStarsService(bot.api.raw, paymentRepo, tier);

  // Middleware to attach services, session, and i18n to the context
  bot.use(async (ctx, next) => {
    ctx.services = {
      session: sessionService,
      gemini: geminiService,
      telegramStars: telegramStarsService,
      paymentRepo: paymentRepo,
    };
    // Determine language from user or default to English
    const lang = ctx.from?.language_code === 'ru' ? 'ru' : 'en';
    ctx.i18n = (key, ...args) => getMessage(lang, key, ...args);

    if (ctx.from?.id) {
      ctx.session = (await sessionService.getSession(ctx.from.id)) || undefined;
    }
    await next();
  });

  // Add request batching middleware for better performance
  bot.use(batcherMiddleware({
    maxBatchSize: env.TIER === 'free' ? 10 : 30,
    batchIntervalMs: env.TIER === 'free' ? 5 : 25,
    timeoutMs: env.TIER === 'free' ? 2000 : 5000,
  }));

  // Example commands and handlers (these would typically be moved to src/adapters/telegram/commands/ and callbacks/)
  bot.command('start', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId) {
      let session = await ctx.services.session.getSession(userId);
      if (!session) {
        session = { userId, step: 'initial', data: {} };
        await ctx.services.session.saveSession(session);
      }
      await ctx.reply(ctx.i18n('welcome_session', session.step));
    } else {
      await ctx.reply(ctx.i18n('welcome'));
    }
  });

  bot.command('askgemini', async (ctx) => {
    const prompt = ctx.match;
    if (!prompt) {
      await ctx.reply(ctx.i18n('gemini_prompt_needed'));
      return;
    }
    if (!ctx.services.gemini) {
      await ctx.reply(ctx.i18n('gemini_not_available'));
      return;
    }
    
    try {
      await ctx.reply(ctx.i18n('gemini_thinking'));
      const response = await ctx.services.gemini.generateText(prompt);
      await ctx.reply(response);
    } catch (_error) {
      await ctx.reply(ctx.i18n('gemini_error'));
    }
  });

  bot.command('menu', async (ctx) => {
    const inlineKeyboard = new InlineKeyboard()
      .text('Option 1', 'option_1')
      .row()
      .text('Option 2', 'option_2');
    await ctx.reply('Choose an option:', { reply_markup: inlineKeyboard });
  });

  bot.callbackQuery('option_1', async (ctx) => {
    await ctx.answerCallbackQuery('You chose Option 1!');
    await ctx.editMessageText('You selected: Option 1');
  });

  bot.callbackQuery('option_2', async (ctx) => {
    await ctx.answerCallbackQuery('You chose Option 2!');
    await ctx.editMessageText('You selected: Option 2');
  });

  bot.command('buy_message', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Could not identify user.');
      return;
    }
    try {
      // For demonstration, let's assume a fixed target_masked_id and amount
      const targetMaskedId = 'TEST_USER_123';
      const starsAmount = 100;
      const invoiceLink = await ctx.services.telegramStars.createDirectMessageInvoice(
        userId,
        userId, // Using userId as playerId for simplicity in wireframe
        targetMaskedId,
        starsAmount,
      );
      await ctx.reply(`Please pay for your message: ${invoiceLink}`);
    } catch (error) {
      await ctx.reply('Failed to create invoice. Please try again later.');
      console.error('Error creating invoice:', error);
    }
  });

  bot.on('message', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId) {
      const session = await ctx.services.session.getSession(userId);
      if (session) {
        session.data.lastMessage = ctx.message?.text;
        await ctx.services.session.saveSession(session);
        await ctx.reply(ctx.i18n('got_message_session'));
      } else {
        await ctx.reply(ctx.i18n('no_session'));
      }
    } else {
      await ctx.reply(ctx.i18n('got_message'));
    }
  });

  return bot;
}
