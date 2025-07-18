import { z } from 'zod';

import type { CloudflareEnv } from '@/types/env';

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  ENVIRONMENT: z.string().optional(),
  TIER: z.enum(['free', 'paid']).optional().default('free'),
  SESSIONS: z.any().optional(), // Cloudflare KV Namespace binding
  DB: z.any().optional(), // Cloudflare D1 Database binding
  CACHE: z.any().optional(), // Cloudflare KV Namespace binding
  RATE_LIMIT: z.any().optional(), // Cloudflare KV Namespace binding
  GEMINI_API_KEY: z.string().min(1), // Required for Gemini integration
  // Add other environment variables here
});

export type Env = CloudflareEnv;

export function validateEnv(env: unknown): Env {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }
  // Cast to CloudflareEnv type as we've validated the structure
  return env as Env;
}
