/**
 * Lightweight Adapter for Free Tier
 *
 * This adapter provides a minimal bot configuration optimized for
 * Cloudflare Workers' free tier with its 10ms CPU time limit.
 */

import { Bot } from 'grammy';

import type { BotContext, Env } from '@/types';
import { getTierConfig } from '@/config/tiers';
import { logger } from '@/lib/logger';

interface LightweightOptions {
  tier: 'free' | 'paid';
  env: Env;
}

export class LightweightAdapter {
  private tier: 'free' | 'paid';
  private config: ReturnType<typeof getTierConfig>;
  private bot: Bot<BotContext>;

  constructor(options: LightweightOptions) {
    this.tier = options.tier;
    this.config = getTierConfig(this.tier);
    this.bot = new Bot<BotContext>(options.env.TELEGRAM_BOT_TOKEN);
  }

  /**
   * Initialize the bot with tier-appropriate middleware and features
   */
  async initialize(env: Env): Promise<Bot<BotContext>> {
    const startTime = Date.now();

    // Essential middleware only for free tier
    if (this.tier === 'free') {
      await this.initializeLightweightMode(env);
    } else {
      await this.initializeFullMode(env);
    }

    const initTime = Date.now() - startTime;
    logger.info(`Bot initialized in ${initTime}ms for ${this.tier} tier`);

    return this.bot;
  }

  /**
   * Lightweight mode for free tier - minimal features
   */
  private async initializeLightweightMode(env: Env): Promise<void> {
    // 1. Basic context setup (no heavy services)
    this.bot.use(async (ctx, next) => {
      ctx.env = env;

      // Minimal i18n - just English
      ctx.i18n = (key: string) => key;

      await next();
    });

    // 2. Simple rate limiting using in-memory counter
    const requestCounts = new Map<string, number>();
    this.bot.use(async (ctx, next) => {
      const userId = ctx.from?.id?.toString();
      if (!userId) {
        await next();
        return;
      }

      const count = requestCounts.get(userId) || 0;
      if (count > 10) {
        await ctx.reply('⏱️ Too many requests. Please wait.');
        return;
      }

      requestCounts.set(userId, count + 1);
      setTimeout(() => requestCounts.delete(userId), 60000); // Reset after 1 minute

      await next();
    });

    // 3. Basic commands only
    this.bot.command('start', async (ctx) => {
      await ctx.reply('👋 Hello! This bot is running in lightweight mode.');
    });

    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        '📋 Available commands:\n' +
          '/start - Start the bot\n' +
          '/help - Show this help\n' +
          '/status - Check bot status',
      );
    });

    this.bot.command('status', async (ctx) => {
      await ctx.reply('✅ Bot is running in free tier mode (lightweight)');
    });

    // 4. Catch-all for unsupported features
    this.bot.on('message', async (ctx) => {
      await ctx.reply('⚡ This feature is not available in free tier mode.');
    });
  }

  /**
   * Full mode for paid tier - all features enabled
   */
  private async initializeFullMode(env: Env): Promise<void> {
    // Lazy load heavy dependencies
    const [{ SessionService }, { GeminiService }, { getMessage }, { batcherMiddleware }] =
      await Promise.all([
        import('@/services/session-service'),
        import('@/services/gemini-service'),
        import('@/lib/i18n'),
        import('@/lib/telegram-batcher'),
      ]);

    // Initialize services
    const sessionService = new SessionService(env.SESSIONS);
    const geminiService = this.config.features.aiEnabled
      ? new GeminiService(env.GEMINI_API_KEY, 'paid')
      : null;

    // Full context setup
    this.bot.use(async (ctx, next) => {
      ctx.env = env;
      ctx.services = {
        session: sessionService,
        gemini: geminiService,
        // Add other services as needed
      } as BotContext['services'];

      // Full i18n support
      const lang = ctx.from?.language_code === 'ru' ? 'ru' : 'en';
      ctx.i18n = (key, ...args) => getMessage(lang, key, ...args);

      // Load user session
      if (ctx.from?.id && this.config.features.sessionPersistence) {
        ctx.session = (await sessionService.getSession(ctx.from.id)) || undefined;
      }

      await next();
    });

    // Add request batching for better performance
    if (this.config.features.requestBatching) {
      this.bot.use(
        batcherMiddleware({
          maxBatchSize: this.config.performance.maxBatchSize,
          batchIntervalMs: this.config.performance.batchIntervalMs,
          timeoutMs: this.config.performance.requestTimeoutMs,
        }),
      );
    }

    // Load command handlers dynamically
    await this.loadCommandHandlers();
  }

  /**
   * Dynamically load command handlers
   */
  private async loadCommandHandlers(): Promise<void> {
    try {
      // Lazy load commands
      const commandModules = await Promise.all([
        import('@/adapters/telegram/commands/start'),
        import('@/adapters/telegram/commands/help'),
        import('@/adapters/telegram/commands/settings'),
      ]);

      // Register commands
      this.bot.command('start', commandModules[0].startCommand);
      this.bot.command('help', commandModules[1].helpCommand);
      this.bot.command('settings', commandModules[2].settingsCommand);

      // Conditionally load AI commands
      if (this.config.features.aiEnabled) {
        const { askCommand } = await import('@/adapters/telegram/commands/ask');
        this.bot.command('ask', askCommand);
      }

      // Load callback handlers
      const callbackModules = await Promise.all([
        import('@/adapters/telegram/callbacks/menu'),
        import('@/adapters/telegram/callbacks/settings'),
      ]);

      // Register callbacks
      this.bot.callbackQuery('menu:', callbackModules[0].mainMenuCallback);
      this.bot.callbackQuery('settings:', callbackModules[1].languageSettingCallback);
    } catch (error) {
      logger.error('Error loading command handlers', { error });
    }
  }

  /**
   * Get feature availability for current tier
   */
  isFeatureAvailable(feature: keyof ReturnType<typeof getTierConfig>['features']): boolean {
    return this.config.features[feature];
  }

  /**
   * Get performance configuration
   */
  getPerformanceConfig() {
    return this.config.performance;
  }
}

/**
 * Factory function to create appropriate bot based on tier
 */
export async function createTierAwareBot(env: Env): Promise<Bot<BotContext>> {
  const tier = env.TIER || 'free';
  const adapter = new LightweightAdapter({ tier, env });

  return adapter.initialize(env);
}
