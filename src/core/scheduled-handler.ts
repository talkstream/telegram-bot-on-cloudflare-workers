import { logger } from '../lib/logger';

import { SessionService } from '@/services/session-service';
import { MultiLayerCache } from '@/lib/multi-layer-cache';
import { getTierConfig } from '@/config/cloudflare-tiers';
import { getCloudPlatformConnector } from '@/core/cloud/cloud-platform-cache';
import type { Env } from '@/types';

export async function handleScheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  const startTime = Date.now();

  // Get tier from resource constraints
  const cloudConnector = getCloudPlatformConnector(env);
  const constraints = cloudConnector.getResourceConstraints();
  const tier = constraints.maxExecutionTimeMs >= 5000 ? 'paid' : 'free';
  const config = getTierConfig(tier);

  logger.info(`Scheduled event received: ${event.cron}`, { tier });

  try {
    // Only run cleanup tasks on paid tier to save resources
    if (tier === 'paid' && config.features.sessionPersistence) {
      // Session cleanup
      if (env.SESSIONS) {
        ctx.waitUntil(
          cleanupSessions(env).catch((error) => {
            logger.error('Session cleanup failed', { error });
          }),
        );
      }

      // Cache statistics logging
      if (env.CACHE) {
        ctx.waitUntil(
          logCacheStats(env).catch((error) => {
            logger.error('Cache stats logging failed', { error });
          }),
        );
      }
    }

    // Add other scheduled tasks here
    // For example: sending daily reminders, aggregating statistics, etc.

    const duration = Date.now() - startTime;
    logger.info('Scheduled tasks completed', { duration, tier });
  } catch (error) {
    logger.error('Scheduled handler error', { error, tier });
    throw error;
  }
}

/**
 * Clean up expired sessions
 */
async function cleanupSessions(env: Env): Promise<void> {
  // Get tier from resource constraints
  const cloudConnector = getCloudPlatformConnector(env);
  const constraints = cloudConnector.getResourceConstraints();
  const tier = constraints.maxExecutionTimeMs >= 5000 ? 'paid' : 'free';

  const cache = env.CACHE ? new MultiLayerCache(env.CACHE, tier) : undefined;
  if (!env.SESSIONS) {
    logger.warn('Sessions KV not configured, skipping session cleanup');
    return;
  }
  const sessionService = new SessionService(env.SESSIONS, tier, cache);

  const cleaned = await sessionService.cleanupExpiredSessions(100);
  logger.info('Session cleanup completed', { cleaned });
}

/**
 * Log cache statistics
 */
async function logCacheStats(env: Env): Promise<void> {
  // Get tier from resource constraints
  const cloudConnector = getCloudPlatformConnector(env);
  const constraints = cloudConnector.getResourceConstraints();
  const tier = constraints.maxExecutionTimeMs >= 5000 ? 'paid' : 'free';
  if (!env.CACHE) {
    logger.warn('Cache KV not configured, skipping cache stats');
    return;
  }
  const cache = new MultiLayerCache(env.CACHE, tier);

  const stats = cache.getStats();
  logger.info('Cache statistics', stats);
}
