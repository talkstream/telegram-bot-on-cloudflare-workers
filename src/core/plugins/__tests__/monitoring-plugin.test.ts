/**
 * Tests for Monitoring Plugin
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MonitoringPlugin, createMonitoringPlugin } from '../monitoring-plugin'

import { EventBus } from '@/core/events/event-bus'
import { AIEventType } from '@/core/events/types/ai'
import { CommonEventType } from '@/core/events/types/common'
import { PaymentEventType } from '@/core/events/types/payment'
import { UserEventType } from '@/core/events/types/user'
import type { IMonitoringConnector } from '@/core/interfaces/monitoring'

// Mock monitoring connector
const createMockMonitoring = (): IMonitoringConnector => ({
  initialize: vi.fn(async () => {}),
  isAvailable: vi.fn(() => true),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUserContext: vi.fn(),
  clearUserContext: vi.fn(),
  addBreadcrumb: vi.fn(),
  trackEvent: vi.fn(),
  trackMetric: vi.fn(),
  flush: vi.fn(async () => true)
})

describe('MonitoringPlugin', () => {
  let plugin: MonitoringPlugin
  let eventBus: EventBus
  let monitoring: IMonitoringConnector

  beforeEach(() => {
    eventBus = new EventBus({ async: false })
    monitoring = createMockMonitoring()
    plugin = new MonitoringPlugin({
      monitoring,
      eventBus
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('plugin lifecycle', () => {
    it('should have correct metadata', () => {
      expect(plugin.id).toBe('monitoring-plugin')
      expect(plugin.name).toBe('Monitoring Plugin')
      expect(plugin.version).toBe('1.0.0')
      expect(plugin.enabled).toBe(true)
    })

    it('should install successfully', async () => {
      await plugin.install({})
      expect(plugin.enabled).toBe(true)
    })

    it('should activate and deactivate', async () => {
      await plugin.deactivate()
      expect(plugin.enabled).toBe(false)

      await plugin.activate()
      expect(plugin.enabled).toBe(true)
    })

    it('should uninstall and clear data', async () => {
      await plugin.install({})

      // Track some requests
      eventBus.emit(
        CommonEventType.REQUEST_STARTED,
        {
          requestId: 'test-1'
        },
        'test'
      )

      const stats = plugin.getPerformanceStats()
      expect(stats.activeRequests).toBe(1)

      await plugin.uninstall()
      const clearedStats = plugin.getPerformanceStats()
      expect(clearedStats.activeRequests).toBe(0)
    })
  })

  describe('performance tracking', () => {
    beforeEach(async () => {
      await plugin.install({})
    })

    it('should track request start and completion', () => {
      const requestId = 'test-request-1'

      // Start request
      eventBus.emit(
        CommonEventType.REQUEST_STARTED,
        {
          requestId,
          method: 'GET',
          path: '/api/test'
        },
        'test'
      )

      expect(monitoring.trackEvent).toHaveBeenCalledWith('request_started', {
        requestId,
        timestamp: expect.any(Number)
      })

      // Complete request
      eventBus.emit(
        CommonEventType.REQUEST_COMPLETED,
        {
          requestId,
          method: 'GET',
          path: '/api/test',
          status: 200,
          duration: 150
        },
        'test'
      )

      expect(monitoring.trackMetric).toHaveBeenCalledWith('request_duration', expect.any(Number), {
        requestId
      })

      expect(monitoring.trackEvent).toHaveBeenCalledWith('request_completed', {
        requestId,
        duration: expect.any(Number),
        timestamp: expect.any(Number)
      })
    })

    it('should track AI completion metrics', () => {
      eventBus.emit(
        AIEventType.COMPLETION_SUCCESS,
        {
          requestId: 'ai-1',
          provider: 'openai',
          model: 'gpt-4',
          latency: 500,
          tokens: 150
        },
        'test'
      )

      expect(monitoring.trackMetric).toHaveBeenCalledWith('ai_completion_latency', 500, {
        provider: 'openai',
        model: 'gpt-4'
      })

      expect(monitoring.trackMetric).toHaveBeenCalledWith('ai_tokens_used', 150, {
        provider: 'openai',
        model: 'gpt-4'
      })
    })

    it('should track payment processing time', () => {
      eventBus.emit(
        PaymentEventType.PAYMENT_COMPLETED,
        {
          processingTime: 2500,
          type: 'credit_card',
          amount: 99.99
        },
        'test'
      )

      expect(monitoring.trackMetric).toHaveBeenCalledWith('payment_processing_time', 2500, {
        paymentType: 'credit_card',
        amount: '99.99'
      })
    })

    it('should handle missing optional fields', () => {
      eventBus.emit(
        AIEventType.COMPLETION_SUCCESS,
        {
          latency: 300
        },
        'test'
      )

      expect(monitoring.trackMetric).toHaveBeenCalledWith('ai_completion_latency', 300, {
        provider: 'unknown',
        model: 'unknown'
      })
    })
  })

  describe('error tracking', () => {
    beforeEach(async () => {
      await plugin.install({})
    })

    it('should capture general errors', () => {
      const error = new Error('Test error')

      eventBus.emit(
        CommonEventType.ERROR_OCCURRED,
        {
          requestId: 'req-1',
          error,
          context: {
            userId: '123'
          }
        },
        'test'
      )

      expect(monitoring.captureException).toHaveBeenCalledWith(error, {
        context: { userId: '123' },
        timestamp: expect.any(Number)
      })
    })

    it('should capture AI failures', () => {
      const error = new Error('AI service unavailable')

      eventBus.emit(
        AIEventType.COMPLETION_FAILED,
        {
          requestId: 'ai-req-1',
          provider: 'openai',
          model: 'gpt-4',
          error
        },
        'test'
      )

      expect(monitoring.captureException).toHaveBeenCalledWith(error, {
        provider: 'openai',
        model: 'gpt-4',
        timestamp: expect.any(Number)
      })
    })

    it('should capture payment failures', () => {
      const error = new Error('Payment declined')

      eventBus.emit(
        PaymentEventType.PAYMENT_FAILED,
        {
          type: 'credit_card',
          amount: 50.0,
          error
        },
        'test'
      )

      expect(monitoring.captureException).toHaveBeenCalledWith(error, {
        paymentType: 'credit_card',
        amount: 50.0,
        timestamp: expect.any(Number)
      })
    })

    it('should capture plugin errors', () => {
      const error = new Error('Plugin initialization failed')

      eventBus.emit(
        CommonEventType.PLUGIN_ERROR,
        {
          pluginId: 'test-plugin',
          error
        },
        'test'
      )

      expect(monitoring.captureException).toHaveBeenCalledWith(error, {
        pluginId: 'test-plugin',
        timestamp: expect.any(Number)
      })
    })

    it('should handle non-Error objects', () => {
      eventBus.emit(
        CommonEventType.ERROR_OCCURRED,
        {
          error: 'String error',
          context: {}
        },
        'test'
      )

      expect(monitoring.captureException).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'String error'
        }),
        expect.any(Object)
      )
    })
  })

  describe('custom event tracking', () => {
    beforeEach(async () => {
      await plugin.install({})
    })

    it('should track user registration', () => {
      eventBus.emit(
        UserEventType.USER_REGISTERED,
        {
          userId: 'user-123'
        },
        'test'
      )

      expect(monitoring.trackEvent).toHaveBeenCalledWith('user_registered', {
        userId: 'user-123',
        timestamp: expect.any(Number)
      })
    })

    it('should track user login and set context', () => {
      eventBus.emit(
        UserEventType.USER_LOGGED_IN,
        {
          userId: 'user-456',
          username: 'testuser',
          email: 'test@example.com'
        },
        'test'
      )

      expect(monitoring.trackEvent).toHaveBeenCalledWith('user_logged_in', {
        userId: 'user-456',
        timestamp: expect.any(Number)
      })

      expect(monitoring.setUserContext).toHaveBeenCalledWith('user-456', {
        username: 'testuser',
        email: 'test@example.com'
      })
    })

    it('should track plugin lifecycle events', () => {
      eventBus.emit(
        CommonEventType.PLUGIN_LOADED,
        {
          pluginId: 'test-plugin',
          version: '1.0.0'
        },
        'test'
      )

      expect(monitoring.trackEvent).toHaveBeenCalledWith('plugin_loaded', {
        pluginId: 'test-plugin',
        version: '1.0.0',
        timestamp: expect.any(Number)
      })
    })

    it('should track session creation', () => {
      eventBus.emit(
        CommonEventType.SESSION_CREATED,
        {
          sessionId: 'session-789',
          userId: 'user-123'
        },
        'test'
      )

      expect(monitoring.trackEvent).toHaveBeenCalledWith('session_created', {
        sessionId: 'session-789',
        userId: 'user-123',
        timestamp: expect.any(Number)
      })
    })

    it('should track cache performance', () => {
      eventBus.emit(
        CommonEventType.CACHE_HIT,
        {
          key: 'user:123'
        },
        'test'
      )

      expect(monitoring.trackMetric).toHaveBeenCalledWith('cache_hit', 1, { key: 'user:123' })

      eventBus.emit(
        CommonEventType.CACHE_MISS,
        {
          key: 'user:456'
        },
        'test'
      )

      expect(monitoring.trackMetric).toHaveBeenCalledWith('cache_miss', 1, { key: 'user:456' })
    })
  })

  describe('configuration options', () => {
    it('should respect trackPerformance setting', async () => {
      const customPlugin = new MonitoringPlugin({
        monitoring,
        eventBus,
        trackPerformance: false
      })

      await customPlugin.install({})

      eventBus.emit(
        CommonEventType.REQUEST_STARTED,
        {
          requestId: 'test-1'
        },
        'test'
      )

      expect(monitoring.trackEvent).not.toHaveBeenCalled()
    })

    it('should respect trackErrors setting', async () => {
      const customPlugin = new MonitoringPlugin({
        monitoring,
        eventBus,
        trackErrors: false
      })

      await customPlugin.install({})

      eventBus.emit(
        CommonEventType.ERROR_OCCURRED,
        {
          error: new Error('Test')
        },
        'test'
      )

      expect(monitoring.captureException).not.toHaveBeenCalled()
    })

    it('should respect trackCustomEvents setting', async () => {
      const customPlugin = new MonitoringPlugin({
        monitoring,
        eventBus,
        trackCustomEvents: false
      })

      await customPlugin.install({})

      eventBus.emit(
        UserEventType.USER_REGISTERED,
        {
          userId: 'test-user'
        },
        'test'
      )

      expect(monitoring.trackEvent).not.toHaveBeenCalled()
    })

    it('should exclude specific events', async () => {
      const customPlugin = new MonitoringPlugin({
        monitoring,
        eventBus,
        excludeEvents: [UserEventType.USER_REGISTERED]
      })

      await customPlugin.install({})

      eventBus.emit(
        UserEventType.USER_REGISTERED,
        {
          userId: 'test-user'
        },
        'test'
      )

      expect(monitoring.trackEvent).not.toHaveBeenCalled()

      eventBus.emit(
        UserEventType.USER_LOGGED_IN,
        {
          userId: 'test-user'
        },
        'test'
      )

      expect(monitoring.trackEvent).toHaveBeenCalled()
    })
  })

  describe('factory function', () => {
    it('should create and auto-install plugin', () => {
      const factoryPlugin = createMonitoringPlugin(monitoring, eventBus)

      expect(factoryPlugin).toBeInstanceOf(MonitoringPlugin)
      expect(factoryPlugin.enabled).toBe(true)
    })

    it('should handle installation errors', () => {
      const errorMonitoring = createMockMonitoring()
      errorMonitoring.initialize = vi.fn(() => {
        throw new Error('Init failed')
      })

      // Should not throw
      expect(() => {
        createMonitoringPlugin(errorMonitoring, eventBus)
      }).not.toThrow()
    })
  })

  describe('performance statistics', () => {
    beforeEach(async () => {
      await plugin.install({})
    })

    it('should track active requests', () => {
      eventBus.emit(
        CommonEventType.REQUEST_STARTED,
        {
          requestId: 'req-1'
        },
        'test'
      )

      eventBus.emit(
        CommonEventType.REQUEST_STARTED,
        {
          requestId: 'req-2'
        },
        'test'
      )

      const stats = plugin.getPerformanceStats()
      expect(stats.activeRequests).toBe(2)

      eventBus.emit(
        CommonEventType.REQUEST_COMPLETED,
        {
          requestId: 'req-1',
          duration: 100
        },
        'test'
      )

      const updatedStats = plugin.getPerformanceStats()
      expect(updatedStats.activeRequests).toBe(1)
    })

    it('should clear performance data', () => {
      eventBus.emit(
        CommonEventType.REQUEST_STARTED,
        {
          requestId: 'req-1'
        },
        'test'
      )

      plugin.clearPerformanceData()

      const stats = plugin.getPerformanceStats()
      expect(stats.activeRequests).toBe(0)
    })
  })
})
