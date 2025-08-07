/**
 * Telegram Bot Connection Pool
 *
 * Manages Grammy bot instances for optimal performance
 */

import { Bot } from 'grammy'

import type { ConnectionFactory } from './connection-pool'
import { ConnectionPool } from './connection-pool'

import { logger } from '@/lib/logger'
import type { BotContext } from '@/types/telegram'

export interface TelegramPoolConfig {
  /**
   * Bot token
   */
  token: string

  /**
   * Maximum number of bot instances
   */
  maxBots?: number

  /**
   * Minimum number of bot instances
   */
  minBots?: number

  /**
   * Webhook URL if using webhooks
   */
  webhookUrl?: string

  /**
   * Enable connection warming
   */
  warmOnStartup?: boolean
}

class TelegramBotFactory implements ConnectionFactory<Bot<BotContext>> {
  constructor(private config: TelegramPoolConfig) {}

  async create(): Promise<Bot<BotContext>> {
    const bot = new Bot<BotContext>(this.config.token)

    // Set up webhook if configured
    if (this.config.webhookUrl) {
      try {
        await bot.api.setWebhook(this.config.webhookUrl)
      } catch (error) {
        logger.warn('Failed to set webhook, bot may already be configured', { error })
      }
    }

    logger.debug('Created new Telegram bot instance')
    return bot
  }

  async validate(bot: Bot<BotContext>): Promise<boolean> {
    try {
      // Simple validation - check if bot can get updates
      await bot.api.getMe()
      return true
    } catch (error) {
      logger.error('Bot validation failed', { error })
      return false
    }
  }

  async destroy(bot: Bot<BotContext>): Promise<void> {
    try {
      // Stop the bot if it's running
      await bot.stop()
      logger.debug('Destroyed Telegram bot instance')
    } catch (error) {
      logger.warn('Error destroying bot instance', { error })
    }
  }
}

export class TelegramConnectionPool {
  private pool: ConnectionPool<Bot<BotContext>>
  private static instance: TelegramConnectionPool | null = null

  constructor(config: TelegramPoolConfig) {
    const factory = new TelegramBotFactory(config)

    this.pool = new ConnectionPool(factory, {
      maxSize: config.maxBots ?? 5,
      minSize: config.minBots ?? 1,
      acquireTimeout: 5000,
      idleTimeout: 300000, // 5 minutes
      validationInterval: 60000, // 1 minute
      warmOnStartup: config.warmOnStartup ?? true
    })
  }

  /**
   * Get or create singleton instance
   */
  static getInstance(config?: TelegramPoolConfig): TelegramConnectionPool {
    if (!TelegramConnectionPool.instance) {
      if (!config) {
        throw new Error('TelegramConnectionPool requires config on first initialization')
      }
      TelegramConnectionPool.instance = new TelegramConnectionPool(config)
    }
    return TelegramConnectionPool.instance
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static async reset(): Promise<void> {
    if (TelegramConnectionPool.instance) {
      await TelegramConnectionPool.instance.shutdown()
      TelegramConnectionPool.instance = null
    }
  }

  /**
   * Acquire a bot instance from the pool
   */
  async acquire(): Promise<Bot<BotContext>> {
    return this.pool.acquire()
  }

  /**
   * Release a bot instance back to the pool
   */
  release(bot: Bot<BotContext>): void {
    this.pool.release(bot)
  }

  /**
   * Execute a function with a pooled bot
   */
  async withBot<T>(fn: (bot: Bot<BotContext>) => Promise<T>): Promise<T> {
    const bot = await this.acquire()
    try {
      return await fn(bot)
    } finally {
      this.release(bot)
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return this.pool.getStats()
  }

  /**
   * Shutdown the pool
   */
  async shutdown(): Promise<void> {
    await this.pool.shutdown()
  }
}
