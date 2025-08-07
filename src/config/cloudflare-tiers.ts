/**
 * Cloudflare-specific Tier Configuration
 *
 * This module defines configurations specific to Cloudflare Workers' free and paid tiers.
 * It maps Cloudflare's tier model to the platform-agnostic ResourceConstraints.
 *
 * NOTE: This is Cloudflare-specific and should not be imported by platform-independent code.
 * Use ICloudPlatformConnector.getResourceConstraints() instead.
 */

export interface TierConfig {
  name: 'free' | 'paid'
  limits: {
    cpuTimeMs: number
    requestsPerDay: number
    requestsPerMinute: number
    kvReadsPerDay: number
    kvWritesPerDay: number
    subrequests: number
    workerSizeMB: number
    memoryMB: number
  }
  features: {
    aiEnabled: boolean
    advancedCachingEnabled: boolean
    databaseEnabled: boolean
    sentryEnabled: boolean
    rateLimitingEnabled: boolean
    sessionPersistence: boolean
    requestBatching: boolean
    healthChecks: boolean
  }
  performance: {
    requestTimeoutMs: number
    databaseTimeoutMs: number
    cacheTimeoutMs: number
    aiTimeoutMs: number
    batchIntervalMs: number
    maxBatchSize: number
    maxRetries: number
    cacheTTL: {
      user: number
      session: number
      rateLimit: number
    }
  }
  optimization: {
    lazyLoadDependencies: boolean
    minifyResponses: boolean
    compressionEnabled: boolean
    inMemoryCacheSize: number
    parallelHealthChecks: boolean
  }
}

export const TIER_CONFIGS: Record<'free' | 'paid', TierConfig> = {
  free: {
    name: 'free',
    limits: {
      cpuTimeMs: 10,
      requestsPerDay: 100_000,
      requestsPerMinute: 1_000,
      kvReadsPerDay: 100_000,
      kvWritesPerDay: 1_000,
      subrequests: 50,
      workerSizeMB: 3,
      memoryMB: 128
    },
    features: {
      aiEnabled: false, // Disable AI for free tier to save CPU time
      advancedCachingEnabled: false,
      databaseEnabled: false, // D1 queries are expensive
      sentryEnabled: false, // Reduce overhead
      rateLimitingEnabled: true, // Essential for free tier
      sessionPersistence: true,
      requestBatching: true,
      healthChecks: true
    },
    performance: {
      requestTimeoutMs: 2_000,
      databaseTimeoutMs: 1_000,
      cacheTimeoutMs: 500,
      aiTimeoutMs: 0, // AI disabled
      batchIntervalMs: 5,
      maxBatchSize: 10,
      maxRetries: 1,
      cacheTTL: {
        user: 300, // 5 minutes
        session: 600, // 10 minutes
        rateLimit: 60 // 1 minute
      }
    },
    optimization: {
      lazyLoadDependencies: true,
      minifyResponses: true,
      compressionEnabled: true,
      inMemoryCacheSize: 50, // Small in-memory cache
      parallelHealthChecks: false // Sequential to save CPU
    }
  },
  paid: {
    name: 'paid',
    limits: {
      cpuTimeMs: 30_000, // 30 seconds default
      requestsPerDay: Infinity,
      requestsPerMinute: Infinity,
      kvReadsPerDay: 10_000_000,
      kvWritesPerDay: 1_000_000,
      subrequests: 1_000,
      workerSizeMB: 10,
      memoryMB: 128
    },
    features: {
      aiEnabled: true,
      advancedCachingEnabled: true,
      databaseEnabled: true,
      sentryEnabled: true,
      rateLimitingEnabled: true,
      sessionPersistence: true,
      requestBatching: true,
      healthChecks: true
    },
    performance: {
      requestTimeoutMs: 10_000,
      databaseTimeoutMs: 5_000,
      cacheTimeoutMs: 2_000,
      aiTimeoutMs: 15_000,
      batchIntervalMs: 25,
      maxBatchSize: 30,
      maxRetries: 3,
      cacheTTL: {
        user: 3_600, // 1 hour
        session: 86_400, // 24 hours
        rateLimit: 60 // 1 minute
      }
    },
    optimization: {
      lazyLoadDependencies: false,
      minifyResponses: false,
      compressionEnabled: true,
      inMemoryCacheSize: 1_000, // Larger in-memory cache
      parallelHealthChecks: true
    }
  }
}

/**
 * Get tier configuration based on environment
 */
export function getTierConfig(tier?: 'free' | 'paid'): TierConfig {
  return TIER_CONFIGS[tier || 'free']
}

/**
 * Check if a feature is enabled for the current tier
 */
export function isFeatureEnabled(
  feature: keyof TierConfig['features'],
  tier?: 'free' | 'paid'
): boolean {
  const config = getTierConfig(tier)
  return config.features[feature]
}

/**
 * Get performance setting for the current tier
 */
export function getPerformanceSetting<K extends keyof TierConfig['performance']>(
  setting: K,
  tier?: 'free' | 'paid'
): TierConfig['performance'][K] {
  const config = getTierConfig(tier)
  return config.performance[setting]
}

/**
 * Create a feature flag wrapper that disables features for free tier
 */
export function createFeatureFlag<T>(
  featureName: keyof TierConfig['features'],
  tier?: 'free' | 'paid'
) {
  return (fn: () => T, fallback?: T): T | undefined => {
    if (isFeatureEnabled(featureName, tier)) {
      return fn()
    }
    return fallback
  }
}

/**
 * Tier-aware logger that reduces logging on free tier
 */
export function tierAwareLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  data?: unknown,
  tier?: 'free' | 'paid'
): void {
  const config = getTierConfig(tier)

  // On free tier, only log warnings and errors
  if (config.name === 'free' && level === 'info') {
    return
  }

  // Import logger dynamically to avoid circular dependencies
  import('../lib/logger')
    .then(({ logger }) => {
      logger[level](message, data)
      return null
    })
    .catch(error => {
      console.error('Failed to load logger:', error)
    })
}

/**
 * Middleware to enforce tier limits
 */
export function enforceTierLimits(tier?: 'free' | 'paid') {
  const config = getTierConfig(tier)

  return {
    checkSubrequestLimit: (count: number): boolean => {
      return count < config.limits.subrequests
    },

    checkMemoryUsage: (): boolean => {
      // This is a placeholder - actual memory checking would be more complex
      return true
    },

    shouldCache: (operation: string): boolean => {
      // More aggressive caching for free tier
      return config.name === 'free' || operation.includes('expensive')
    }
  }
}

/**
 * Convert Cloudflare tier to platform-agnostic ResourceConstraints
 */
export function tierToResourceConstraints(
  tier: 'free' | 'paid'
): import('../core/interfaces/resource-constraints').ResourceConstraints {
  const config = getTierConfig(tier)

  const features = new Set<string>()

  // Map features based on tier config
  if (config.features.aiEnabled) features.add('ai')
  if (config.features.advancedCachingEnabled) features.add('advanced-caching')
  if (config.features.healthChecks) features.add('health-checks')
  if (config.features.requestBatching) features.add('request-batching')
  if (config.features.databaseEnabled) features.add('database')
  if (config.features.sessionPersistence) features.add('sessions')
  if (config.features.sentryEnabled) features.add('monitoring')

  // Cloudflare specific features
  features.add('edge-cache')
  features.add('cron')
  if (tier === 'paid') {
    features.add('queues')
    features.add('durable-objects')
  }

  return {
    maxExecutionTimeMs: config.limits.cpuTimeMs,
    maxMemoryMB: config.limits.memoryMB,
    maxConcurrentRequests: config.limits.requestsPerMinute,
    storage: {
      maxKVReadsPerDay: config.limits.kvReadsPerDay,
      maxKVWritesPerDay: config.limits.kvWritesPerDay,
      maxDBReadsPerDay: config.features.databaseEnabled ? 5_000_000 : 0, // D1 limits
      maxDBWritesPerDay: config.features.databaseEnabled ? 100_000 : 0,
      maxKVStorageMB: tier === 'paid' ? 1024 : 100 // 1GB paid, 100MB free
    },
    network: {
      maxSubrequests: config.limits.subrequests,
      maxRequestBodyMB: 100, // Cloudflare limit
      maxResponseBodyMB: 100 // Cloudflare limit
    },
    features,
    optimization: {
      batchingEnabled: config.features.requestBatching,
      maxBatchSize: config.performance.maxBatchSize,
      batchIntervalMs: config.performance.batchIntervalMs,
      aggressiveCaching: config.optimization.inMemoryCacheSize > 100,
      lazyLoading: config.optimization.lazyLoadDependencies,
      compressionEnabled: config.optimization.compressionEnabled
    }
  }
}
