/**
 * Telegram Webhook Handler
 *
 * Processes incoming Telegram webhook requests
 */

import type { Env } from '../../config/env'
import type { EventBus } from '../../core/events/event-bus'
import type { ICloudPlatformConnector } from '../../core/interfaces/cloud-platform'
import { getBotToken } from '../../lib/env-guards'

import { createBot } from './lightweight-adapter'

interface WebhookContext {
  env: Env
  eventBus: EventBus
  platform: ICloudPlatformConnector
  isDemoMode: boolean
}

/**
 * Handle incoming Telegram webhook
 */
export async function handleTelegramWebhook(
  body: unknown,
  context: WebhookContext
): Promise<{ ok: boolean }> {
  try {
    const { env, eventBus, platform, isDemoMode } = context

    if (isDemoMode) {
      // Mock response for demo mode - silently process
      return { ok: true }
    }

    const token = getBotToken(env)
    if (!token) {
      throw new Error('Bot token not configured')
    }

    // Create bot instance
    const bot = await createBot({
      token,
      eventBus,
      platform,
      env
    })

    // Process update
    if (bot && typeof bot.handleUpdate === 'function') {
      await bot.handleUpdate(body)
    }

    return { ok: true }
  } catch (error) {
    console.error('[Telegram] Webhook processing error:', error)
    throw error
  }
}
