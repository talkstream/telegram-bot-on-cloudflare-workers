import { Bot, InlineKeyboard } from 'grammy'

import { I18nFactory } from '@/connectors/i18n/i18n-factory'
import { MonitoringFactory } from '@/connectors/monitoring/monitoring-factory'
import { getCloudPlatformConnector } from '@/core/cloud/cloud-platform-cache'
import { EventBus } from '@/core/events/event-bus'
import { PaymentRepository } from '@/domain/payments/repository'
import { TelegramStarsService } from '@/domain/services/telegram-stars.service'
import { loadProvidersFromEnv } from '@/lib/ai/config/provider-loader'
import { MultiLayerCache } from '@/lib/multi-layer-cache'
import { batcherMiddleware } from '@/lib/telegram-batcher'
import { AIService } from '@/services/ai-service'
import { SessionService } from '@/services/session-service'
import type { BotContext, Env } from '@/types'
// Register all cloud connectors
import '@/connectors/cloud'

export async function createBot(env: Env) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is required')
  }
  const bot = new Bot<BotContext>(env.TELEGRAM_BOT_TOKEN)

  // Create event bus for system-wide events
  const eventBus = new EventBus({
    async: true,
    debug: env.ENVIRONMENT === 'development'
  })

  // Create cloud platform connector using cache (singleton pattern)
  const cloudConnector = getCloudPlatformConnector(env)
  const constraints = cloudConnector.getResourceConstraints()

  // Map constraints back to tier for components that still need it
  // TODO: Remove this once all components use ResourceConstraints
  const tier = constraints.maxExecutionTimeMs >= 5000 ? 'paid' : 'free'

  // Create monitoring connector
  const monitoring = await MonitoringFactory.createFromEnv(
    env as unknown as Record<string, string | undefined>
  )

  // Create i18n connector
  const i18nConnector = await I18nFactory.createFromEnv(env, eventBus)

  // Create multi-layer cache if cache namespace is available
  const multiLayerCache = env.CACHE ? new MultiLayerCache(env.CACHE, tier) : undefined

  const sessionService = new SessionService(
    cloudConnector.getKeyValueStore('SESSIONS'),
    constraints,
    multiLayerCache
  )

  // Load AI providers and create AI service
  const { providers, defaultProvider, fallbackProviders, costCalculator } =
    await loadProvidersFromEnv(env, tier)
  const aiService = new AIService(
    {
      ...(defaultProvider && { defaultProvider }),
      fallbackProviders,
      ...(costCalculator && {
        costTracking: {
          enabled: true,
          calculator: costCalculator
        }
      })
    },
    constraints
  )

  // Register all providers
  for (const provider of providers) {
    aiService.registerProvider(provider)
  }

  const paymentRepo = new PaymentRepository(cloudConnector.getDatabaseStore('DB'))
  const telegramStarsService = new TelegramStarsService(bot.api.raw, paymentRepo, tier)

  // Middleware to attach services, session, and i18n to the context
  bot.use(async (ctx, next) => {
    ctx.cloudConnector = cloudConnector
    ctx.monitoring = monitoring
    ctx.services = {
      session: sessionService,
      ai: providers.length > 0 ? aiService : null,
      telegramStars: telegramStarsService,
      paymentRepo: paymentRepo
    }
    // Determine language from user or default to English
    const lang = ctx.from?.language_code === 'ru' ? 'ru' : 'en'

    // Set language in i18n connector
    await i18nConnector.setLanguage(lang)

    // Provide i18n connector to context
    ctx.i18n = i18nConnector

    if (ctx.from?.id) {
      ctx.session = (await sessionService.getSession(ctx.from.id)) || undefined

      // Set user context for monitoring
      monitoring?.setUserContext(String(ctx.from.id), {
        username: ctx.from.username,
        languageCode: ctx.from.language_code
      })
    }

    try {
      await next()
    } catch (error) {
      // Capture error in monitoring
      if (error instanceof Error && monitoring) {
        monitoring.captureException(error, {
          user: ctx.from,
          chat: ctx.chat,
          update: ctx.update
        })
      }
      throw error
    }
  })

  // Add request batching middleware for better performance
  bot.use(
    batcherMiddleware({
      maxBatchSize: constraints.optimization.maxBatchSize,
      batchIntervalMs: constraints.optimization.batchIntervalMs,
      timeoutMs: tier === 'free' ? 2000 : 5000
    })
  )

  // Example commands and handlers (these would typically be moved to src/adapters/telegram/commands/ and callbacks/)
  bot.command('start', async ctx => {
    const userId = ctx.from?.id
    if (userId) {
      let session = await ctx.services.session.getSession(userId)
      if (!session) {
        session = { userId, step: 'initial', data: {} }
        await ctx.services.session.saveSession(session)
      }
      await ctx.reply(
        ctx.i18n.t('welcome_session', {
          namespace: 'telegram',
          params: { step: session.step }
        })
      )
    } else {
      await ctx.reply(ctx.i18n.t('welcome', { namespace: 'telegram' }))
    }
  })

  bot.command('askgemini', async ctx => {
    const prompt = ctx.match
    if (!prompt) {
      await ctx.reply(ctx.i18n.t('ai.gemini.prompt_needed', { namespace: 'telegram' }))
      return
    }
    if (!ctx.services.ai) {
      await ctx.reply(ctx.i18n.t('ai.gemini.not_available', { namespace: 'telegram' }))
      return
    }

    try {
      await ctx.reply(ctx.i18n.t('ai.gemini.thinking', { namespace: 'telegram' }))
      const response = await ctx.services.ai.generateText(prompt)
      await ctx.reply(response)
    } catch (_error) {
      await ctx.reply(ctx.i18n.t('ai.gemini.error', { namespace: 'telegram' }))
    }
  })

  bot.command('menu', async ctx => {
    const inlineKeyboard = new InlineKeyboard()
      .text('Option 1', 'option_1')
      .row()
      .text('Option 2', 'option_2')
    await ctx.reply('Choose an option:', { reply_markup: inlineKeyboard })
  })

  bot.callbackQuery('option_1', async ctx => {
    await ctx.answerCallbackQuery('You chose Option 1!')
    await ctx.editMessageText('You selected: Option 1')
  })

  bot.callbackQuery('option_2', async ctx => {
    await ctx.answerCallbackQuery('You chose Option 2!')
    await ctx.editMessageText('You selected: Option 2')
  })

  bot.command('buy_message', async ctx => {
    const userId = ctx.from?.id
    if (!userId) {
      await ctx.reply('Could not identify user.')
      return
    }
    try {
      // For demonstration, let's assume a fixed target_masked_id and amount
      const targetMaskedId = 'TEST_USER_123'
      const starsAmount = 100
      const invoiceLink = await ctx.services.telegramStars.createDirectMessageInvoice(
        userId,
        userId, // Using userId as playerId for simplicity in wireframe
        targetMaskedId,
        starsAmount
      )
      await ctx.reply(`Please pay for your message: ${invoiceLink}`)
    } catch (error) {
      await ctx.reply('Failed to create invoice. Please try again later.')
      console.error('Error creating invoice:', error)
    }
  })

  bot.on('message', async ctx => {
    const userId = ctx.from?.id
    if (userId) {
      const session = await ctx.services.session.getSession(userId)
      if (session) {
        session.data.lastMessage = ctx.message?.text
        await ctx.services.session.saveSession(session)
        await ctx.reply(ctx.i18n.t('messages.got_message_session', { namespace: 'telegram' }))
      } else {
        await ctx.reply(ctx.i18n.t('messages.no_session', { namespace: 'telegram' }))
      }
    } else {
      await ctx.reply(ctx.i18n.t('messages.got_message', { namespace: 'telegram' }))
    }
  })

  return bot
}
