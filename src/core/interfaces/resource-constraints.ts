/**
 * Platform-agnostic resource constraints interface
 *
 * This replaces the Cloudflare-specific 'free'/'paid' tier system
 * with a universal model that works across all cloud platforms.
 */

/**
 * Resource constraints that define platform capabilities and limits
 */
export interface ResourceConstraints {
  /**
   * Maximum execution time for a single request in milliseconds
   */
  maxExecutionTimeMs: number

  /**
   * Maximum memory available in megabytes
   */
  maxMemoryMB: number

  /**
   * Maximum number of concurrent requests
   */
  maxConcurrentRequests: number

  /**
   * Storage constraints
   */
  storage: {
    /**
     * Maximum number of key-value reads per day
     */
    maxKVReadsPerDay: number

    /**
     * Maximum number of key-value writes per day
     */
    maxKVWritesPerDay: number

    /**
     * Maximum number of database reads per day
     */
    maxDBReadsPerDay: number

    /**
     * Maximum number of database writes per day
     */
    maxDBWritesPerDay: number

    /**
     * Maximum storage size in MB for key-value store
     */
    maxKVStorageMB: number
  }

  /**
   * Network constraints
   */
  network: {
    /**
     * Maximum number of subrequests (outbound HTTP requests)
     */
    maxSubrequests: number

    /**
     * Maximum request body size in MB
     */
    maxRequestBodyMB: number

    /**
     * Maximum response body size in MB
     */
    maxResponseBodyMB: number
  }

  /**
   * Available features as a set of capability strings
   * Examples: 'ai', 'advanced-caching', 'websockets', 'queues', 'cron'
   */
  features: Set<string>

  /**
   * Performance optimization hints
   */
  optimization: {
    /**
     * Whether to enable request batching
     */
    batchingEnabled: boolean

    /**
     * Maximum batch size
     */
    maxBatchSize: number

    /**
     * Batch interval in milliseconds
     */
    batchIntervalMs: number

    /**
     * Whether to enable aggressive caching
     */
    aggressiveCaching: boolean

    /**
     * Whether to lazy load dependencies
     */
    lazyLoading: boolean

    /**
     * Whether to enable response compression
     */
    compressionEnabled: boolean
  }
}

/**
 * Helper to check if a feature is available given constraints
 */
export function hasFeature(constraints: ResourceConstraints, feature: string): boolean {
  return constraints.features.has(feature)
}

/**
 * Helper to check if AI features are available
 */
export function hasAICapabilities(constraints: ResourceConstraints): boolean {
  return hasFeature(constraints, 'ai') && constraints.maxExecutionTimeMs >= 5000
}

/**
 * Helper to check if advanced caching is available
 */
export function hasAdvancedCaching(constraints: ResourceConstraints): boolean {
  return hasFeature(constraints, 'advanced-caching')
}

/**
 * Helper to determine if we're in a constrained environment
 */
export function isConstrainedEnvironment(constraints: ResourceConstraints): boolean {
  return constraints.maxExecutionTimeMs < 1000 || constraints.maxMemoryMB < 256
}

/**
 * Create unlimited constraints for local development
 */
export function createUnlimitedConstraints(): ResourceConstraints {
  return {
    maxExecutionTimeMs: Number.MAX_SAFE_INTEGER,
    maxMemoryMB: Number.MAX_SAFE_INTEGER,
    maxConcurrentRequests: Number.MAX_SAFE_INTEGER,
    storage: {
      maxKVReadsPerDay: Number.MAX_SAFE_INTEGER,
      maxKVWritesPerDay: Number.MAX_SAFE_INTEGER,
      maxDBReadsPerDay: Number.MAX_SAFE_INTEGER,
      maxDBWritesPerDay: Number.MAX_SAFE_INTEGER,
      maxKVStorageMB: Number.MAX_SAFE_INTEGER
    },
    network: {
      maxSubrequests: Number.MAX_SAFE_INTEGER,
      maxRequestBodyMB: Number.MAX_SAFE_INTEGER,
      maxResponseBodyMB: Number.MAX_SAFE_INTEGER
    },
    features: new Set([
      'ai',
      'advanced-caching',
      'websockets',
      'queues',
      'cron',
      'edge-cache',
      'durable-objects',
      'streaming'
    ]),
    optimization: {
      batchingEnabled: false,
      maxBatchSize: 100,
      batchIntervalMs: 50,
      aggressiveCaching: false,
      lazyLoading: false,
      compressionEnabled: false
    }
  }
}
