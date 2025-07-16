import { z } from 'zod';

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  ENVIRONMENT: z.string().optional(),
  SESSIONS: z.any().optional(), // Cloudflare KV Namespace binding
  DB: z.any().optional(), // Cloudflare D1 Database binding
  GEMINI_API_KEY: z.string().min(1), // Required for Gemini integration
  // Add other environment variables here
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(env: unknown): Env {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    console.error(
      'Invalid environment variables:',
      parsed.error.flatten().fieldErrors
    );
    throw new Error('Invalid environment variables');
  }
  return parsed.data;
}
