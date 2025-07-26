/**
 * Tier-based optimization interfaces
 */

/**
 * Cloudflare plan tier
 */
export type CloudflareTier = 'free' | 'paid' | 'enterprise';

/**
 * Resource limits for different tiers
 */
export interface ITierLimits {
  /**
   * CPU time limit per request (ms)
   */
  cpuTime: number;

  /**
   * Memory limit (MB)
   */
  memory: number;

  /**
   * Subrequest limit
   */
  subrequests: number;

  /**
   * Environment variable size (bytes)
   */
  envVarSize: number;

  /**
   * Script size (bytes)
   */
  scriptSize: number;

  /**
   * KV operations per request
   */
  kvOperations: {
    read: number;
    write: number;
    delete: number;
    list: number;
  };

  /**
   * D1 operations per request
   */
  d1Operations: {
    read: number;
    write: number;
  };

  /**
   * Queue messages per batch
   */
  queueBatchSize: number;

  /**
   * Durable Object requests
   */
  durableObjectRequests: number;
}

/**
 * Optimization strategy
 */
export interface IOptimizationStrategy {
  /**
   * Name of the strategy
   */
  name: string;

  /**
   * Description
   */
  description: string;

  /**
   * Priority (higher = more important)
   */
  priority: number;

  /**
   * Check if strategy should be applied
   */
  shouldApply: (context: IOptimizationContext) => boolean;

  /**
   * Apply the optimization
   */
  apply: (context: IOptimizationContext) => void | Promise<void>;
}

/**
 * Optimization context
 */
export interface IOptimizationContext {
  /**
   * Current tier
   */
  tier: CloudflareTier;

  /**
   * Resource limits
   */
  limits: ITierLimits;

  /**
   * Current resource usage
   */
  usage: IResourceUsage;

  /**
   * Request context
   */
  request?: {
    method: string;
    path: string;
    size: number;
  };

  /**
   * Configuration options
   */
  config: IOptimizationConfig;

  /**
   * Helper utilities
   */
  utils: IOptimizationUtils;
}

/**
 * Resource usage metrics
 */
export interface IResourceUsage {
  /**
   * CPU time used (ms)
   */
  cpuTime: number;

  /**
   * Memory used (MB)
   */
  memory: number;

  /**
   * Subrequests made
   */
  subrequests: number;

  /**
   * KV operations
   */
  kvOperations: {
    read: number;
    write: number;
    delete: number;
    list: number;
  };

  /**
   * D1 operations
   */
  d1Operations: {
    read: number;
    write: number;
  };
}

/**
 * Optimization configuration
 */
export interface IOptimizationConfig {
  /**
   * Enable automatic optimizations
   */
  enabled: boolean;

  /**
   * Aggressive mode (may affect functionality)
   */
  aggressive: boolean;

  /**
   * Cache settings
   */
  cache: {
    /**
     * Enable response caching
     */
    enabled: boolean;

    /**
     * Default TTL (seconds)
     */
    ttl: number;

    /**
     * Stale-while-revalidate time (seconds)
     */
    swr: number;
  };

  /**
   * Batch settings
   */
  batching: {
    /**
     * Enable request batching
     */
    enabled: boolean;

    /**
     * Batch size
     */
    size: number;

    /**
     * Batch timeout (ms)
     */
    timeout: number;
  };

  /**
   * Compression settings
   */
  compression: {
    /**
     * Enable response compression
     */
    enabled: boolean;

    /**
     * Minimum size for compression (bytes)
     */
    threshold: number;
  };

  /**
   * Query optimization
   */
  queries: {
    /**
     * Enable query result caching
     */
    cache: boolean;

    /**
     * Enable query batching
     */
    batch: boolean;

    /**
     * Maximum query complexity
     */
    maxComplexity: number;
  };

  /**
   * Custom strategies
   */
  strategies?: IOptimizationStrategy[];
}

/**
 * Optimization utilities
 */
export interface IOptimizationUtils {
  /**
   * Measure CPU time
   */
  measureCPU<T>(fn: () => T | Promise<T>): Promise<{ result: T; cpuTime: number }>;

  /**
   * Batch operations
   */
  batch<T, R>(items: T[], processor: (batch: T[]) => Promise<R[]>, batchSize: number): Promise<R[]>;

  /**
   * Cache result
   */
  cache<T>(key: string, fn: () => Promise<T>, options?: { ttl?: number; swr?: number }): Promise<T>;

  /**
   * Defer operation
   */
  defer(fn: () => void | Promise<void>): void;

  /**
   * Check remaining resources
   */
  getRemainingResources(): {
    cpuTime: number;
    memory: number;
    subrequests: number;
  };
}

/**
 * Tier optimization service
 */
export interface ITierOptimizationService {
  /**
   * Get current tier
   */
  getCurrentTier(): CloudflareTier;

  /**
   * Get tier limits
   */
  getTierLimits(tier?: CloudflareTier): ITierLimits;

  /**
   * Get optimization strategies
   */
  getStrategies(): IOptimizationStrategy[];

  /**
   * Apply optimizations
   */
  optimize(context: Partial<IOptimizationContext>): Promise<void>;

  /**
   * Track resource usage
   */
  trackUsage(type: keyof IResourceUsage, amount: number): void;

  /**
   * Get current usage
   */
  getUsage(): IResourceUsage;

  /**
   * Reset usage tracking
   */
  resetUsage(): void;

  /**
   * Check if within limits
   */
  isWithinLimits(): boolean;

  /**
   * Get recommendations
   */
  getRecommendations(): IOptimizationRecommendation[];
}

/**
 * Optimization recommendation
 */
export interface IOptimizationRecommendation {
  /**
   * Recommendation type
   */
  type: 'warning' | 'suggestion' | 'critical';

  /**
   * Category
   */
  category: 'cpu' | 'memory' | 'io' | 'network' | 'cost';

  /**
   * Message
   */
  message: string;

  /**
   * Detailed description
   */
  description?: string;

  /**
   * Impact level (1-10)
   */
  impact: number;

  /**
   * Suggested action
   */
  action?: string;

  /**
   * Related metrics
   */
  metrics?: Record<string, number>;
}
