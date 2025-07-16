import { CloudflareClient, setUser } from '@sentry/cloudflare';
import type { Hono } from 'hono';

import type { Env } from './env';

let sentryClient: CloudflareClient | null = null;

export function initSentry(env: Env) {
  if (env.SENTRY_DSN && !sentryClient) {
    // For now, just log that Sentry would be initialized
    // console.log('Sentry initialization skipped in wireframe');
    // In real app, you would properly configure CloudflareClient
  }
  return sentryClient;
}

export function setUserContext(userId: number, data?: Record<string, unknown>) {
  setUser({ id: String(userId), ...data });
}

export function clearUserContext() {
  setUser(null);
}

export function wrapSentry(app: Hono<{ Bindings: Env }>) {
  return {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
      initSentry(env);
      try {
        return await app.fetch(request, env, ctx);
      } catch (err) {
        // In real app, you would capture exception with sentryClient
        console.error('Sentry would capture:', err);
        throw err;
      }
    },
  };
}
