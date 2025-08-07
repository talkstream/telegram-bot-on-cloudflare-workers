import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MonitoringFactory } from '../monitoring-factory'
import { SentryConnector } from '../sentry/sentry-connector'

// Mock Sentry module
vi.mock('@sentry/cloudflare', () => ({
  init: vi.fn(),
  getCurrentHub: vi.fn(() => ({
    getClient: vi.fn(() => ({
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      setUser: vi.fn(),
      addBreadcrumb: vi.fn(),
      flush: vi.fn(() => Promise.resolve(true))
    }))
  }))
}))

describe('MonitoringFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('should create a Sentry connector', async () => {
      const config = {
        dsn: 'https://test@sentry.io/123',
        environment: 'test',
        platform: 'cloudflare' as const
      }

      const connector = await MonitoringFactory.create('sentry', config)

      expect(connector).toBeInstanceOf(SentryConnector)
      expect(connector.isAvailable()).toBe(true)
    })

    it('should throw error for unknown provider', async () => {
      await expect(MonitoringFactory.create('unknown', {})).rejects.toThrow(
        "Monitoring provider 'unknown' is not registered"
      )
    })
  })

  describe('createFromEnv', () => {
    it('should create Sentry connector from SENTRY_DSN', async () => {
      const env = {
        SENTRY_DSN: 'https://test@sentry.io/123',
        ENVIRONMENT: 'production',
        RELEASE: 'v1.0.0',
        SENTRY_SAMPLE_RATE: '0.5'
      }

      const connector = await MonitoringFactory.createFromEnv(env)

      expect(connector).toBeInstanceOf(SentryConnector)
      expect(connector?.isAvailable()).toBe(true)
    })

    it('should return null when no monitoring DSN provided', async () => {
      const env = {
        ENVIRONMENT: 'production'
      }

      const connector = await MonitoringFactory.createFromEnv(env)

      expect(connector).toBeNull()
    })

    it('should filter sensitive headers in beforeSend', async () => {
      const env = {
        SENTRY_DSN: 'https://test@sentry.io/123',
        ENVIRONMENT: 'production'
      }

      await MonitoringFactory.createFromEnv(env)

      // Get the beforeSend function from the config
      const initCall = vi.mocked(await import('@sentry/cloudflare')).init.mock.calls[0]
      const sentryConfig = initCall?.[0]
      const beforeSend = sentryConfig?.beforeSend

      expect(beforeSend).toBeDefined()

      const event = {
        request: {
          headers: {
            authorization: 'Bearer token',
            'x-telegram-bot-api-secret-token': 'secret',
            'content-type': 'application/json'
          }
        }
      }

      const filtered = beforeSend(event)

      expect(filtered.request.headers).not.toHaveProperty('authorization')
      expect(filtered.request.headers).not.toHaveProperty('x-telegram-bot-api-secret-token')
      expect(filtered.request.headers).toHaveProperty('content-type')
    })

    it('should not send events in development without debug', async () => {
      const env = {
        SENTRY_DSN: 'https://test@sentry.io/123',
        ENVIRONMENT: 'development'
      }

      await MonitoringFactory.createFromEnv(env)

      const initCall = vi.mocked(await import('@sentry/cloudflare')).init.mock.calls[0]
      const sentryConfig = initCall?.[0]
      const beforeSend = sentryConfig?.beforeSend

      const event = { message: 'test' }
      const filtered = beforeSend(event)

      expect(filtered).toBeNull()
    })
  })

  describe('platform detection', () => {
    it('should detect Cloudflare Workers', async () => {
      const env = {
        SENTRY_DSN: 'https://test@sentry.io/123',
        CF_WORKER_ENV: 'production'
      }

      await MonitoringFactory.createFromEnv(env)

      const initCall = vi.mocked(await import('@sentry/cloudflare')).init.mock.calls[0]
      const sentryConfig = initCall?.[0]

      // Should use Cloudflare module
      expect(sentryConfig).toBeDefined()
    })
  })
})
