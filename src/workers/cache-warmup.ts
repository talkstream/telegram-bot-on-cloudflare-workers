/**
 * Cache Warmup Worker
 *
 * Provides scheduled and on-demand cache warming functionality
 * for edge cache. Supports custom schedules, parallel warming,
 * and configurable warmup strategies.
 */

import type { IEdgeCacheService, CacheOptions } from '../core/interfaces/cache.js';
import type { ILogger } from '../core/interfaces/logger.js';
import { EdgeCacheService } from '../core/services/cache/edge-cache-service.js';

// Cloudflare Workers types
declare global {
  interface ScheduledController {
    scheduledTime: number;
    cron: string;
  }

  interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  }
}

export interface CacheWarmupConfig {
  /**
   * Items to warm up
   */
  items: CacheWarmupItem[];

  /**
   * Maximum number of parallel warmup operations
   */
  concurrency?: number;

  /**
   * Retry failed warmups
   */
  retryFailures?: boolean;

  /**
   * Number of retry attempts
   */
  maxRetries?: number;

  /**
   * Logger instance
   */
  logger?: ILogger;
}

export interface CacheWarmupItem {
  /**
   * Cache key
   */
  key: string;

  /**
   * Factory function to generate the value
   */
  factory: () => Promise<unknown>;

  /**
   * Cache options (TTL, tags, etc.)
   */
  options?: CacheOptions;

  /**
   * Item priority (higher = warmed first)
   */
  priority?: number;

  /**
   * Skip if already cached
   */
  skipIfCached?: boolean;
}

export interface CacheWarmupResult {
  /**
   * Total items to warm
   */
  total: number;

  /**
   * Successfully warmed items
   */
  successful: number;

  /**
   * Failed items
   */
  failed: number;

  /**
   * Skipped items (already cached)
   */
  skipped: number;

  /**
   * Total duration in milliseconds
   */
  duration: number;

  /**
   * Individual item results
   */
  results: Array<{
    key: string;
    status: 'success' | 'failed' | 'skipped';
    error?: string;
    duration: number;
  }>;
}

/**
 * Cache Warmup Service
 */
export class CacheWarmupService {
  private cache: IEdgeCacheService;
  private logger?: ILogger;

  constructor(cache: IEdgeCacheService, logger?: ILogger) {
    this.cache = cache;
    this.logger = logger;
  }

  /**
   * Warm up cache with specified items
   */
  async warmup(config: CacheWarmupConfig): Promise<CacheWarmupResult> {
    const startTime = Date.now();
    const results: CacheWarmupResult['results'] = [];

    this.logger?.info('Starting cache warmup', {
      totalItems: config.items.length,
      concurrency: config.concurrency || 5,
    });

    // Sort items by priority
    const sortedItems = [...config.items].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Process items with controlled concurrency
    const concurrency = config.concurrency || 5;
    const chunks = this.chunkArray(sortedItems, concurrency);

    let successful = 0;
    let failed = 0;
    let skipped = 0;

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(chunk.map((item) => this.warmupItem(item, config)));

      for (const result of chunkResults) {
        results.push(result);

        switch (result.status) {
          case 'success':
            successful++;
            break;
          case 'failed':
            failed++;
            break;
          case 'skipped':
            skipped++;
            break;
        }
      }
    }

    const duration = Date.now() - startTime;

    this.logger?.info('Cache warmup completed', {
      successful,
      failed,
      skipped,
      duration,
    });

    return {
      total: config.items.length,
      successful,
      failed,
      skipped,
      duration,
      results,
    };
  }

  /**
   * Warm up a single item
   */
  private async warmupItem(
    item: CacheWarmupItem,
    config: CacheWarmupConfig,
  ): Promise<CacheWarmupResult['results'][0]> {
    const startTime = Date.now();

    try {
      // Check if already cached
      if (item.skipIfCached) {
        const existing = await this.cache.has(item.key);
        if (existing) {
          this.logger?.debug('Skipping cached item', { key: item.key });
          return {
            key: item.key,
            status: 'skipped',
            duration: Date.now() - startTime,
          };
        }
      }

      // Warm up with retries
      let lastError: Error | undefined;
      const maxRetries = config.retryFailures ? config.maxRetries || 3 : 1;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await this.cache.getOrSet(item.key, item.factory, item.options);

          this.logger?.debug('Cache item warmed', {
            key: item.key,
            attempt,
            duration: Date.now() - startTime,
          });

          return {
            key: item.key,
            status: 'success',
            duration: Date.now() - startTime,
          };
        } catch (error) {
          lastError = error as Error;
          this.logger?.warn('Cache warmup attempt failed', {
            key: item.key,
            attempt,
            error: lastError.message,
          });

          if (attempt < maxRetries) {
            // Exponential backoff
            await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
          }
        }
      }

      // All retries failed
      throw lastError;
    } catch (error) {
      this.logger?.error('Failed to warm cache item', {
        key: item.key,
        error: (error as Error).message,
      });

      return {
        key: item.key,
        status: 'failed',
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

/**
 * Common cache warmup patterns
 */
export class CacheWarmupPatterns {
  /**
   * Create warmup items for API endpoints
   */
  static createApiEndpointWarmup(
    endpoints: Array<{
      path: string;
      method?: string;
      params?: Record<string, string>;
      ttl?: number;
      priority?: number;
    }>,
    baseFactory: (endpoint: {
      path: string;
      method?: string;
      params?: Record<string, string>;
      ttl?: number;
      priority?: number;
    }) => () => Promise<unknown>,
  ): CacheWarmupItem[] {
    return endpoints.map((endpoint) => ({
      key: this.generateEndpointKey(endpoint),
      factory: baseFactory(endpoint),
      options: { ttl: endpoint.ttl || 3600 },
      priority: endpoint.priority || 0,
    }));
  }

  /**
   * Create warmup items for database queries
   */
  static createDatabaseWarmup(
    queries: Array<{
      name: string;
      query: () => Promise<unknown>;
      ttl?: number;
      tags?: string[];
      priority?: number;
    }>,
  ): CacheWarmupItem[] {
    return queries.map((query) => ({
      key: `db:${query.name}`,
      factory: query.query,
      options: { ttl: query.ttl || 300, tags: query.tags },
      priority: query.priority || 0,
    }));
  }

  /**
   * Generate consistent endpoint key
   */
  private static generateEndpointKey(endpoint: {
    path: string;
    method?: string;
    params?: Record<string, string>;
  }): string {
    const method = endpoint.method || 'GET';
    const params = endpoint.params
      ? ':' +
        Object.entries(endpoint.params)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join('&')
      : '';

    return `api:${method}:${endpoint.path}${params}`;
  }
}

/**
 * Scheduled handler for Cloudflare Workers
 * Can be configured in wrangler.toml:
 *
 * [[triggers.crons]]
 * cron = "0 6 * * *"  # Every day at 6 AM
 */
export async function scheduled(
  _controller: ScheduledController,
  env: Record<string, unknown>,
  ctx: ExecutionContext,
): Promise<void> {
  const logger = env.LOGGER as ILogger | undefined; // Assume logger is available in env

  try {
    // Create cache service
    const cache = new EdgeCacheService({ logger });
    const warmupService = new CacheWarmupService(cache, logger);

    // Define what to warm up (customize based on your needs)
    const config: CacheWarmupConfig = {
      items: [
        // Example: Warm up popular API endpoints
        ...CacheWarmupPatterns.createApiEndpointWarmup(
          [
            { path: '/api/config', ttl: 3600, priority: 10 },
            { path: '/api/categories', ttl: 1800, priority: 9 },
            { path: '/api/featured', ttl: 600, priority: 8 },
          ],
          (endpoint) => async () => {
            // Your API fetch logic here
            const response = await fetch(`${env.API_URL as string}${endpoint.path}`);
            return response.json();
          },
        ),

        // Example: Warm up database queries
        ...CacheWarmupPatterns.createDatabaseWarmup([
          {
            name: 'active-users-count',
            query: async () => {
              // Your database query here
              return { count: 1000 };
            },
            ttl: 300,
            priority: 7,
          },
        ]),
      ],
      concurrency: 10,
      retryFailures: true,
      maxRetries: 3,
      logger: logger,
    };

    // Run warmup
    ctx.waitUntil(
      warmupService
        .warmup(config)
        .then((result) => {
          logger?.info('Scheduled cache warmup completed', {
            total: result.total,
            successful: result.successful,
            failed: result.failed,
            skipped: result.skipped,
            duration: result.duration,
          });
          return result;
        })
        .catch((error) => {
          logger?.error('Scheduled cache warmup failed', { error });
        }),
    );
  } catch (error) {
    logger?.error('Failed to initialize cache warmup', { error });
  }
}

/**
 * HTTP handler for manual cache warmup
 * Can be triggered via API call
 */
export async function handleCacheWarmup(
  request: Request,
  env: Record<string, unknown>,
): Promise<Response> {
  const logger = env.LOGGER as ILogger | undefined;

  try {
    // Verify authorization (add your auth logic)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${env.WARMUP_SECRET as string}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Parse request body for custom config
    const body = (await request.json()) as { items?: CacheWarmupItem[] };

    // Create services
    const cache = new EdgeCacheService({ logger });
    const warmupService = new CacheWarmupService(cache, logger);

    // Use provided items or defaults
    const config: CacheWarmupConfig = {
      items: body.items || [], // Add your default items
      concurrency: 5,
      retryFailures: true,
      logger: logger,
    };

    // Run warmup
    const result = await warmupService.warmup(config);

    return new Response(
      JSON.stringify({
        success: true,
        result,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    logger?.error('Manual cache warmup failed', { error });

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
