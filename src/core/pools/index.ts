/**
 * Connection Pool exports and utilities
 */

export { ConnectionPool } from './connection-pool'
export type { ConnectionFactory, PoolConfig, PooledConnection } from './connection-pool'

import { AIConnectionPool } from './ai-pool'
import { TelegramConnectionPool } from './telegram-pool'

export { TelegramConnectionPool } from './telegram-pool'
export type { TelegramPoolConfig } from './telegram-pool'

export { AIConnectionPool } from './ai-pool'
export type { AIPoolConfig } from './ai-pool'

// Global pool manager for monitoring and management
export class PoolManager {
  private static isShuttingDown = false

  /**
   * Shutdown all pools gracefully
   */
  static async shutdownAll(): Promise<void> {
    if (PoolManager.isShuttingDown) {
      return
    }

    PoolManager.isShuttingDown = true

    const shutdownPromises: Promise<void>[] = []

    // Shutdown Telegram pool
    shutdownPromises.push(TelegramConnectionPool.reset())

    // Shutdown all AI pools
    shutdownPromises.push(AIConnectionPool.resetAll())

    await Promise.all(shutdownPromises)

    PoolManager.isShuttingDown = false
  }

  /**
   * Get statistics for all pools
   */
  static getAllStats() {
    return {
      telegram: TelegramConnectionPool.getInstance().getStats(),
      ai: AIConnectionPool.getAllStats()
    }
  }
}
