/// <reference types="@cloudflare/workers-types" />

import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

declare global {
  interface CloudflareEnv {
    // Environment Variables
    TELEGRAM_BOT_TOKEN: string;
    TELEGRAM_WEBHOOK_SECRET: string;
    SENTRY_DSN?: string;
    ENVIRONMENT: 'development' | 'staging' | 'production';
    TIER?: 'free' | 'paid';

    // AI Provider configuration
    AI_PROVIDER?: string;
    AI_PROVIDERS_CONFIG?: string;

    // Provider API Keys (all optional)
    GEMINI_API_KEY?: string;
    OPENAI_API_KEY?: string;
    XAI_API_KEY?: string;
    DEEPSEEK_API_KEY?: string;
    CLOUDFLARE_AI_ACCOUNT_ID?: string;
    CLOUDFLARE_AI_API_TOKEN?: string;

    // Cost tracking
    AI_COST_TRACKING_ENABLED?: boolean;
    AI_COST_CONFIG_URL?: string;

    // Owner configuration
    BOT_OWNER_IDS?: string;

    // Bindings
    DB: D1Database;
    CACHE: KVNamespace;
    RATE_LIMIT: KVNamespace;
    SESSIONS: KVNamespace;

    // Cloudflare AI binding (runtime)
    AI?: {
      run(
        model: string,
        inputs: unknown,
      ): Promise<{
        response: string;
      }>;
    };

    // Additional bindings can be added here
    // QUEUE?: Queue;
    // BUCKET?: R2Bucket;
    // DURABLE_OBJECT?: DurableObjectNamespace;
  }
}

export type Env = CloudflareEnv;
export { CloudflareEnv };
