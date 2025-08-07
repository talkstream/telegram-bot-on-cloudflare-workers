/**
 * Tests for Connection Pool
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ConnectionFactory, ConnectionPool } from '../connection-pool'

// Mock connection
class MockConnection {
  constructor(public id: string) {}

  async doWork(): Promise<string> {
    return `Work done by ${this.id}`
  }
}

// Mock factory
class MockConnectionFactory implements ConnectionFactory<MockConnection> {
  private counter = 0
  createCalls = 0
  validateCalls = 0
  destroyCalls = 0

  async create(): Promise<MockConnection> {
    this.createCalls++
    return new MockConnection(`conn-${++this.counter}`)
  }

  async validate(connection: MockConnection): Promise<boolean> {
    this.validateCalls++
    return connection.id.startsWith('conn-')
  }

  async destroy(_connection: MockConnection): Promise<void> {
    this.destroyCalls++
  }
}

describe('ConnectionPool', () => {
  let pool: ConnectionPool<MockConnection>
  let factory: MockConnectionFactory

  beforeEach(() => {
    factory = new MockConnectionFactory()
  })

  afterEach(async () => {
    if (pool) {
      await pool.shutdown()
    }
  })

  describe('basic operations', () => {
    it('should create connections on demand', async () => {
      pool = new ConnectionPool(factory, {
        maxSize: 3,
        warmOnStartup: false
      })

      const conn1 = await pool.acquire()
      expect(conn1).toBeInstanceOf(MockConnection)
      expect(factory.createCalls).toBe(1)

      const conn2 = await pool.acquire()
      expect(conn2).toBeInstanceOf(MockConnection)
      expect(factory.createCalls).toBe(2)

      expect(conn1.id).not.toBe(conn2.id)
    })

    it('should reuse released connections', async () => {
      pool = new ConnectionPool(factory, {
        maxSize: 3,
        warmOnStartup: false
      })

      const conn1 = await pool.acquire()
      pool.release(conn1)

      const conn2 = await pool.acquire()
      expect(conn2).toBe(conn1) // Same instance
      expect(factory.createCalls).toBe(1) // No new creation
    })

    it('should respect max size limit', async () => {
      pool = new ConnectionPool(factory, {
        maxSize: 2,
        acquireTimeout: 100,
        warmOnStartup: false
      })

      const conn1 = await pool.acquire()
      const _conn2 = await pool.acquire()

      // Pool is at max size, should not create more
      expect(factory.createCalls).toBe(2)

      // Release one and try again
      pool.release(conn1)
      const conn3 = await pool.acquire()
      expect(conn3).toBe(conn1)
      expect(factory.createCalls).toBe(2) // Still only 2 created
    })
  })

  describe('connection warming', () => {
    it('should warm pool on startup if configured', async () => {
      pool = new ConnectionPool(factory, {
        maxSize: 5,
        minSize: 3,
        warmOnStartup: true
      })

      // Wait for warming to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(factory.createCalls).toBe(3)

      const stats = pool.getStats()
      expect(stats.total).toBe(3)
      expect(stats.available).toBe(3)
    })
  })

  describe('wait queue', () => {
    it('should queue requests when pool is exhausted', async () => {
      pool = new ConnectionPool(factory, {
        maxSize: 1,
        warmOnStartup: false
      })

      const conn1 = await pool.acquire()

      // Start waiting for connection
      const waitPromise = pool.acquire()

      // Check wait queue
      let stats = pool.getStats()
      expect(stats.waitQueueLength).toBe(1)

      // Release connection
      pool.release(conn1)

      // Wait should complete
      const conn2 = await waitPromise
      expect(conn2).toBe(conn1)

      stats = pool.getStats()
      expect(stats.waitQueueLength).toBe(0)
    })

    it('should handle multiple waiters in order', async () => {
      pool = new ConnectionPool(factory, {
        maxSize: 1,
        warmOnStartup: false
      })

      const conn1 = await pool.acquire()

      // Create multiple waiters
      const waiter1 = pool.acquire()
      const waiter2 = pool.acquire()
      const waiter3 = pool.acquire()

      // Release and re-acquire multiple times
      pool.release(conn1)
      const result1 = await waiter1
      expect(result1).toBe(conn1)

      pool.release(result1)
      const result2 = await waiter2
      expect(result2).toBe(conn1)

      pool.release(result2)
      const result3 = await waiter3
      expect(result3).toBe(conn1)
    })
  })

  describe('validation', () => {
    it('should validate connections periodically', async () => {
      vi.useFakeTimers()

      pool = new ConnectionPool(factory, {
        maxSize: 3,
        minSize: 2,
        warmOnStartup: false, // Don't warm to control timing
        validationInterval: 1000
      })

      // Create and release a connection
      const conn = await pool.acquire()
      pool.release(conn)

      const initialValidateCalls = factory.validateCalls

      // Advance time to trigger validation
      await vi.advanceTimersByTimeAsync(1000)

      // Validation should have been called for idle connections
      expect(factory.validateCalls).toBeGreaterThan(initialValidateCalls)

      vi.useRealTimers()
    })
  })

  describe('idle cleanup', () => {
    it('should clean up idle connections', async () => {
      vi.useFakeTimers()

      pool = new ConnectionPool(factory, {
        maxSize: 5,
        minSize: 1,
        idleTimeout: 1000,
        warmOnStartup: false
      })

      // Create connections
      const conn1 = await pool.acquire()
      const conn2 = await pool.acquire()
      const conn3 = await pool.acquire()

      // Release all
      pool.release(conn1)
      pool.release(conn2)
      pool.release(conn3)

      let stats = pool.getStats()
      expect(stats.total).toBe(3)

      // Advance time past idle timeout
      await vi.advanceTimersByTimeAsync(1500)

      // Should have cleaned up excess connections
      stats = pool.getStats()
      expect(stats.total).toBe(1) // Kept minSize
      expect(factory.destroyCalls).toBe(2)

      vi.useRealTimers()
    })
  })

  describe('statistics', () => {
    it('should track usage statistics', async () => {
      pool = new ConnectionPool(factory, {
        maxSize: 3,
        warmOnStartup: false
      })

      const conn1 = await pool.acquire()
      const _conn2 = await pool.acquire()

      let stats = pool.getStats()
      expect(stats.total).toBe(2)
      expect(stats.inUse).toBe(2)
      expect(stats.available).toBe(0)

      pool.release(conn1)

      stats = pool.getStats()
      expect(stats.inUse).toBe(1)
      expect(stats.available).toBe(1)

      // Reuse connection
      const conn3 = await pool.acquire()
      pool.release(conn3)

      stats = pool.getStats()
      expect(stats.averageUseCount).toBeGreaterThan(1)
    })
  })

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      pool = new ConnectionPool(factory, {
        maxSize: 3,
        minSize: 2,
        warmOnStartup: true
      })

      // Wait for warming
      await new Promise(resolve => setTimeout(resolve, 100))

      const _conn1 = await pool.acquire()

      await pool.shutdown()

      expect(factory.destroyCalls).toBeGreaterThanOrEqual(2)

      // Should not be able to acquire after shutdown
      await expect(pool.acquire()).rejects.toThrow('Connection pool is shutting down')
    })

    it('should clear wait queue on shutdown', async () => {
      pool = new ConnectionPool(factory, {
        maxSize: 1,
        warmOnStartup: false
      })

      const _conn1 = await pool.acquire()

      // Start waiting (don't await yet)
      const waitPromise = pool.acquire()

      // Check that we have a waiter
      let stats = pool.getStats()
      expect(stats.waitQueueLength).toBe(1)

      // Shutdown
      await pool.shutdown()

      // Wait queue should be cleared
      stats = pool.getStats()
      expect(stats.waitQueueLength).toBe(0)

      // The wait promise should resolve with null (forced rejection)
      const result = await waitPromise
      expect(result).toBeNull()
    })
  })

  describe('error handling', () => {
    it('should handle creation errors', async () => {
      const errorFactory = {
        async create(): Promise<MockConnection> {
          throw new Error('Creation failed')
        },
        async validate(): Promise<boolean> {
          return true
        },
        async destroy(): Promise<void> {}
      }

      pool = new ConnectionPool(errorFactory, {
        maxSize: 3,
        warmOnStartup: false
      })

      await expect(pool.acquire()).rejects.toThrow('Creation failed')
    })

    it('should handle validation errors gracefully', async () => {
      const errorFactory = {
        createCalls: 0,
        async create(): Promise<MockConnection> {
          this.createCalls++
          return new MockConnection(`conn-${this.createCalls}`)
        },
        async validate(): Promise<boolean> {
          throw new Error('Validation error')
        },
        async destroy(): Promise<void> {}
      }

      vi.useFakeTimers()

      pool = new ConnectionPool(errorFactory, {
        maxSize: 3,
        validationInterval: 1000,
        warmOnStartup: false
      })

      const conn = await pool.acquire()
      pool.release(conn)

      // Trigger validation
      await vi.advanceTimersByTimeAsync(1000)

      // Pool should still be functional despite validation error
      const conn2 = await pool.acquire()
      expect(conn2).toBeDefined()

      vi.useRealTimers()
    })
  })
})
