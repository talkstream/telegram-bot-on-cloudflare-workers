/**
 * Lightweight Adapter for Free Tier
 *
 * This adapter provides a minimal bot configuration optimized for
 * Cloudflare Workers' free tier with its 10ms CPU time limit.
 */

import { Bot } from 'grammy'

import { getTierConfig } from '@/config/cloudflare-tiers'
import { getCloudPlatformConnector } from '@/core/cloud/cloud-platform-cache'
import { EventBus } from '@/core/events/event-bus'
import type { I18nConnector } from '@/core/interfaces/i18n'
import { UniversalRoleService } from '@/core/services/role-service'
import type { PaymentRepository } from '@/domain/payments/repository'
import type { TelegramStarsService } from '@/domain/services/telegram-stars.service'
import { getBotToken, hasDatabase } from '@/lib/env-guards'
import { logger } from '@/lib/logger'
import type { SessionService as ISessionService } from '@/services/session-service'
import type { BotContext, Env } from '@/types'

interface LightweightOptions {
  tier: 'free' | 'paid'
  env: Env
}

export class LightweightAdapter {
  private tier: 'free' | 'paid'
  private config: ReturnType<typeof getTierConfig>
  private bot: Bot<BotContext>

  constructor(options: LightweightOptions) {
    this.tier = options.tier
    this.config = getTierConfig(this.tier)
    this.bot = new Bot<BotContext>(getBotToken(options.env))
  }

  /**
   * Initialize the bot with tier-appropriate middleware and features
   */
  async initialize(env: Env): Promise<Bot<BotContext>> {
    const startTime = Date.now()

    // Essential middleware only for free tier
    if (this.tier === 'free') {
      await this.initializeLightweightMode(env)
    } else {
      await this.initializeFullMode(env)
    }

    const initTime = Date.now() - startTime
    logger.info(`Bot initialized in ${initTime}ms for ${this.tier} tier`)

    return this.bot
  }

  /**
   * Lightweight mode for free tier - minimal features
   */
  private async initializeLightweightMode(env: Env): Promise<void> {
    // 1. Basic context setup (no heavy services)
    this.bot.use(async (ctx, next) => {
      ctx.env = env

      // Minimal i18n - returns key as is for free tier
      // We'll create a proper minimal implementation later
      ctx.i18n = new Proxy({} as I18nConnector, {
        get: (_target, prop) => {
          if (prop === 't') {
            return (key: string) => key
          }
          if (prop === 'setLanguage') {
            return async () => {}
          }
          if (prop === 'getLanguage') {
            return () => 'en'
          }
          // Return reasonable defaults for other methods
          return () => {}
        }
      })

      // Add minimal role service if database available
      if (hasDatabase(env)) {
        const eventBus = new EventBus()
        ctx.roleService = new UniversalRoleService(
          env.DB,
          env.BOT_OWNER_IDS?.split(',').map(id => id.trim()) || [],
          eventBus
        )
      }

      await next()
    })

    // 2. Simple rate limiting using in-memory counter
    const requestCounts = new Map<string, number>()
    this.bot.use(async (ctx, next) => {
      const userId = ctx.from?.id?.toString()
      if (!userId) {
        await next()
        return
      }

      const count = requestCounts.get(userId) || 0
      if (count > 10) {
        await ctx.reply('⏱️ Too many requests. Please wait.')
        return
      }

      requestCounts.set(userId, count + 1)
      setTimeout(() => requestCounts.delete(userId), 60000) // Reset after 1 minute

      await next()
    })

    // 3. Basic commands only
    this.bot.command('start', async ctx => {
      await ctx.reply('👋 Hello! This bot is running in lightweight mode.')
    })

    this.bot.command('help', async ctx => {
      await ctx.reply(
        '📋 Available commands:\n' +
          '/start - Start the bot\n' +
          '/help - Show this help\n' +
          '/status - Check bot status'
      )
    })

    this.bot.command('status', async ctx => {
      await ctx.reply('✅ Bot is running in free tier mode (lightweight)')
    })

    // 4. Catch-all for unsupported features
    this.bot.on('message', async ctx => {
      await ctx.reply('⚡ This feature is not available in free tier mode.')
    })
  }

  /**
   * Full mode for paid tier - all features enabled
   */
  private async initializeFullMode(env: Env): Promise<void> {
    // Lazy load heavy dependencies
    const [
      { SessionService },
      { batcherMiddleware },
      { I18nFactory },
      { EventBus: EventBusImport }
    ] = await Promise.all([
      import('@/services/session-service'),
      import('@/lib/telegram-batcher'),
      import('@/connectors/i18n/i18n-factory'),
      import('@/core/events/event-bus')
    ])

    // Initialize services
    const sessionService = env.SESSIONS ? new SessionService(env.SESSIONS) : null

    // Create event bus and i18n connector
    const eventBus = new EventBusImport()
    const i18nConnector = await I18nFactory.createFromEnv(env, eventBus)

    // Load AI service if enabled
    let aiService = null
    if (this.config.features.aiEnabled) {
      const { AIService } = await import('@/services/ai-service')
      const { loadProvidersFromEnv } = await import('@/lib/ai/config/provider-loader')
      const { providers, defaultProvider, fallbackProviders, costCalculator } =
        await loadProvidersFromEnv(env, 'paid')
      if (providers.length > 0) {
        aiService = new AIService({
          ...(defaultProvider && { defaultProvider }),
          fallbackProviders,
          ...(costCalculator && {
            costTracking: {
              enabled: true,
              calculator: costCalculator
            }
          })
        })

        // Register all providers
        for (const provider of providers) {
          aiService.registerProvider(provider)
        }
      }
    }

    // Initialize role service for full mode
    let roleService: UniversalRoleService | undefined
    if (hasDatabase(env)) {
      const eventBus = new EventBus()
      roleService = new UniversalRoleService(
        env.DB,
        env.BOT_OWNER_IDS?.split(',').map(id => id.trim()) || [],
        eventBus
      )
    }

    // Full context setup
    this.bot.use(async (ctx, next) => {
      ctx.env = env
      ctx.services = {
        session:
          sessionService ||
          ({
            getSession: async () => ({}),
            setSession: async () => {},
            deleteSession: async () => {}
          } as unknown as ISessionService),
        ai: aiService,
        telegramStars: {} as TelegramStarsService, // Placeholder for lightweight mode
        paymentRepo: {} as PaymentRepository // Placeholder for lightweight mode
      }

      // Add role service to context
      if (roleService) {
        ctx.roleService = roleService
      } else {
        throw new Error('RoleService is required but not initialized')
      }

      // Full i18n support
      const lang = ctx.from?.language_code === 'ru' ? 'ru' : 'en'
      await i18nConnector.setLanguage(lang)
      ctx.i18n = i18nConnector

      // Load user session
      if (ctx.from?.id && this.config.features.sessionPersistence && sessionService) {
        ctx.session = (await sessionService.getSession(ctx.from.id)) || undefined
      }

      await next()
    })

    // Add request batching for better performance
    if (this.config.features.requestBatching) {
      this.bot.use(
        batcherMiddleware({
          maxBatchSize: this.config.performance.maxBatchSize,
          batchIntervalMs: this.config.performance.batchIntervalMs,
          timeoutMs: this.config.performance.requestTimeoutMs
        })
      )
    }

    // Load command handlers dynamically
    await this.loadCommandHandlers(roleService)
  }

  /**
   * Dynamically load command handlers
   */
  private async loadCommandHandlers(roleService?: UniversalRoleService): Promise<void> {
    try {
      // Import setupCommands function
      const { setupCommands } = await import('@/adapters/telegram/commands')

      // Setup all commands with role service
      setupCommands(this.bot, roleService)

      // Load callback handlers
      const { setupCallbacks } = await import('@/adapters/telegram/callbacks')

      // Setup all callbacks
      setupCallbacks(this.bot)
    } catch (error) {
      logger.error('Error loading command handlers', { error })
    }
  }

  /**
   * Get feature availability for current tier
   */
  isFeatureAvailable(feature: keyof ReturnType<typeof getTierConfig>['features']): boolean {
    return this.config.features[feature]
  }

  /**
   * Get performance configuration
   */
  getPerformanceConfig() {
    return this.config.performance
  }
}

/**
 * Factory function to create appropriate bot based on tier
 */
export async function createTierAwareBot(env: Env): Promise<Bot<BotContext>> {
  // Get tier from resource constraints
  const cloudConnector = getCloudPlatformConnector(env)
  const constraints = cloudConnector.getResourceConstraints()
  const tier = constraints.maxExecutionTimeMs >= 5000 ? 'paid' : 'free'

  const adapter = new LightweightAdapter({ tier, env })

  return adapter.initialize(env)
}
