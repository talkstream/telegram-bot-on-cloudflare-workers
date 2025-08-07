import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { IEventBus } from '../../core/interfaces/event-bus'
import type { ILogger } from '../../core/interfaces/logger'
import type { INotificationAdapter } from '../../core/interfaces/notification'
import { NotificationStatus } from '../../core/interfaces/notification'
import type { IKeyValueStore } from '../../core/interfaces/storage'
import { NotificationConnector } from '../notification-connector'

describe('NotificationConnector', () => {
  let connector: NotificationConnector
  let mockAdapter: INotificationAdapter
  let mockLogger: ILogger
  let mockEventBus: IEventBus
  let mockStorage: IKeyValueStore

  beforeEach(() => {
    vi.clearAllMocks()

    mockAdapter = {
      formatMessage: vi.fn().mockResolvedValue({ text: 'formatted message' }),
      deliver: vi.fn().mockResolvedValue(undefined),
      checkReachability: vi.fn().mockResolvedValue(true),
      isRetryableError: vi.fn().mockReturnValue(true),
      getUserInfo: vi.fn().mockResolvedValue({ locale: 'en' })
    }

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnThis()
    }

    mockEventBus = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn()
    }

    mockStorage = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ keys: [] })
    }

    connector = new NotificationConnector({
      adapter: mockAdapter,
      storage: mockStorage,
      logger: mockLogger,
      eventBus: mockEventBus
    })
  })

  describe('send', () => {
    it('should send notification successfully', async () => {
      const message = {
        id: 'msg_123',
        recipientId: 'user_123',
        template: 'welcome',
        category: 'system' as const,
        priority: 'medium' as const,
        params: { name: 'John' }
      }

      const result = await connector.send(message)

      expect(result.status).toBe(NotificationStatus.SENT)
      expect(result.messageId).toBe('msg_123')
      expect(result.deliveredAt).toBeDefined()
      expect(mockAdapter.deliver).toHaveBeenCalledWith('user_123', { text: 'formatted message' })
      expect(mockEventBus.emit).toHaveBeenCalledWith('notification:sent', expect.any(Object))
    })

    it('should handle unreachable recipient', async () => {
      vi.mocked(mockAdapter.checkReachability).mockResolvedValueOnce(false)

      const message = {
        id: 'msg_123',
        recipientId: 'user_123',
        template: 'welcome',
        category: 'system' as const,
        priority: 'medium' as const
      }

      const result = await connector.send(message)

      expect(result.status).toBe(NotificationStatus.BLOCKED)
      expect(result.error).toBe('Recipient is not reachable')
      expect(mockAdapter.deliver).not.toHaveBeenCalled()
      expect(mockEventBus.emit).toHaveBeenCalledWith('notification:blocked', expect.any(Object))
    })

    it('should retry on retryable error', async () => {
      const error = new Error('Temporary error')
      vi.mocked(mockAdapter.deliver).mockRejectedValueOnce(error)
      vi.mocked(mockAdapter.isRetryableError).mockReturnValueOnce(true)

      const message = {
        id: 'msg_123',
        recipientId: 'user_123',
        template: 'welcome',
        category: 'system' as const,
        priority: 'medium' as const
      }

      const result = await connector.send(message)

      expect(result.status).toBe(NotificationStatus.RETRY)
      expect(result.retryCount).toBe(1)
      expect(result.nextRetryAt).toBeDefined()
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'notification:failed',
        expect.objectContaining({
          willRetry: true
        })
      )
    })

    it('should fail after max retries', async () => {
      const error = new Error('Persistent error')
      vi.mocked(mockAdapter.deliver).mockRejectedValue(error)
      vi.mocked(mockAdapter.isRetryableError).mockReturnValue(false)

      const message = {
        id: 'msg_123',
        recipientId: 'user_123',
        template: 'welcome',
        category: 'system' as const,
        priority: 'medium' as const,
        metadata: { retryCount: 3 }
      }

      const result = await connector.send(message)

      expect(result.status).toBe(NotificationStatus.FAILED)
      expect(result.error).toBe('Persistent error')
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'notification:failed',
        expect.objectContaining({
          willRetry: false
        })
      )
    })
  })

  describe('sendBatch', () => {
    it('should send notifications in batches', async () => {
      const messages = Array.from({ length: 25 }, (_, i) => ({
        id: `msg_${i}`,
        recipientId: `user_${i}`,
        template: 'announcement',
        category: 'system' as const,
        priority: 'low' as const
      }))

      const results = await connector.sendBatch(messages, {
        batchSize: 10,
        delayBetweenBatches: 100
      })

      expect(results).toHaveLength(25)
      expect(results.every(r => r.status === NotificationStatus.SENT)).toBe(true)
      expect(mockAdapter.deliver).toHaveBeenCalledTimes(25)
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'notification:batch:started',
        expect.any(Object)
      )
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'notification:batch:completed',
        expect.any(Object)
      )
    })

    it('should handle failures in batch gracefully', async () => {
      vi.mocked(mockAdapter.deliver)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(undefined)

      const messages = [
        {
          id: 'msg_1',
          recipientId: 'user_1',
          template: 'test',
          category: 'system' as const,
          priority: 'low' as const
        },
        {
          id: 'msg_2',
          recipientId: 'user_2',
          template: 'test',
          category: 'system' as const,
          priority: 'low' as const
        },
        {
          id: 'msg_3',
          recipientId: 'user_3',
          template: 'test',
          category: 'system' as const,
          priority: 'low' as const
        }
      ]

      const results = await connector.sendBatch(messages, {
        batchSize: 10,
        delayBetweenBatches: 0
      })

      expect(results).toHaveLength(3)
      expect(results[0].status).toBe(NotificationStatus.SENT)
      expect(results[1].status).toBe(NotificationStatus.RETRY)
      expect(results[2].status).toBe(NotificationStatus.SENT)
    })
  })

  describe('isReachable', () => {
    it('should return adapter reachability check result', async () => {
      const result = await connector.isReachable('user_123')
      expect(result).toBe(true)
      expect(mockAdapter.checkReachability).toHaveBeenCalledWith('user_123')
    })

    it('should handle adapter errors gracefully', async () => {
      vi.mocked(mockAdapter.checkReachability).mockRejectedValueOnce(new Error('Check failed'))

      const result = await connector.isReachable('user_123')
      expect(result).toBe(false)
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('getStatus', () => {
    it('should retrieve stored notification status', async () => {
      const storedResult = {
        messageId: 'msg_123',
        status: NotificationStatus.SENT,
        deliveredAt: new Date().toISOString()
      }
      vi.mocked(mockStorage.get).mockResolvedValueOnce(JSON.stringify(storedResult))

      const result = await connector.getStatus('msg_123')
      expect(result).toEqual(storedResult)
    })

    it('should return null when status not found', async () => {
      const result = await connector.getStatus('msg_123')
      expect(result).toBeNull()
    })

    it('should return null when storage not available', async () => {
      const connectorWithoutStorage = new NotificationConnector({
        adapter: mockAdapter,
        logger: mockLogger,
        eventBus: mockEventBus
      })

      const result = await connectorWithoutStorage.getStatus('msg_123')
      expect(result).toBeNull()
    })
  })
})
