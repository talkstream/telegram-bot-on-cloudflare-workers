/**
 * Generic Connection Pool for managing reusable connections
 *
 * Optimizes performance by reusing expensive connections (Telegram bots, AI clients)
 * instead of creating new ones for each request.
 */

import { logger } from '@/lib/logger'

export interface PoolConfig {
  /**
   * Maximum number of connections in the pool
   */
  maxSize: number

  /**
   * Minimum number of connections to maintain
   */
  minSize?: number

  /**
   * Maximum time to wait for a connection (ms)
   */
  acquireTimeout?: number

  /**
   * Time before idle connection is destroyed (ms)
   */
  idleTimeout?: number

  /**
   * Time between connection validation checks (ms)
   */
  validationInterval?: number

  /**
   * Enable connection warming on startup
   */
  warmOnStartup?: boolean
}

export interface PooledConnection<T> {
  /**
   * The actual connection instance
   */
  connection: T

  /**
   * Unique identifier for this connection
   */
  id: string

  /**
   * Whether connection is currently in use
   */
  inUse: boolean

  /**
   * Last time connection was used
   */
  lastUsed: number

  /**
   * Creation timestamp
   */
  createdAt: number

  /**
   * Number of times this connection has been used
   */
  useCount: number
}

export interface ConnectionFactory<T> {
  /**
   * Create a new connection
   */
  create(): Promise<T>

  /**
   * Validate if connection is still healthy
   */
  validate(connection: T): Promise<boolean>

  /**
   * Destroy a connection
   */
  destroy(connection: T): Promise<void>
}

export class ConnectionPool<T> {
  private connections: Map<string, PooledConnection<T>> = new Map()
  private waitQueue: Array<(connection: T) => void> = []
  private config: Required<PoolConfig>
  private validationTimer?: NodeJS.Timeout | number
  private idleCheckTimer?: NodeJS.Timeout | number
  private isShuttingDown = false

  constructor(
    private factory: ConnectionFactory<T>,
    config: PoolConfig
  ) {
    this.config = {
      maxSize: config.maxSize,
      minSize: config.minSize ?? 1,
      acquireTimeout: config.acquireTimeout ?? 10000,
      idleTimeout: config.idleTimeout ?? 60000,
      validationInterval: config.validationInterval ?? 30000,
      warmOnStartup: config.warmOnStartup ?? false
    }

    if (this.config.warmOnStartup) {
      this.warmPool().catch(error => {
        logger.error('Failed to warm connection pool', { error })
      })
    }

    this.startMaintenanceTasks()
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<T> {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down')
    }

    // Try to find an available connection
    const available = this.findAvailableConnection()
    if (available) {
      available.inUse = true
      available.lastUsed = Date.now()
      available.useCount++
      return available.connection
    }

    // Create new connection if pool not at max size
    if (this.connections.size < this.config.maxSize) {
      const connection = await this.createConnection()
      return connection
    }

    // Wait for a connection to become available
    return this.waitForConnection()
  }

  /**
   * Release a connection back to the pool
   */
  release(connection: T): void {
    const pooled = this.findConnectionByInstance(connection)
    if (!pooled) {
      logger.warn('Attempted to release unknown connection')
      return
    }

    pooled.inUse = false
    pooled.lastUsed = Date.now()

    // Process wait queue if any
    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift()
      if (waiter) {
        pooled.inUse = true
        pooled.useCount++
        waiter(connection)
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number
    inUse: number
    available: number
    waitQueueLength: number
    averageUseCount: number
  } {
    let totalUseCount = 0
    let inUse = 0

    for (const pooled of this.connections.values()) {
      totalUseCount += pooled.useCount
      if (pooled.inUse) {
        inUse++
      }
    }

    const total = this.connections.size

    return {
      total,
      inUse,
      available: total - inUse,
      waitQueueLength: this.waitQueue.length,
      averageUseCount: total > 0 ? totalUseCount / total : 0
    }
  }

  /**
   * Shutdown the pool and destroy all connections
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true

    // Clear timers
    if (this.validationTimer) {
      clearInterval(this.validationTimer as NodeJS.Timeout)
    }
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer as NodeJS.Timeout)
    }

    // Reject all waiters
    for (const waiter of this.waitQueue) {
      waiter(null as unknown as T) // Force rejection
    }
    this.waitQueue = []

    // Destroy all connections
    const destroyPromises: Promise<void>[] = []
    for (const pooled of this.connections.values()) {
      destroyPromises.push(this.factory.destroy(pooled.connection))
    }

    await Promise.all(destroyPromises)
    this.connections.clear()

    logger.info('Connection pool shut down', { stats: this.getStats() })
  }

  /**
   * Find an available connection
   */
  private findAvailableConnection(): PooledConnection<T> | null {
    for (const pooled of this.connections.values()) {
      if (!pooled.inUse) {
        return pooled
      }
    }
    return null
  }

  /**
   * Find connection by instance
   */
  private findConnectionByInstance(connection: T): PooledConnection<T> | null {
    for (const pooled of this.connections.values()) {
      if (pooled.connection === connection) {
        return pooled
      }
    }
    return null
  }

  /**
   * Create a new connection
   */
  private async createConnection(): Promise<T> {
    const connection = await this.factory.create()
    const id = crypto.randomUUID()

    const pooled: PooledConnection<T> = {
      connection,
      id,
      inUse: true,
      lastUsed: Date.now(),
      createdAt: Date.now(),
      useCount: 1
    }

    this.connections.set(id, pooled)

    logger.debug('Created new connection', {
      id,
      poolSize: this.connections.size
    })

    return connection
  }

  /**
   * Wait for a connection to become available
   */
  private waitForConnection(): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitQueue.indexOf(resolve)
        if (index !== -1) {
          this.waitQueue.splice(index, 1)
        }
        reject(new Error('Connection acquire timeout'))
      }, this.config.acquireTimeout)

      const wrappedResolve = (connection: T) => {
        clearTimeout(timeout)
        resolve(connection)
      }

      this.waitQueue.push(wrappedResolve)
    })
  }

  /**
   * Warm the pool by creating minimum connections
   */
  private async warmPool(): Promise<void> {
    const promises: Promise<void>[] = []

    for (let i = 0; i < this.config.minSize; i++) {
      promises.push(
        this.factory.create().then(connection => {
          const id = crypto.randomUUID()
          const pooled: PooledConnection<T> = {
            connection,
            id,
            inUse: false,
            lastUsed: Date.now(),
            createdAt: Date.now(),
            useCount: 0
          }
          this.connections.set(id, pooled)
          return
        })
      )
    }

    await Promise.all(promises)

    logger.info('Connection pool warmed', {
      size: this.connections.size
    })
  }

  /**
   * Start maintenance tasks
   */
  private startMaintenanceTasks(): void {
    // Validation task
    this.validationTimer = setInterval(() => {
      this.validateConnections().catch(error => {
        logger.error('Connection validation failed', { error })
      })
    }, this.config.validationInterval)

    // Idle cleanup task
    this.idleCheckTimer = setInterval(() => {
      this.cleanupIdleConnections().catch(error => {
        logger.error('Idle connection cleanup failed', { error })
      })
    }, this.config.idleTimeout / 2)
  }

  /**
   * Validate all connections
   */
  private async validateConnections(): Promise<void> {
    const validationPromises: Promise<void>[] = []

    for (const [id, pooled] of this.connections) {
      if (!pooled.inUse) {
        validationPromises.push(
          this.factory.validate(pooled.connection).then(isValid => {
            if (!isValid) {
              logger.warn('Invalid connection detected, removing', { id })
              this.connections.delete(id)
              return this.factory.destroy(pooled.connection)
            }
            return
          })
        )
      }
    }

    await Promise.all(validationPromises)
  }

  /**
   * Clean up idle connections
   */
  private async cleanupIdleConnections(): Promise<void> {
    const now = Date.now()
    const toDestroy: Array<[string, PooledConnection<T>]> = []

    // Keep at least minSize connections
    let availableCount = 0
    for (const pooled of this.connections.values()) {
      if (!pooled.inUse) {
        availableCount++
      }
    }

    for (const [id, pooled] of this.connections) {
      if (
        !pooled.inUse &&
        availableCount > this.config.minSize &&
        now - pooled.lastUsed > this.config.idleTimeout
      ) {
        toDestroy.push([id, pooled])
        availableCount--
      }
    }

    // Destroy idle connections
    for (const [id, pooled] of toDestroy) {
      this.connections.delete(id)
      await this.factory.destroy(pooled.connection)

      logger.debug('Destroyed idle connection', {
        id,
        idleTime: now - pooled.lastUsed
      })
    }
  }
}
