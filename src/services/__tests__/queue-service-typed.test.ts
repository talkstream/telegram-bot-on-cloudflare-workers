/**
 * Tests for Typed Queue Service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMemoryQueueAdapter } from '../queue-adapters/typed-memory-adapter'
import type { MessageTypeRegistry } from '../queue-service-typed'
import { TypedQueueService, createTypedQueueService } from '../queue-service-typed'

// Define test message types
interface TestMessageRegistry extends MessageTypeRegistry {
  'user.created': {
    userId: string
    email: string
    timestamp: Date
  }
  'order.placed': {
    orderId: string
    userId: string
    items: Array<{ id: string; quantity: number }>
    total: number
  }
  'email.send': {
    to: string
    subject: string
    body: string
    attachments?: string[]
  }
}

describe('TypedQueueService', () => {
  let service: TypedQueueService<TestMessageRegistry>
  let adapter: ReturnType<typeof createMemoryQueueAdapter>

  beforeEach(() => {
    adapter = createMemoryQueueAdapter()
    service = createTypedQueueService<TestMessageRegistry>({
      adapter,
      enableDLQ: true,
      defaultRetryLimit: 2,
      defaultRetryDelay: 0 // Immediate retry for tests
    })
  })

  describe('Type Safety', () => {
    it('should enforce correct message types when sending', async () => {
      // This should compile
      await service.send('user.created', {
        userId: '123',
        email: 'test@example.com',
        timestamp: new Date()
      })

      // Note: TypeScript catches type errors at compile time
      // Runtime validation would need to be added separately
      // This test verifies the type system works correctly
    })

    it('should provide typed data in handlers', async () => {
      const handler = vi.fn()

      service.registerHandler('order.placed', {
        handler: async (data, _context) => {
          // TypeScript knows the exact shape of data here
          expect(data.orderId).toBeDefined()
          expect(data.items).toBeInstanceOf(Array)
          expect(typeof data.total).toBe('number')
          handler(data)
        }
      })

      await service.send('order.placed', {
        orderId: 'ORD-123',
        userId: 'USER-456',
        items: [{ id: 'ITEM-1', quantity: 2 }],
        total: 99.99
      })

      await service.processMessages()
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'ORD-123',
          total: 99.99
        })
      )
    })
  })

  describe('Message Processing', () => {
    it('should process messages with correct handlers', async () => {
      const userHandler = vi.fn()
      const orderHandler = vi.fn()

      service.registerHandler('user.created', {
        handler: userHandler
      })

      service.registerHandler('order.placed', {
        handler: orderHandler
      })

      // Send mixed messages
      await service.send('user.created', {
        userId: '1',
        email: 'user1@test.com',
        timestamp: new Date()
      })

      await service.send('order.placed', {
        orderId: 'ORD-1',
        userId: '1',
        items: [],
        total: 0
      })

      const result = await service.processMessages()

      expect(result.processed).toBe(2)
      expect(result.failed).toBe(0)
      expect(userHandler).toHaveBeenCalledOnce()
      expect(orderHandler).toHaveBeenCalledOnce()
    })

    it('should handle batch sending', async () => {
      const handler = vi.fn()

      service.registerHandler('email.send', {
        handler
      })

      await service.sendBatch([
        {
          type: 'email.send',
          data: {
            to: 'user1@test.com',
            subject: 'Test 1',
            body: 'Body 1'
          }
        },
        {
          type: 'email.send',
          data: {
            to: 'user2@test.com',
            subject: 'Test 2',
            body: 'Body 2'
          }
        }
      ])

      const result = await service.processMessages()

      expect(result.processed).toBe(2)
      expect(handler).toHaveBeenCalledTimes(2)
    })
  })

  describe('Error Handling and Retries', () => {
    it('should retry failed messages', async () => {
      let attempts = 0

      service.registerHandler('user.created', {
        handler: async () => {
          attempts++
          if (attempts < 2) {
            throw new Error('Temporary failure')
          }
        },
        retryable: true,
        maxRetries: 2
      })

      await service.send('user.created', {
        userId: '1',
        email: 'test@test.com',
        timestamp: new Date()
      })

      // First attempt - fails
      const result1 = await service.processMessages()
      expect(result1.retried).toBe(1)
      expect(result1.processed).toBe(0)

      // Message should be immediately available for retry (delay=0)
      // Second attempt - succeeds
      const result2 = await service.processMessages()
      expect(result2.processed).toBe(1)
      expect(attempts).toBe(2)
    })

    it('should move to DLQ after max retries', async () => {
      service.registerHandler('order.placed', {
        handler: async () => {
          throw new Error('Permanent failure')
        },
        maxRetries: 1
      })

      await service.send('order.placed', {
        orderId: 'ORD-FAIL',
        userId: '1',
        items: [],
        total: 0
      })

      // First attempt - fails, retries
      const result1 = await service.processMessages()
      expect(result1.retried).toBe(1)

      // Second attempt - fails, moves to DLQ (immediate retry with delay=0)
      const result2 = await service.processMessages()
      expect(result2.movedToDLQ).toBe(1)

      // Check DLQ stats
      const dlqStats = await service.getDLQStats()
      expect(dlqStats?.messageCount).toBe(1)
      expect(dlqStats?.messagesByType['order.placed']).toBe(1)
    })

    it('should call error handler on failure', async () => {
      const errorHandler = vi.fn()

      service.registerHandler('email.send', {
        handler: async () => {
          throw new Error('SMTP error')
        },
        onError: errorHandler,
        retryable: false
      })

      await service.send('email.send', {
        to: 'test@test.com',
        subject: 'Test',
        body: 'Body'
      })

      await service.processMessages()

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'SMTP error' }),
        expect.objectContaining({ to: 'test@test.com' }),
        expect.any(Object)
      )
    })
  })

  describe('DLQ Processing', () => {
    it('should reprocess messages from DLQ', async () => {
      let processCount = 0

      service.registerHandler('user.created', {
        handler: async () => {
          processCount++
          if (processCount === 1) {
            throw new Error('First attempt fails')
          }
        },
        maxRetries: 0 // Immediate DLQ
      })

      await service.send('user.created', {
        userId: '1',
        email: 'test@test.com',
        timestamp: new Date()
      })

      // Process - fails and moves to DLQ
      const result1 = await service.processMessages()
      expect(result1.movedToDLQ).toBe(1)

      // Process DLQ - succeeds
      const dlqResult = await service.processDLQ()
      expect(dlqResult.processed).toBe(1)
      expect(processCount).toBe(2)
    })

    it('should track DLQ statistics', async () => {
      // Send messages that will fail
      service.registerHandler('order.placed', {
        handler: async () => {
          throw new Error('Always fails')
        },
        maxRetries: 0
      })

      // Send multiple messages
      for (let i = 0; i < 3; i++) {
        await service.send('order.placed', {
          orderId: `ORD-${i}`,
          userId: '1',
          items: [],
          total: 0
        })
      }

      await service.processMessages(10)

      const stats = await service.getDLQStats()
      expect(stats?.messageCount).toBe(3)
      expect(stats?.messagesByType['order.placed']).toBe(3)
      expect(stats?.oldestMessage).toBeDefined()
      expect(stats?.newestMessage).toBeDefined()
    })
  })

  describe('Statistics and Monitoring', () => {
    it('should track processing statistics', async () => {
      service.registerHandler('user.created', {
        handler: async () => {
          // Success
        }
      })

      service.registerHandler('order.placed', {
        handler: async () => {
          throw new Error('Fail')
        },
        maxRetries: 0
      })

      // Send successful message
      await service.send('user.created', {
        userId: '1',
        email: 'test@test.com',
        timestamp: new Date()
      })

      // Send failing message
      await service.send('order.placed', {
        orderId: 'ORD-1',
        userId: '1',
        items: [],
        total: 0
      })

      await service.processMessages()

      const stats = service.getStats()
      expect(stats.totalProcessed).toBe(1)
      expect(stats.totalMovedToDLQ).toBe(1)
      expect(stats.totalFailed).toBe(0) // Moved to DLQ, not failed
    })
  })

  describe('Handler Management', () => {
    it('should prevent duplicate handler registration', () => {
      service.registerHandler('user.created', {
        handler: async () => {}
      })

      expect(() => {
        service.registerHandler('user.created', {
          handler: async () => {}
        })
      }).toThrow('Handler for type "user.created" already registered')
    })

    it('should clear all handlers', () => {
      service.registerHandler('user.created', {
        handler: async () => {}
      })

      service.clearHandlers()

      // Should not throw on re-registration
      expect(() => {
        service.registerHandler('user.created', {
          handler: async () => {}
        })
      }).not.toThrow()
    })

    it('should handle messages without registered handlers', async () => {
      await service.send('user.created', {
        userId: '1',
        email: 'test@test.com',
        timestamp: new Date()
      })

      // Should not throw, just acknowledge
      const result = await service.processMessages()
      expect(result.processed).toBe(0)
      expect(result.failed).toBe(0)
    })
  })

  describe('Memory Adapter Features', () => {
    it('should respect queue size limits', async () => {
      const limitedAdapter = createMemoryQueueAdapter({
        maxQueueSize: 2
      })

      const limitedService = createTypedQueueService<TestMessageRegistry>({
        adapter: limitedAdapter
      })

      await limitedService.send('user.created', {
        userId: '1',
        email: 'test1@test.com',
        timestamp: new Date()
      })

      await limitedService.send('user.created', {
        userId: '2',
        email: 'test2@test.com',
        timestamp: new Date()
      })

      // Third message should fail
      await expect(
        limitedService.send('user.created', {
          userId: '3',
          email: 'test3@test.com',
          timestamp: new Date()
        })
      ).rejects.toThrow('Queue size limit reached')
    })

    it('should simulate latency', async () => {
      const slowAdapter = createMemoryQueueAdapter({
        simulateLatency: 50
      })

      const slowService = createTypedQueueService<TestMessageRegistry>({
        adapter: slowAdapter
      })

      const start = Date.now()

      await slowService.send('user.created', {
        userId: '1',
        email: 'test@test.com',
        timestamp: new Date()
      })

      const duration = Date.now() - start
      expect(duration).toBeGreaterThanOrEqual(50)
    })

    it('should simulate failures', async () => {
      const failingAdapter = createMemoryQueueAdapter({
        failureRate: 1 // Always fail
      })

      const failingService = createTypedQueueService<TestMessageRegistry>({
        adapter: failingAdapter
      })

      await expect(
        failingService.send('user.created', {
          userId: '1',
          email: 'test@test.com',
          timestamp: new Date()
        })
      ).rejects.toThrow('Simulated send failure')
    })

    it('should allow peeking at messages', () => {
      const messages = adapter.peekMessages()
      expect(messages).toBeInstanceOf(Array)

      const dlqMessages = adapter.peekDLQ()
      expect(dlqMessages).toBeInstanceOf(Array)
    })

    it('should provide detailed statistics', () => {
      const stats = adapter.getStats()
      expect(stats).toHaveProperty('queueSize')
      expect(stats).toHaveProperty('dlqSize')
      expect(stats).toHaveProperty('visibleMessages')
      expect(stats).toHaveProperty('invisibleMessages')
      expect(stats).toHaveProperty('processing')
    })
  })
})
