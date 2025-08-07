/**
 * AI Connector Connection Pool
 *
 * Manages AI client instances for optimal performance and cost
 */

import type { ConnectionFactory } from './connection-pool'
import { ConnectionPool } from './connection-pool'

import type { AIConnector } from '@/core/interfaces/ai'
import { logger } from '@/lib/logger'

export interface AIPoolConfig {
  /**
   * Factory function to create AI connector
   */
  createConnector: () => Promise<AIConnector>

  /**
   * Maximum number of AI connectors
   */
  maxConnectors?: number

  /**
   * Minimum number of AI connectors
   */
  minConnectors?: number

  /**
   * Enable connection warming
   */
  warmOnStartup?: boolean

  /**
   * Provider name for logging
   */
  provider?: string
}

class AIConnectorFactory implements ConnectionFactory<AIConnector> {
  constructor(private config: AIPoolConfig) {}

  async create(): Promise<AIConnector> {
    const connector = await this.config.createConnector()
    logger.debug('Created new AI connector', {
      provider: this.config.provider || 'unknown'
    })
    return connector
  }

  async validate(_connector: AIConnector): Promise<boolean> {
    // Simple validation - check if connector can be used
    // Most connectors don't have explicit validation, so we just return true
    return true
  }

  async destroy(connector: AIConnector): Promise<void> {
    try {
      await connector.destroy()
      logger.debug('Destroyed AI connector', {
        provider: this.config.provider
      })
    } catch (error) {
      logger.warn('Error destroying AI connector', {
        error,
        provider: this.config.provider
      })
    }
  }
}

export class AIConnectionPool {
  private pool: ConnectionPool<AIConnector>
  private static instances = new Map<string, AIConnectionPool>()

  constructor(
    private poolId: string,
    config: AIPoolConfig
  ) {
    const factory = new AIConnectorFactory(config)

    this.pool = new ConnectionPool(factory, {
      maxSize: config.maxConnectors ?? 3,
      minSize: config.minConnectors ?? 1,
      acquireTimeout: 10000,
      idleTimeout: 600000, // 10 minutes
      validationInterval: 120000, // 2 minutes
      warmOnStartup: config.warmOnStartup ?? false
    })
  }

  /**
   * Get or create pool instance for specific provider
   */
  static getInstance(poolId: string, config?: AIPoolConfig): AIConnectionPool {
    let instance = AIConnectionPool.instances.get(poolId)

    if (!instance) {
      if (!config) {
        throw new Error(`AIConnectionPool ${poolId} requires config on first initialization`)
      }
      instance = new AIConnectionPool(poolId, config)
      AIConnectionPool.instances.set(poolId, instance)
    }

    return instance
  }

  /**
   * Reset specific pool instance
   */
  static async reset(poolId: string): Promise<void> {
    const instance = AIConnectionPool.instances.get(poolId)
    if (instance) {
      await instance.shutdown()
      AIConnectionPool.instances.delete(poolId)
    }
  }

  /**
   * Reset all pool instances
   */
  static async resetAll(): Promise<void> {
    const shutdownPromises: Promise<void>[] = []

    for (const instance of AIConnectionPool.instances.values()) {
      shutdownPromises.push(instance.shutdown())
    }

    await Promise.all(shutdownPromises)
    AIConnectionPool.instances.clear()
  }

  /**
   * Acquire an AI connector from the pool
   */
  async acquire(): Promise<AIConnector> {
    return this.pool.acquire()
  }

  /**
   * Release an AI connector back to the pool
   */
  release(connector: AIConnector): void {
    this.pool.release(connector)
  }

  /**
   * Execute a function with a pooled connector
   */
  async withConnector<T>(fn: (connector: AIConnector) => Promise<T>): Promise<T> {
    const connector = await this.acquire()
    try {
      return await fn(connector)
    } finally {
      this.release(connector)
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      poolId: this.poolId,
      ...this.pool.getStats()
    }
  }

  /**
   * Get statistics for all pools
   */
  static getAllStats() {
    const stats: Record<string, ReturnType<AIConnectionPool['getStats']>> = {}

    for (const [poolId, instance] of AIConnectionPool.instances) {
      stats[poolId] = instance.getStats()
    }

    return stats
  }

  /**
   * Shutdown the pool
   */
  async shutdown(): Promise<void> {
    await this.pool.shutdown()
  }
}
