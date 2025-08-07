/**
 * Tests for Sentry monitoring connector
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SentryConnector } from '../sentry-connector'

import type { MonitoringConfig } from '@/core/interfaces/monitoring'

// Create mock client factory to get fresh mocks for each test
const createMockClient = () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  flush: vi.fn(() => Promise.resolve(true))
})

let mockClient = createMockClient()

// Mock Sentry SDK
vi.mock('@sentry/cloudflare', () => ({
  init: vi.fn(),
  getCurrentHub: vi.fn(() => ({
    getClient: vi.fn(() => mockClient)
  }))
}))

// Mock other Sentry SDKs to prevent import errors
vi.mock('@sentry/aws-serverless', () => ({
  init: vi.fn(),
  getCurrentHub: vi.fn(() => ({
    getClient: vi.fn(() => mockClient)
  }))
}))

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  getCurrentHub: vi.fn(() => ({
    getClient: vi.fn(() => mockClient)
  }))
}))

vi.mock('@sentry/browser', () => ({
  init: vi.fn(),
  getCurrentHub: vi.fn(() => ({
    getClient: vi.fn(() => mockClient)
  }))
}))

describe('SentryConnector', () => {
  let connector: SentryConnector

  beforeEach(() => {
    vi.clearAllMocks()
    mockClient = createMockClient() // Reset mock client for each test
    connector = new SentryConnector()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with DSN', async () => {
      const config: MonitoringConfig = {
        dsn: 'https://test@sentry.io/123',
        environment: 'test',
        release: '1.0.0',
        platform: 'cloudflare'
      }

      await connector.initialize(config)
      expect(connector.isAvailable()).toBe(true)
    })

    it('should not initialize without DSN', async () => {
      const config: MonitoringConfig = {
        environment: 'test'
      }

      await connector.initialize(config)
      expect(connector.isAvailable()).toBe(false)
    })

    it('should handle initialization errors gracefully', async () => {
      const config: MonitoringConfig = {
        dsn: 'https://test@sentry.io/123',
        platform: 'cloudflare'
      }

      // Create a new connector with no client
      const sentryModule = await import('@sentry/cloudflare')
      const originalGetCurrentHub = sentryModule.getCurrentHub
      ;(sentryModule as { getCurrentHub: unknown }).getCurrentHub = vi.fn(() => ({
        getClient: vi.fn(() => undefined) // No client available
      }))

      const errorConnector = new SentryConnector()
      await errorConnector.initialize(config)
      // Should not throw, still available due to DSN
      expect(errorConnector.isAvailable()).toBe(true)

      // Restore original mock
      ;(sentryModule as { getCurrentHub: unknown }).getCurrentHub = originalGetCurrentHub
    })
  })

  describe('captureException', () => {
    beforeEach(async () => {
      await connector.initialize({
        dsn: 'https://test@sentry.io/123',
        platform: 'cloudflare'
      })
    })

    it('should capture exceptions with context', () => {
      const error = new Error('Test error')
      const context = { userId: '123', operation: 'test' }

      connector.captureException(error, context)

      expect(mockClient.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          contexts: {
            additional: context
          }
        })
      )
    })

    it('should not capture when not available', async () => {
      const unavailableConnector = new SentryConnector()
      await unavailableConnector.initialize({}) // No DSN

      const error = new Error('Test error')
      unavailableConnector.captureException(error)

      expect(mockClient.captureException).not.toHaveBeenCalled()
    })
  })

  describe('captureMessage', () => {
    beforeEach(async () => {
      await connector.initialize({
        dsn: 'https://test@sentry.io/123',
        platform: 'cloudflare'
      })
    })

    it('should capture messages with level', () => {
      connector.captureMessage('Test message', 'warning')

      expect(mockClient.captureMessage).toHaveBeenCalledWith('Test message', 'warning')
    })

    it('should default to info level', () => {
      connector.captureMessage('Test message')

      expect(mockClient.captureMessage).toHaveBeenCalledWith('Test message', 'info')
    })
  })

  describe('user context', () => {
    beforeEach(async () => {
      await connector.initialize({
        dsn: 'https://test@sentry.io/123',
        platform: 'cloudflare'
      })
    })

    it('should set user context', () => {
      connector.setUserContext('user123', {
        username: 'testuser',
        email: 'test@example.com'
      })

      expect(mockClient.setUser).toHaveBeenCalledWith({
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com'
      })
    })

    it('should clear user context', () => {
      connector.clearUserContext()

      expect(mockClient.setUser).toHaveBeenCalledWith(null)
    })
  })

  describe('breadcrumbs', () => {
    beforeEach(async () => {
      await connector.initialize({
        dsn: 'https://test@sentry.io/123',
        platform: 'cloudflare'
      })
    })

    it('should add breadcrumb', () => {
      connector.addBreadcrumb({
        message: 'User clicked button',
        category: 'ui',
        level: 'info',
        data: { buttonId: 'submit' }
      })

      expect(mockClient.addBreadcrumb).toHaveBeenCalledWith({
        message: 'User clicked button',
        category: 'ui',
        level: 'info',
        type: undefined,
        data: { buttonId: 'submit' },
        timestamp: undefined
      })
    })

    it('should convert timestamp to seconds', () => {
      const timestamp = Date.now()

      connector.addBreadcrumb({
        message: 'Test',
        timestamp
      })

      expect(mockClient.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: timestamp / 1000
        })
      )
    })
  })

  describe('custom events and metrics', () => {
    beforeEach(async () => {
      await connector.initialize({
        dsn: 'https://test@sentry.io/123',
        platform: 'cloudflare'
      })
    })

    it('should track custom events', () => {
      connector.trackEvent('button_clicked', {
        buttonId: 'submit',
        userId: '123'
      })

      // Should add as breadcrumb
      expect(mockClient.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'button_clicked',
          category: 'custom',
          level: 'info'
        })
      )
    })

    it('should track metrics', () => {
      connector.trackMetric('api_latency', 250, {
        endpoint: '/api/users',
        method: 'GET'
      })

      // Should add as breadcrumb
      expect(mockClient.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Metric: api_latency',
          category: 'metric',
          data: {
            value: 250,
            endpoint: '/api/users',
            method: 'GET'
          }
        })
      )
    })
  })

  describe('flush', () => {
    beforeEach(async () => {
      await connector.initialize({
        dsn: 'https://test@sentry.io/123',
        platform: 'cloudflare'
      })
    })

    it('should flush events', async () => {
      const result = await connector.flush(5000)

      expect(mockClient.flush).toHaveBeenCalledWith(5000)
      expect(result).toBe(true)
    })

    it('should handle flush errors', async () => {
      mockClient.flush.mockRejectedValueOnce(new Error('Flush failed'))

      const result = await connector.flush()

      expect(result).toBe(false)

      // Reset mock for next test
      mockClient.flush.mockResolvedValue(true)
    })

    it('should return true when no client', async () => {
      const unavailableConnector = new SentryConnector()
      await unavailableConnector.initialize({})

      const result = await unavailableConnector.flush()
      expect(result).toBe(true)
    })
  })

  describe('platform-specific initialization', () => {
    it('should initialize for AWS platform', async () => {
      const config: MonitoringConfig = {
        dsn: 'https://test@sentry.io/123',
        platform: 'aws'
      }

      // AWS SDK is not available, should fallback to cloudflare
      const awsConnector = new SentryConnector()
      await awsConnector.initialize(config)
      expect(awsConnector.isAvailable()).toBe(true)
    })

    it('should initialize for Node platform', async () => {
      const config: MonitoringConfig = {
        dsn: 'https://test@sentry.io/123',
        platform: 'node'
      }

      // Node SDK is not available, should fallback to cloudflare
      const nodeConnector = new SentryConnector()
      await nodeConnector.initialize(config)
      expect(nodeConnector.isAvailable()).toBe(true)
    })

    it('should initialize for browser platform', async () => {
      const config: MonitoringConfig = {
        dsn: 'https://test@sentry.io/123',
        platform: 'browser'
      }

      // Browser SDK is not available, should fallback to cloudflare
      const browserConnector = new SentryConnector()
      await browserConnector.initialize(config)
      expect(browserConnector.isAvailable()).toBe(true)
    })
  })

  describe('beforeSend hook', () => {
    it('should wrap beforeSend function', async () => {
      const beforeSend = vi.fn(event => event)
      const sentryModule = await import('@sentry/cloudflare')

      const beforeSendConnector = new SentryConnector()
      await beforeSendConnector.initialize({
        dsn: 'https://test@sentry.io/123',
        platform: 'cloudflare',
        beforeSend
      })

      // Initialization should have been called with wrapped beforeSend
      expect(sentryModule.init).toHaveBeenCalledWith(
        expect.objectContaining({
          beforeSend: expect.any(Function)
        })
      )
    })
  })
})
