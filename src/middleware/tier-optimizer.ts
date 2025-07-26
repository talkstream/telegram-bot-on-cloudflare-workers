/**
 * Tier optimization middleware
 */

import type { Context, Next } from 'hono';

import type {
  CloudflareTier,
  ITierOptimizationService,
  IOptimizationConfig,
  IOptimizationUtils,
} from '../core/interfaces/tier-optimization';
import type { IEdgeCacheService } from '../core/interfaces/edge-cache';
import type { EventBus } from '../core/events/event-bus';
import { TierOptimizationService } from '../core/services/tier-optimization/tier-optimization-service';

interface TierOptimizerOptions {
  /**
   * Cloudflare tier (auto-detected if not specified)
   */
  tier?: CloudflareTier;

  /**
   * Optimization configuration
   */
  config?: Partial<IOptimizationConfig>;

  /**
   * Edge cache service for caching
   */
  cacheService?: IEdgeCacheService;

  /**
   * Event bus for notifications
   */
  eventBus?: EventBus;

  /**
   * Custom tier detection function
   */
  detectTier?: (c: Context) => CloudflareTier;

  /**
   * Enable detailed logging
   */
  debug?: boolean;

  /**
   * Routes to exclude from optimization
   */
  excludeRoutes?: string[] | RegExp | ((path: string) => boolean);

  /**
   * Response interceptor
   */
  onResponse?: (c: Context, response: Response) => Response | Promise<Response>;
}

/**
 * Detect Cloudflare tier from environment
 */
function detectCloudflareTier(c: Context): CloudflareTier {
  // Check for enterprise features
  if (c.env?.ENTERPRISE_FEATURES || c.env?.CF_ACCOUNT_TYPE === 'enterprise') {
    return 'enterprise';
  }

  // Check for paid features
  if (
    c.env?.QUEUES || // Queues are paid-only
    c.env?.ANALYTICS_ENGINE || // Analytics Engine is paid-only
    c.env?.TRACE_WORKER || // Trace Workers are paid-only
    c.env?.CF_ACCOUNT_TYPE === 'paid'
  ) {
    return 'paid';
  }

  // Check CPU limits (this is approximate)
  // In production, you might want to measure actual CPU time
  const cpuLimit = c.env?.CPU_LIMIT || c.env?.WORKER_CPU_LIMIT;
  if (cpuLimit && parseInt(cpuLimit) > 50) {
    return 'paid';
  }

  // Default to free tier
  return 'free';
}

/**
 * Create tier optimization middleware
 */
export function createTierOptimizer(options: TierOptimizerOptions = {}) {
  let optimizationService: ITierOptimizationService | null = null;

  const shouldOptimize = (path: string): boolean => {
    if (!options.excludeRoutes) return true;

    if (Array.isArray(options.excludeRoutes)) {
      return !options.excludeRoutes.includes(path);
    }

    if (options.excludeRoutes instanceof RegExp) {
      return !options.excludeRoutes.test(path);
    }

    if (typeof options.excludeRoutes === 'function') {
      return !options.excludeRoutes(path);
    }

    return true;
  };

  return async function tierOptimizer(c: Context, next: Next) {
    const path = c.req.path;

    // Skip if excluded
    if (!shouldOptimize(path)) {
      return next();
    }

    // Initialize optimization service
    if (!optimizationService) {
      const tier = options.tier || options.detectTier?.(c) || detectCloudflareTier(c);

      optimizationService = new TierOptimizationService(tier, options.config, {
        cacheService: options.cacheService,
        eventBus: options.eventBus,
      });

      if (options.debug) {
        console.info(`Tier optimization initialized for ${tier} tier`);
      }
    }

    // Track request start
    const startTime = Date.now();
    const startMemory = process.memoryUsage?.()?.heapUsed || 0;

    // Apply pre-request optimizations
    await optimizationService.optimize({
      request: {
        method: c.req.method,
        path: c.req.path,
        size: parseInt(c.req.header('content-length') || '0'),
      },
    });

    // Store service in context for use by handlers
    c.set('tierOptimization', optimizationService);

    try {
      // Execute handler
      await next();

      // Track resource usage
      const cpuTime = Date.now() - startTime;
      const memory = (process.memoryUsage?.()?.heapUsed || 0) - startMemory;

      optimizationService.trackUsage('cpuTime', cpuTime);
      optimizationService.trackUsage('memory', Math.max(0, memory / (1024 * 1024))); // Convert to MB

      // Apply response optimizations
      if (options.onResponse) {
        const response = await options.onResponse(c, c.res);
        if (response !== c.res) {
          c.res = response;
        }
      }

      // Check if within limits
      if (!optimizationService.isWithinLimits()) {
        console.warn('Resource limits exceeded:', optimizationService.getUsage());
      }

      // Get recommendations
      const recommendations = optimizationService.getRecommendations();
      if (recommendations.length > 0 && options.debug) {
        console.info('Optimization recommendations:', recommendations);
      }

      // Add optimization headers in debug mode
      if (options.debug) {
        const usage = optimizationService.getUsage();
        const limits = optimizationService.getTierLimits();

        c.header('X-Tier', optimizationService.getCurrentTier());
        c.header('X-CPU-Usage', `${usage.cpuTime}/${limits.cpuTime}ms`);
        c.header('X-Memory-Usage', `${usage.memory.toFixed(1)}/${limits.memory}MB`);
        c.header('X-Optimization-Count', recommendations.length.toString());
      }
    } catch (error) {
      // Track error
      optimizationService.trackUsage('cpuTime', Date.now() - startTime);
      throw error;
    } finally {
      // Reset usage for next request
      optimizationService.resetUsage();
    }
  };
}

/**
 * Helper to get optimization service from context
 */
export function getOptimizationService(c: Context): ITierOptimizationService | undefined {
  return c.get('tierOptimization');
}

/**
 * Optimization-aware cache wrapper
 */
export function optimizedCache<T>(
  c: Context,
  _key: string,
  fn: () => Promise<T>,
  options?: { ttl?: number; swr?: number },
): Promise<T> {
  const service = getOptimizationService(c);

  if (service) {
    const context = {
      tier: service.getCurrentTier(),
      limits: service.getTierLimits(),
      usage: service.getUsage(),
      config: { cache: { enabled: true, ttl: 300, swr: 3600 } } as IOptimizationConfig,
      utils: {
        cache: async (_k: string, f: () => Promise<T>, _o?: { ttl?: number; swr?: number }) => {
          // Simple in-memory cache for demo
          return f();
        },
      } as IOptimizationUtils,
    };

    // Adjust cache times based on tier
    if (context.tier === 'free') {
      const _adjustedOptions = {
        ttl: options?.ttl ? options.ttl * 2 : 600, // Double TTL for free tier
        swr: options?.swr ? options.swr * 2 : 7200,
      };
      // Options would be used here in real implementation
    }
  }

  return fn();
}

/**
 * Optimization-aware batch processor
 */
export async function optimizedBatch<T, R>(
  c: Context,
  items: T[],
  processor: (batch: T[]) => Promise<R[]>,
  defaultBatchSize: number = 10,
): Promise<R[]> {
  const service = getOptimizationService(c);

  let batchSize = defaultBatchSize;

  if (service) {
    const tier = service.getCurrentTier();

    // Adjust batch size based on tier
    if (tier === 'free') {
      batchSize = Math.min(5, defaultBatchSize); // Smaller batches for free tier
    } else if (tier === 'enterprise') {
      batchSize = Math.min(50, defaultBatchSize * 2); // Larger batches for enterprise
    }

    // Further adjust based on remaining resources
    const usage = service.getUsage();
    const limits = service.getTierLimits();

    if (usage.cpuTime > limits.cpuTime * 0.7) {
      batchSize = Math.max(1, Math.floor(batchSize / 2)); // Halve batch size if CPU constrained
    }
  }

  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);

    // Track subrequest for each batch
    service?.trackUsage('subrequests', 1);
  }

  return results;
}

/**
 * Create tier-specific response
 */
export function createTieredResponse(
  c: Context,
  data: unknown,
  options?: {
    fullDataTiers?: CloudflareTier[];
    summaryFields?: string[];
  },
): Response {
  const service = getOptimizationService(c);
  const tier = service?.getCurrentTier() || 'free';

  const fullDataTiers = options?.fullDataTiers || ['paid', 'enterprise'];

  // Return full data for higher tiers
  if (fullDataTiers.includes(tier)) {
    return c.json(data);
  }

  // Return summary for free tier
  if (options?.summaryFields && Array.isArray(data)) {
    const summary = data.map((item: Record<string, unknown>) => {
      const summaryItem: Record<string, unknown> = {};
      for (const field of options.summaryFields) {
        if (field in item) {
          summaryItem[field] = item[field];
        }
      }
      return summaryItem;
    });

    return c.json({
      data: summary,
      _tier: tier,
      _notice: 'Upgrade to paid plan for full data access',
    });
  }

  // Return limited data
  const limitedData = Array.isArray(data) ? data.slice(0, 10) : data;

  return c.json({
    data: limitedData,
    _tier: tier,
    _notice:
      Array.isArray(data) && data.length > 10
        ? `Showing first 10 items. Upgrade to paid plan for full access.`
        : undefined,
  });
}
