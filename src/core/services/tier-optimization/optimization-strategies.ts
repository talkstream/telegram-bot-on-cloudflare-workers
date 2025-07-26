/**
 * Built-in optimization strategies
 */

import type { IOptimizationStrategy } from '../../interfaces/tier-optimization';

/**
 * Cache optimization strategy
 */
export const cacheOptimizationStrategy: IOptimizationStrategy = {
  name: 'cache-optimization',
  description: 'Aggressive caching for free tier',
  priority: 10,

  shouldApply: (context) => {
    return context.tier === 'free' && context.config.cache.enabled;
  },

  apply: (context) => {
    // For free tier, use more aggressive caching
    if (context.tier === 'free') {
      context.config.cache.ttl = 600; // 10 minutes
      context.config.cache.swr = 7200; // 2 hours
    }
  },
};

/**
 * Request batching strategy
 */
export const batchingStrategy: IOptimizationStrategy = {
  name: 'request-batching',
  description: 'Batch multiple operations to reduce overhead',
  priority: 9,

  shouldApply: (context) => {
    const usage = context.usage;
    const limits = context.limits;

    // Apply if approaching subrequest limits
    return usage.subrequests > limits.subrequests * 0.5;
  },

  apply: (context) => {
    context.config.batching.enabled = true;

    // Adjust batch size based on tier
    if (context.tier === 'free') {
      context.config.batching.size = 5;
      context.config.batching.timeout = 50;
    } else {
      context.config.batching.size = 20;
      context.config.batching.timeout = 100;
    }
  },
};

/**
 * Query simplification strategy
 */
export const querySimplificationStrategy: IOptimizationStrategy = {
  name: 'query-simplification',
  description: 'Simplify complex queries for free tier',
  priority: 8,

  shouldApply: (context) => {
    return context.tier === 'free' && context.config.queries.maxComplexity > 50;
  },

  apply: (context) => {
    if (context.tier === 'free') {
      context.config.queries.maxComplexity = 50;
      context.config.queries.cache = true;
      context.config.queries.batch = true;
    }
  },
};

/**
 * Response compression strategy
 */
export const compressionStrategy: IOptimizationStrategy = {
  name: 'response-compression',
  description: 'Enable compression to reduce bandwidth',
  priority: 7,

  shouldApply: (context) => {
    return context.config.compression.enabled && context.request !== undefined;
  },

  apply: (context) => {
    // Lower compression threshold for free tier
    if (context.tier === 'free') {
      context.config.compression.threshold = 512; // 512 bytes
    }
  },
};

/**
 * Early termination strategy
 */
export const earlyTerminationStrategy: IOptimizationStrategy = {
  name: 'early-termination',
  description: 'Terminate processing early when approaching limits',
  priority: 15,

  shouldApply: (context) => {
    const cpuUsage = context.usage.cpuTime / context.limits.cpuTime;
    return cpuUsage > 0.8; // 80% of CPU limit
  },

  apply: async (context) => {
    // Defer non-critical operations
    if (context.request?.method === 'GET') {
      // For GET requests, return cached data if available
      if (context.utils) {
        context.utils.defer(() => {
          console.info('Deferred background processing due to CPU limits');
        });
      }
    }
  },
};

/**
 * Memory optimization strategy
 */
export const memoryOptimizationStrategy: IOptimizationStrategy = {
  name: 'memory-optimization',
  description: 'Optimize memory usage',
  priority: 8,

  shouldApply: (context) => {
    const memoryUsage = context.usage.memory / context.limits.memory;
    return memoryUsage > 0.7; // 70% of memory limit
  },

  apply: (context) => {
    // Enable aggressive garbage collection hints
    if (global.gc) {
      global.gc();
    }

    // Reduce batch sizes to lower memory usage
    if (context.config.batching.size > 5) {
      context.config.batching.size = 5;
    }
  },
};

/**
 * KV operation optimization
 */
export const kvOptimizationStrategy: IOptimizationStrategy = {
  name: 'kv-optimization',
  description: 'Optimize KV operations',
  priority: 9,

  shouldApply: (context) => {
    const kvReads = context.usage.kvOperations.read;
    const kvLimit = context.limits.kvOperations.read;
    return kvReads > kvLimit * 0.6; // 60% of KV read limit
  },

  apply: async (context) => {
    // Enable local caching for KV operations
    context.config.cache.enabled = true;

    // Batch KV operations when possible
    context.config.batching.enabled = true;

    // Warning about high KV usage
    console.warn(
      `High KV usage: ${context.usage.kvOperations.read}/${context.limits.kvOperations.read} reads`,
    );
  },
};

/**
 * Adaptive timeout strategy
 */
export const adaptiveTimeoutStrategy: IOptimizationStrategy = {
  name: 'adaptive-timeout',
  description: 'Adjust timeouts based on remaining CPU time',
  priority: 6,

  shouldApply: (context) => {
    return context.tier === 'free';
  },

  apply: (context) => {
    if (!context.utils) {
      return;
    }

    const remaining = context.utils.getRemainingResources();

    // Set aggressive timeouts for free tier
    if (remaining.cpuTime < 3) {
      // Less than 3ms remaining
      console.warn('Very low CPU time remaining, using minimal timeouts');
    }
  },
};

/**
 * Graceful degradation strategy
 */
export const gracefulDegradationStrategy: IOptimizationStrategy = {
  name: 'graceful-degradation',
  description: 'Reduce functionality when approaching limits',
  priority: 5,

  shouldApply: (context) => {
    const usage = context.usage;
    const limits = context.limits;

    // Apply when any resource is above 90%
    return (
      usage.cpuTime > limits.cpuTime * 0.9 ||
      usage.memory > limits.memory * 0.9 ||
      usage.subrequests > limits.subrequests * 0.9
    );
  },

  apply: (context) => {
    // Disable non-essential features
    if (context.config.aggressive) {
      console.warn('Entering graceful degradation mode');

      // Return simplified responses
      if (context.utils) {
        context.utils.defer(() => {
          console.info('Non-essential operations deferred');
        });
      }
    }
  },
};

/**
 * Subrequest pooling strategy
 */
export const subrequestPoolingStrategy: IOptimizationStrategy = {
  name: 'subrequest-pooling',
  description: 'Pool and reuse subrequest connections',
  priority: 7,

  shouldApply: (context) => {
    return context.usage.subrequests > 10;
  },

  apply: (context) => {
    // Enable connection pooling for subrequests
    context.config.batching.enabled = true;

    // Log optimization
    if (context.tier === 'free') {
      console.info('Subrequest pooling enabled to conserve resources');
    }
  },
};

/**
 * Default optimization strategies
 */
export const defaultStrategies: IOptimizationStrategy[] = [
  earlyTerminationStrategy,
  cacheOptimizationStrategy,
  batchingStrategy,
  kvOptimizationStrategy,
  querySimplificationStrategy,
  memoryOptimizationStrategy,
  compressionStrategy,
  subrequestPoolingStrategy,
  adaptiveTimeoutStrategy,
  gracefulDegradationStrategy,
];
