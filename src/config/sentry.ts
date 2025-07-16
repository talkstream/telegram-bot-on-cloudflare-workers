import * as Sentry from '@sentry/cloudflare';
import { Env } from './env';

export function initSentry(env: Env) {
  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      // We recommend adjusting this value in production, or using tracesSampler
      // for finer control
      tracesSampleRate: 1.0,
      environment: env.ENVIRONMENT || 'development',
    });
  }
}

export function setUserContext(userId: number, data?: Record<string, any>) {
  Sentry.setUser({ id: String(userId), ...data });
}

export function clearUserContext() {
  Sentry.setUser(null);
}

export function wrapSentry(app: any) {
  return {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
      initSentry(env);
      try {
        return await app.fetch(request, env, ctx);
      } catch (err) {
        Sentry.captureException(err);
        throw err;
      }
    },
  };
}
