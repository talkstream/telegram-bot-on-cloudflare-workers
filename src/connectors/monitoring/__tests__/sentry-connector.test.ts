import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SentryConnector } from '../sentry/sentry-connector'

// Mock Sentry client
const mockClient = {
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  flush: vi.fn(() => Promise.resolve(true))
}

// Mock Sentry module
vi.mock('@sentry/cloudflare', () => ({
  init: vi.fn(),
  getCurrentHub: vi.fn(() => ({
    getClient: vi.fn(() => mockClient)
  }))
}))

describe('SentryConnector', () => {
  let connector: SentryConnector

  beforeEach(async () => {
    vi.clearAllMocks()
    connector = new SentryConnector()
  })

  describe('initialization', () => {
    it('should initialize with valid config', async () => {
      await connector.initialize({
        dsn: 'https://test@sentry.io/123',
        environment: 'test',
        platform: 'cloudflare'
      })

      expect(connector.isAvailable()).toBe(true)
    })

    it('should not initialize without DSN', async () => {
      await connector.initialize({
        environment: 'test'
      })

      expect(connector.isAvailable()).toBe(false)
    })
  })

  describe('captureException', () => {
    beforeEach(async () => {
      await connector.initialize({
        dsn: 'https://test@sentry.io/123',
        environment: 'test',
        platform: 'cloudflare'
      })
    })

    it('should capture exception with context', () => {
      const error = new Error('Test error')
      const context = { userId: '123', action: 'test' }

      connector.captureException(error, context)

      expect(mockClient.captureException).toHaveBeenCalledWith(error, {
        contexts: {
          additional: context
        },
        tags: expect.objectContaining({
          environment: 'test',
          release: 'unknown'
        })
      })
    })

    it('should not capture when not available', async () => {
      const uninitializedConnector = new SentryConnector()
      const error = new Error('Test error')

      uninitializedConnector.captureException(error)

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

    it('should capture message with level', () => {
      connector.captureMessage('Test message', 'error')

      expect(mockClient.captureMessage).toHaveBeenCalledWith('Test message', 'error')
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
      connector.setUserContext('123', { username: 'testuser' })

      expect(mockClient.setUser).toHaveBeenCalledWith({
        id: '123',
        username: 'testuser'
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
      const breadcrumb = {
        message: 'User clicked button',
        category: 'ui',
        level: 'info' as const,
        data: { buttonId: 'submit' }
      }

      connector.addBreadcrumb(breadcrumb)

      expect(mockClient.addBreadcrumb).toHaveBeenCalledWith({
        message: 'User clicked button',
        category: 'ui',
        level: 'info',
        type: undefined,
        data: { buttonId: 'submit' },
        timestamp: undefined
      })
    })
  })

  describe('flush', () => {
    beforeEach(async () => {
      await connector.initialize({
        dsn: 'https://test@sentry.io/123',
        platform: 'cloudflare'
      })
    })

    it('should flush pending events', async () => {
      const result = await connector.flush(3000)

      expect(mockClient.flush).toHaveBeenCalledWith(3000)
      expect(result).toBe(true)
    })

    it('should return true when no client', async () => {
      const uninitializedConnector = new SentryConnector()
      const result = await uninitializedConnector.flush()

      expect(result).toBe(true)
    })
  })
})
