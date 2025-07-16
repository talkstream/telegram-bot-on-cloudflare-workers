import type { Context } from 'hono';

import type { Env, HealthStatus } from '@/types';
import { logger } from '@/lib/logger';

export async function healthHandler(c: Context<{ Bindings: Env }>) {
  const startTime = Date.now();
  const env = c.env;

  const status: HealthStatus = {
    status: 'healthy',
    version: '1.0.0',
    environment: env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
    services: {
      database: false,
      cache: false,
      telegram: false,
      ai: false,
    },
  };

  // Check D1 Database
  if (env.DB) {
    try {
      const result = await env.DB.prepare('SELECT 1 as health').first();
      status.services.database = result?.health === 1;
    } catch (error) {
      logger.error('D1 health check failed', { error });
      status.services.database = false;
      status.status = 'degraded';
    }
  }

  // Check KV Cache
  if (env.CACHE) {
    try {
      const testKey = `health_check_${Date.now()}`;
      await env.CACHE.put(testKey, 'ok', { expirationTtl: 60 });
      const value = await env.CACHE.get(testKey);
      status.services.cache = value === 'ok';
      await env.CACHE.delete(testKey);
    } catch (error) {
      logger.error('KV cache health check failed', { error });
      status.services.cache = false;
      status.status = 'degraded';
    }
  }

  // Check Telegram Bot Token
  if (env.TELEGRAM_BOT_TOKEN) {
    try {
      // Just verify token format
      status.services.telegram = /^\d+:[A-Za-z0-9_-]{35}$/.test(
        env.TELEGRAM_BOT_TOKEN
      );
    } catch (error) {
      logger.error('Telegram token check failed', { error });
      status.services.telegram = false;
      status.status = 'degraded';
    }
  }

  // Check AI Service (Gemini)
  if (env.GEMINI_API_KEY) {
    try {
      // Just verify API key format
      status.services.ai = env.GEMINI_API_KEY.length > 20;
    } catch (error) {
      logger.error('AI service check failed', { error });
      status.services.ai = false;
      status.status = 'degraded';
    }
  }

  // Determine overall status
  const criticalServices = [status.services.database, status.services.telegram];
  if (criticalServices.some((service) => !service)) {
    status.status = 'unhealthy';
  }

  // Add performance metric
  const duration = Date.now() - startTime;
  logger.info('Health check completed', {
    status: status.status,
    duration,
    services: status.services,
  });

  // Return appropriate status code
  const statusCode =
    status.status === 'healthy'
      ? 200
      : status.status === 'degraded'
        ? 200
        : 503;

  return c.json(status, statusCode);
}
