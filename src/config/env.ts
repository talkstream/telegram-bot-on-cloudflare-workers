import { z } from 'zod'

import type { CloudflareEnv } from '@/types/env'

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().optional().default('demo'), // Optional for demo mode
  TELEGRAM_WEBHOOK_SECRET: z.string().optional().default('demo'),
  SENTRY_DSN: z.string().optional(),
  SENTRY_DEBUG: z
    .string()
    .transform(val => val === 'true')
    .optional(),
  ENVIRONMENT: z.string().optional().default('development'),
  RELEASE: z.string().optional(),
  CLOUD_PLATFORM: z.string().optional().default('cloudflare'),
  TIER: z.enum(['free', 'paid']).optional().default('free'),
  SESSIONS: z.any().optional(), // Cloudflare KV Namespace binding
  DB: z.any().optional(), // Cloudflare D1 Database binding
  CACHE: z.any().optional(), // Cloudflare KV Namespace binding
  RATE_LIMIT: z.any().optional(), // Cloudflare KV Namespace binding

  // AI Provider configuration
  AI_PROVIDER: z.string().optional().default('google-ai'),
  AI_PROVIDERS_CONFIG: z.string().optional(), // JSON config for providers

  // Provider API Keys (all optional - only needed if provider is used)
  GEMINI_API_KEY: z.string().optional(), // Google Gemini
  OPENAI_API_KEY: z.string().optional(), // OpenAI
  XAI_API_KEY: z.string().optional(), // xAI Grok
  DEEPSEEK_API_KEY: z.string().optional(), // DeepSeek
  CLOUDFLARE_AI_ACCOUNT_ID: z.string().optional(), // Cloudflare AI
  CLOUDFLARE_AI_API_TOKEN: z.string().optional(), // Cloudflare AI

  // Cost tracking
  AI_COST_TRACKING_ENABLED: z
    .string()
    .transform(val => val === 'true')
    .optional(),
  AI_COST_CONFIG_URL: z.string().url().optional(),

  // Owner configuration
  BOT_OWNER_IDS: z.string().optional() // Comma-separated list of owner Telegram IDs

  // Add other environment variables here
})

export type Env = CloudflareEnv

export function validateEnv(env: unknown): Env {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
    throw new Error('Invalid environment variables')
  }
  // Cast to CloudflareEnv type as we've validated the structure
  return env as Env
}
