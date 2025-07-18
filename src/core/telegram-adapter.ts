import { Bot } from 'grammy';
import type { Update } from 'grammy/types';

import type { Env } from '../config/env';
import { logger } from '../lib/logger';
import {
  handlePreCheckoutQuery,
  handleSuccessfulPayment,
} from '../adapters/telegram/handlers/paymentHandler';
import { setupCommands } from '../adapters/telegram/commands';
import { setupCallbacks } from '../adapters/telegram/callbacks';
import { setUserContext, clearUserContext } from '../config/sentry'; // Re-using Sentry helpers
import { getTierConfig } from '../config/tiers';

import { createBot } from './bot';

import type { BotContext } from '@/types';

export class TelegramAdapter {
  private bot: Bot<BotContext>;
  private env: Env;
  private initialized = false;
  private processedUpdates = new Map<number, number>(); // update_id -> timestamp
  private tier: 'free' | 'paid';

  constructor(env: Env) {
    this.env = env;
    this.tier = env.TIER || 'free';
    
    // For now, use standard bot creation
    // Will initialize tier-aware bot on first update
    this.bot = createBot(env);
    
    const config = getTierConfig(this.tier);
    if (this.tier === 'paid' || !config.optimization.lazyLoadDependencies) {
      this.setupHandlers();
    }
  }

  private setupHandlers(): void {
    // Setup command handlers
    setupCommands(this.bot);

    // Setup callback query handlers
    setupCallbacks(this.bot);

    // Register payment handlers
    this.bot.on('pre_checkout_query', (ctx) => handlePreCheckoutQuery(ctx, this.env));
    this.bot.on('message:successful_payment', (ctx) => handleSuccessfulPayment(ctx, this.env));

    // Error handling
    this.bot.catch((err) => {
      logger.error('Bot error', err.error, {
        ctx: err.ctx,
        error: err.error,
      });

      // Set user context for Sentry
      if (err.ctx?.from?.id) {
        setUserContext(err.ctx.from.id, {
          username: err.ctx.from.username,
          first_name: err.ctx.from.first_name,
        });
      }

      // Sentry should catch this via wrapSentry in index.ts
      // Clear user context after error handling
      clearUserContext();
    });
  }

  async handleUpdate(update: Update): Promise<void> {
    const now = Date.now();

    // Duplicate update handling (5-minute window)
    if (update.update_id && this.processedUpdates.has(update.update_id)) {
      const processedTime = this.processedUpdates.get(update.update_id);
      if (processedTime && now - processedTime < 5 * 60 * 1000) {
        logger.warn('Duplicate update received', {
          update_id: update.update_id,
        });
        return;
      }
    }

    // Store processed update_id
    if (update.update_id) {
      this.processedUpdates.set(update.update_id, now);
      // Clean up old update_ids
      if (this.processedUpdates.size > 100) {
        const fiveMinutesAgo = now - 5 * 60 * 1000;
        for (const [id, time] of this.processedUpdates) {
          if (time < fiveMinutesAgo) {
            this.processedUpdates.delete(id);
          }
        }
      }
    }

    // Initialize bot on first update
    if (!this.initialized) {
      try {
        await this.bot.init();
        this.initialized = true;
        logger.info('Bot initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize bot', error);
        // Error will be caught by Sentry via wrapSentry
        throw error;
      }
    }

    // Set user context for Sentry before handling update
    const userId = update.message?.from?.id || update.callback_query?.from?.id;
    if (userId) {
      const from = update.message?.from || update.callback_query?.from;
      setUserContext(userId, {
        username: from?.username,
        first_name: from?.first_name,
        is_bot: from?.is_bot,
      });
    }

    try {
      await this.bot.handleUpdate(update);
    } finally {
      // Clear user context after handling update
      clearUserContext();
    }
  }
}
