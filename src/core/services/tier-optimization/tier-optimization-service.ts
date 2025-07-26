/**
 * Tier-based optimization service implementation
 */

import type {
  CloudflareTier,
  ITierLimits,
  IOptimizationStrategy,
  IOptimizationContext,
  IResourceUsage,
  IOptimizationConfig,
  IOptimizationUtils,
  ITierOptimizationService,
  IOptimizationRecommendation,
} from '../../interfaces/tier-optimization';
import type { IEdgeCacheService } from '../../interfaces/edge-cache';
import type { EventBus } from '../../events/event-bus';

import { defaultStrategies } from './optimization-strategies';

/**
 * Default tier limits based on Cloudflare documentation
 */
const TIER_LIMITS: Record<CloudflareTier, ITierLimits> = {
  free: {
    cpuTime: 10, // 10ms
    memory: 128, // 128MB
    subrequests: 50,
    envVarSize: 64 * 1024, // 64KB
    scriptSize: 1024 * 1024, // 1MB
    kvOperations: {
      read: 1000,
      write: 100,
      delete: 100,
      list: 100,
    },
    d1Operations: {
      read: 1000,
      write: 100,
    },
    queueBatchSize: 100,
    durableObjectRequests: 50,
  },
  paid: {
    cpuTime: 30000, // 30 seconds
    memory: 128, // 128MB (same as free)
    subrequests: 1000,
    envVarSize: 128 * 1024, // 128KB
    scriptSize: 10 * 1024 * 1024, // 10MB
    kvOperations: {
      read: 10000,
      write: 1000,
      delete: 1000,
      list: 1000,
    },
    d1Operations: {
      read: 10000,
      write: 1000,
    },
    queueBatchSize: 10000,
    durableObjectRequests: 1000,
  },
  enterprise: {
    cpuTime: 30000, // 30 seconds
    memory: 512, // 512MB
    subrequests: 5000,
    envVarSize: 512 * 1024, // 512KB
    scriptSize: 25 * 1024 * 1024, // 25MB
    kvOperations: {
      read: 50000,
      write: 5000,
      delete: 5000,
      list: 5000,
    },
    d1Operations: {
      read: 50000,
      write: 5000,
    },
    queueBatchSize: 50000,
    durableObjectRequests: 5000,
  },
};

/**
 * Default optimization configuration
 */
const DEFAULT_CONFIG: IOptimizationConfig = {
  enabled: true,
  aggressive: false,
  cache: {
    enabled: true,
    ttl: 300, // 5 minutes
    swr: 3600, // 1 hour
  },
  batching: {
    enabled: true,
    size: 10,
    timeout: 100,
  },
  compression: {
    enabled: true,
    threshold: 1024, // 1KB
  },
  queries: {
    cache: true,
    batch: true,
    maxComplexity: 100,
  },
};

/**
 * Tier optimization service implementation
 */
export class TierOptimizationService implements ITierOptimizationService {
  private tier: CloudflareTier;
  private config: IOptimizationConfig;
  private strategies: IOptimizationStrategy[];
  private usage: IResourceUsage;
  private startTime: number;
  private cacheService?: IEdgeCacheService;
  private eventBus?: EventBus;
  private deferredTasks: Array<() => void | Promise<void>> = [];

  constructor(
    tier: CloudflareTier = 'free',
    config: Partial<IOptimizationConfig> = {},
    options?: {
      cacheService?: IEdgeCacheService;
      eventBus?: EventBus;
      strategies?: IOptimizationStrategy[];
    },
  ) {
    this.tier = tier;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.strategies = [...defaultStrategies, ...(options?.strategies || [])];
    this.cacheService = options?.cacheService;
    this.eventBus = options?.eventBus;
    this.startTime = Date.now();

    // Initialize usage tracking
    this.usage = {
      cpuTime: 0,
      memory: 0,
      subrequests: 0,
      kvOperations: { read: 0, write: 0, delete: 0, list: 0 },
      d1Operations: { read: 0, write: 0 },
    };

    // Sort strategies by priority
    this.strategies.sort((a, b) => b.priority - a.priority);
  }

  getCurrentTier(): CloudflareTier {
    return this.tier;
  }

  getTierLimits(tier?: CloudflareTier): ITierLimits {
    return TIER_LIMITS[tier || this.tier];
  }

  getStrategies(): IOptimizationStrategy[] {
    return [...this.strategies];
  }

  async optimize(partialContext: Partial<IOptimizationContext>): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const context: IOptimizationContext = {
      tier: this.tier,
      limits: this.getTierLimits(),
      usage: { ...this.usage },
      config: this.config,
      utils: partialContext.utils || this.createUtils(),
      ...partialContext,
    };

    // Ensure utils is created
    if (!context.utils) {
      context.utils = this.createUtils();
    }

    // If utils was not provided, update the partial context with the created utils
    if (partialContext.utils === null && 'utils' in partialContext) {
      (partialContext as IOptimizationContext).utils = context.utils;
    }

    // Apply applicable strategies
    for (const strategy of this.strategies) {
      try {
        if (strategy.shouldApply(context)) {
          await strategy.apply(context);

          this.eventBus?.emit(
            'optimization:applied',
            {
              strategy: strategy.name,
              tier: this.tier,
            },
            'tier-optimization',
          );
        }
      } catch (error) {
        console.error(`Failed to apply optimization strategy ${strategy.name}:`, error);

        this.eventBus?.emit(
          'optimization:error',
          {
            strategy: strategy.name,
            error,
          },
          'tier-optimization',
        );
      }
    }

    // Process deferred tasks if within limits
    await this.processDeferredTasks();
  }

  trackUsage(type: keyof IResourceUsage, amount: number): void {
    if (type === 'cpuTime') {
      this.usage.cpuTime += amount;
    } else if (type === 'memory') {
      this.usage.memory = Math.max(this.usage.memory, amount);
    } else if (type === 'subrequests') {
      this.usage.subrequests += amount;
    } else if (type === 'kvOperations' || type === 'd1Operations') {
      // These are handled separately
      console.warn(`Use trackOperation for ${type}`);
    }
  }

  /**
   * Track specific operations
   */
  trackOperation(
    type: 'kv' | 'd1',
    operation: 'read' | 'write' | 'delete' | 'list',
    count: number = 1,
  ): void {
    if (type === 'kv' && operation in this.usage.kvOperations) {
      this.usage.kvOperations[operation as keyof typeof this.usage.kvOperations] += count;
    } else if (type === 'd1' && operation in this.usage.d1Operations) {
      this.usage.d1Operations[operation as keyof typeof this.usage.d1Operations] += count;
    }
  }

  getUsage(): IResourceUsage {
    return {
      ...this.usage,
      cpuTime: this.usage.cpuTime + (Date.now() - this.startTime),
    };
  }

  resetUsage(): void {
    this.usage = {
      cpuTime: 0,
      memory: 0,
      subrequests: 0,
      kvOperations: { read: 0, write: 0, delete: 0, list: 0 },
      d1Operations: { read: 0, write: 0 },
    };
    this.startTime = Date.now();
  }

  isWithinLimits(): boolean {
    const limits = this.getTierLimits();
    const usage = this.getUsage();

    // Check CPU time
    if (usage.cpuTime >= limits.cpuTime) {
      return false;
    }

    // Check memory
    if (usage.memory >= limits.memory) {
      return false;
    }

    // Check subrequests
    if (usage.subrequests >= limits.subrequests) {
      return false;
    }

    // Check KV operations
    for (const [op, count] of Object.entries(usage.kvOperations)) {
      if (count >= limits.kvOperations[op as keyof typeof limits.kvOperations]) {
        return false;
      }
    }

    // Check D1 operations
    for (const [op, count] of Object.entries(usage.d1Operations)) {
      if (count >= limits.d1Operations[op as keyof typeof limits.d1Operations]) {
        return false;
      }
    }

    return true;
  }

  getRecommendations(): IOptimizationRecommendation[] {
    const recommendations: IOptimizationRecommendation[] = [];
    const limits = this.getTierLimits();
    const usage = this.getUsage();

    // CPU time recommendations
    const cpuUsagePercent = (usage.cpuTime / limits.cpuTime) * 100;
    if (cpuUsagePercent > 80) {
      recommendations.push({
        type: 'critical',
        category: 'cpu',
        message: 'High CPU usage detected',
        description: `CPU usage is at ${cpuUsagePercent.toFixed(1)}% of the limit`,
        impact: 9,
        action:
          this.tier === 'free'
            ? 'Consider upgrading to paid plan for 3000x more CPU time'
            : 'Optimize heavy computations or use background jobs',
        metrics: { cpuTime: usage.cpuTime, limit: limits.cpuTime },
      });
    }

    // Memory recommendations
    if (usage.memory > limits.memory * 0.8) {
      recommendations.push({
        type: 'warning',
        category: 'memory',
        message: 'High memory usage',
        description: `Memory usage is at ${((usage.memory / limits.memory) * 100).toFixed(1)}%`,
        impact: 7,
        action: 'Reduce in-memory data or use external storage',
        metrics: { memory: usage.memory, limit: limits.memory },
      });
    }

    // KV operation recommendations
    const kvReadPercent = (usage.kvOperations.read / limits.kvOperations.read) * 100;
    if (kvReadPercent > 70) {
      recommendations.push({
        type: 'suggestion',
        category: 'io',
        message: 'High KV read operations',
        description: `KV reads are at ${kvReadPercent.toFixed(1)}% of the limit`,
        impact: 5,
        action: 'Enable caching to reduce KV reads',
        metrics: { kvReads: usage.kvOperations.read, limit: limits.kvOperations.read },
      });
    }

    // Tier upgrade recommendations
    if (this.tier === 'free' && cpuUsagePercent > 50) {
      recommendations.push({
        type: 'suggestion',
        category: 'cost',
        message: 'Consider upgrading to paid plan',
        description: 'Your usage patterns suggest you would benefit from a paid plan',
        impact: 8,
        action: 'Upgrade to paid plan for $5/month to get 3000x more CPU time',
      });
    }

    // Batching recommendations
    if (!this.config.batching.enabled && usage.subrequests > limits.subrequests * 0.5) {
      recommendations.push({
        type: 'suggestion',
        category: 'network',
        message: 'Enable request batching',
        description: 'Batching can reduce the number of subrequests',
        impact: 6,
        action: 'Enable batching in optimization config',
        metrics: { subrequests: usage.subrequests, limit: limits.subrequests },
      });
    }

    return recommendations.sort((a, b) => b.impact - a.impact);
  }

  /**
   * Create optimization utilities
   */
  private createUtils(): IOptimizationUtils {
    return {
      measureCPU: async <T>(fn: () => T | Promise<T>) => {
        const start = Date.now();
        const result = await fn();
        const cpuTime = Date.now() - start;
        this.trackUsage('cpuTime', cpuTime);
        return { result, cpuTime };
      },

      batch: async <T, R>(
        items: T[],
        processor: (batch: T[]) => Promise<R[]>,
        batchSize: number,
      ) => {
        const results: R[] = [];

        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          const batchResults = await processor(batch);
          results.push(...batchResults);
        }

        return results;
      },

      cache: async <T>(
        key: string,
        fn: () => Promise<T>,
        options?: { ttl?: number; swr?: number },
      ) => {
        if (!this.cacheService || !this.config.cache.enabled) {
          return fn();
        }

        const cached = await this.cacheService.get<T>(key);
        if (cached !== null) {
          return cached;
        }

        const result = await fn();

        await this.cacheService.set(key, result, {
          ttl: options?.ttl || this.config.cache.ttl,
          swr: options?.swr || this.config.cache.swr,
        });

        return result;
      },

      defer: (fn: () => void | Promise<void>) => {
        this.deferredTasks.push(fn);
      },

      getRemainingResources: () => {
        const limits = this.getTierLimits();
        const usage = this.getUsage();

        return {
          cpuTime: Math.max(0, limits.cpuTime - usage.cpuTime),
          memory: Math.max(0, limits.memory - usage.memory),
          subrequests: Math.max(0, limits.subrequests - usage.subrequests),
        };
      },
    };
  }

  /**
   * Process deferred tasks if resources allow
   */
  private async processDeferredTasks(): Promise<void> {
    const remaining = this.createUtils().getRemainingResources();

    while (this.deferredTasks.length > 0 && remaining.cpuTime > 1) {
      const task = this.deferredTasks.shift();
      if (task) {
        try {
          await task();
        } catch (error) {
          console.error('Failed to process deferred task:', error);
        }
      }
    }
  }
}
