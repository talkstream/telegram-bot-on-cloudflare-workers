/**
 * Type guards and assertions for environment variables
 *
 * These utilities ensure type safety when working with optional environment variables
 * in TypeScript strict mode, avoiding unsafe non-null assertions.
 */

import type { Env } from '@/types'

/**
 * Type guard to check if the app is running in production mode
 */
export function isProductionMode(env: Env): boolean {
  return !!env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_TOKEN !== 'demo'
}

/**
 * Type guard to check if the app is running in demo mode
 */
export function isDemoMode(env: Env): boolean {
  return !env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN === 'demo'
}

/**
 * Assert that required production environment variables are present
 * This narrows the type to ensure TypeScript knows these fields are defined
 */
export function assertProductionEnv(env: Env): asserts env is Env & {
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_WEBHOOK_SECRET: string
} {
  if (!env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN === 'demo') {
    throw new Error('TELEGRAM_BOT_TOKEN is required for production mode')
  }
  if (!env.TELEGRAM_WEBHOOK_SECRET || env.TELEGRAM_WEBHOOK_SECRET === 'demo') {
    throw new Error('TELEGRAM_WEBHOOK_SECRET is required for production mode')
  }
}

/**
 * Type guard to check if KV storage is available
 */
export function hasKVStorage(env: Env): env is Env & {
  SESSIONS: NonNullable<Env['SESSIONS']>
  CACHE: NonNullable<Env['CACHE']>
  RATE_LIMIT: NonNullable<Env['RATE_LIMIT']>
} {
  return !!env.SESSIONS && !!env.CACHE && !!env.RATE_LIMIT
}

/**
 * Type guard to check if database is available
 */
export function hasDatabase(env: Env): env is Env & {
  DB: NonNullable<Env['DB']>
} {
  return !!env.DB
}

/**
 * Type guard to check if AI provider is configured
 */
export function hasAIProvider(env: Env): boolean {
  return !!env.AI_PROVIDER && env.AI_PROVIDER !== 'mock'
}

/**
 * Type guard to check if monitoring is configured
 */
export function hasMonitoring(env: Env): env is Env & {
  SENTRY_DSN: string
} {
  return !!env.SENTRY_DSN
}

/**
 * Get environment tier with proper type narrowing
 */
export function getEnvTier(env: Env): 'free' | 'paid' {
  return env.TIER || 'free'
}

/**
 * Assert that a specific KV namespace is available
 */
export function assertKVNamespace<K extends keyof Env>(
  env: Env,
  namespace: K
): asserts env is Env & Record<K, NonNullable<Env[K]>> {
  if (!env[namespace]) {
    throw new Error(`KV namespace ${String(namespace)} is not configured`)
  }
}

/**
 * Get bot token or throw if not in demo mode
 */
export function getBotToken(env: Env): string {
  if (isDemoMode(env)) {
    return 'demo'
  }
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is required')
  }
  return env.TELEGRAM_BOT_TOKEN
}

/**
 * Get webhook secret or throw if not in demo mode
 */
export function getWebhookSecret(env: Env): string {
  if (isDemoMode(env)) {
    return 'demo'
  }
  if (!env.TELEGRAM_WEBHOOK_SECRET) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET is required')
  }
  return env.TELEGRAM_WEBHOOK_SECRET
}

/**
 * Safely get AI provider API key
 */
export function getAIProviderKey(env: Env, provider: string): string | undefined {
  switch (provider) {
    case 'google-ai':
    case 'gemini':
      return env.GEMINI_API_KEY
    case 'openai':
      return env.OPENAI_API_KEY
    case 'xai':
      return env.XAI_API_KEY
    case 'deepseek':
      return env.DEEPSEEK_API_KEY
    case 'cloudflare-ai':
      return env.CLOUDFLARE_AI_API_TOKEN
    default:
      return undefined
  }
}
