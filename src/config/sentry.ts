import {
  CloudflareClient,
  setUser,
  captureException as sentryCapture,
  captureMessage as sentryMessage,
} from '@sentry/cloudflare';
import type { Hono } from 'hono';

import type { Env } from './env';

let sentryClient: CloudflareClient | null = null;

export function initSentry(env: Env) {
  if (env.SENTRY_DSN && !sentryClient) {
    sentryClient = new CloudflareClient({
      dsn: env.SENTRY_DSN,
      environment: env.ENVIRONMENT || 'development',
      release: env.RELEASE || 'unknown',

      // Performance monitoring
      tracesSampleRate: env.ENVIRONMENT === 'production' ? 0.1 : 1.0,

      // Additional options
      beforeSend(event: any, _hint: any) {
        // Filter out sensitive data
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['x-telegram-bot-api-secret-token'];
        }

        // Don't send events in development unless explicitly enabled
        if (env.ENVIRONMENT === 'development' && !env.SENTRY_DEBUG) {
          return null;
        }

        return event;
      },
    } as any);
  }
  return sentryClient;
}

export function setUserContext(userId: number, data?: Record<string, unknown>) {
  setUser({ id: String(userId), ...data });
}

export function clearUserContext() {
  setUser(null);
}

export function getSentryClient(): CloudflareClient | null {
  return sentryClient;
}

export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (sentryClient) {
    sentryCapture(error, {
      contexts: {
        additional: context || {},
      },
    });
  }
}

export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
): void {
  if (sentryClient) {
    sentryMessage(message, level);
  }
}

export function wrapSentry(
  app: Hono<{ Bindings: Env }>,
  additionalHandlers?: Record<string, unknown>,
) {
  return {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
      const client = initSentry(env);

      try {
        // Request context is captured automatically by Cloudflare SDK

        return await app.fetch(request, env, ctx);
      } catch (err) {
        // Capture exception with Sentry
        if (client && err instanceof Error) {
          sentryCapture(err, {
            tags: {
              environment: env.ENVIRONMENT || 'development',
              runtime: 'cloudflare-workers',
            },
            contexts: {
              request: {
                url: request.url,
                method: request.method,
              },
            },
          });

          // Ensure the event is sent before the worker terminates
          ctx.waitUntil(client.flush(2000));
        }

        console.error('Error captured by Sentry:', err);
        throw err;
      }
    },
    ...additionalHandlers,
  };
}
