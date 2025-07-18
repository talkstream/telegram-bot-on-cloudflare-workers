/// <reference types="@cloudflare/workers-types" />

import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

declare global {
  interface CloudflareEnv {
    // Environment Variables
    TELEGRAM_BOT_TOKEN: string;
    TELEGRAM_WEBHOOK_SECRET: string;
    GEMINI_API_KEY: string;
    SENTRY_DSN?: string;
    ENVIRONMENT: 'development' | 'staging' | 'production';
    TIER?: 'free' | 'paid';

    // Bindings
    DB: D1Database;
    CACHE: KVNamespace;
    RATE_LIMIT: KVNamespace;
    SESSIONS: KVNamespace;

    // Additional bindings can be added here
    // QUEUE?: Queue;
    // BUCKET?: R2Bucket;
    // DURABLE_OBJECT?: DurableObjectNamespace;
  }
}

export type Env = CloudflareEnv;
export { CloudflareEnv };
