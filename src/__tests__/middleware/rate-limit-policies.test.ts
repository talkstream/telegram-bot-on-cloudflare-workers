import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Env } from '@/config/env'
import { EventBus } from '@/core/events/event-bus'
import { createRateLimitPolicies, getEnvironmentRateLimits } from '@/middleware/rate-limit-policies'

describe('Rate Limit Policies', () => {
  let app: Hono<{ Bindings: Env }>
  let eventBus: EventBus

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>()
    eventBus = new EventBus()
    vi.clearAllMocks()
  })

  describe('createRateLimitPolicies', () => {
    it('should create all policy types', () => {
      const policies = createRateLimitPolicies({ eventBus })

      expect(policies).toHaveProperty('global')
      expect(policies).toHaveProperty('strict')
      expect(policies).toHaveProperty('api')
      expect(policies).toHaveProperty('health')
      expect(policies).toHaveProperty('static')
      expect(policies).toHaveProperty('auth')
      expect(policies).toHaveProperty('burst')
    })

    it('should create policies without EventBus', () => {
      const policies = createRateLimitPolicies()

      expect(policies.global).toBeDefined()
      expect(policies.strict).toBeDefined()
    })

    it('should return middleware functions', () => {
      const policies = createRateLimitPolicies({ eventBus })

      // Each policy should be a function (middleware)
      expect(typeof policies.global).toBe('function')
      expect(typeof policies.strict).toBe('function')
      expect(typeof policies.api).toBe('function')
    })
  })

  describe('getEnvironmentRateLimits', () => {
    it('should return development limits', () => {
      const limits = getEnvironmentRateLimits('development')

      expect(limits.globalMax).toBe(1000)
      expect(limits.apiMax).toBe(500)
      expect(limits.strictMax).toBe(100)
    })

    it('should return production limits', () => {
      const limits = getEnvironmentRateLimits('production')

      expect(limits.globalMax).toBe(100)
      expect(limits.apiMax).toBe(60)
      expect(limits.strictMax).toBe(20)
    })

    it('should return default limits for unknown environment', () => {
      const limits = getEnvironmentRateLimits('staging')

      expect(limits.globalMax).toBe(200)
      expect(limits.apiMax).toBe(100)
      expect(limits.strictMax).toBe(40)
    })

    it('should return default limits when no environment specified', () => {
      const limits = getEnvironmentRateLimits()

      expect(limits.globalMax).toBe(200)
      expect(limits.apiMax).toBe(100)
      expect(limits.strictMax).toBe(40)
    })
  })

  describe('Rate Limit Policies Integration', () => {
    it('should apply global policy to endpoint', async () => {
      const policies = createRateLimitPolicies({ eventBus })

      app.get('/test', policies.global, c => c.text('OK'))

      const mockEnv: Env = {
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_WEBHOOK_SECRET: 'test-secret',
        RATE_LIMIT: {
          get: vi.fn().mockResolvedValue(null),
          put: vi.fn(),
          delete: vi.fn(),
          list: vi.fn(),
          getWithMetadata: vi.fn()
        } as unknown as KVNamespace
      } as Env

      const res = await app.request(
        '/test',
        {
          method: 'GET'
        },
        mockEnv
      )

      expect(res.status).toBe(200)
      expect(await res.text()).toBe('OK')
    })

    it('should enforce rate limits when exceeded', async () => {
      const policies = createRateLimitPolicies({ eventBus })

      app.get('/test', policies.strict, c => c.text('OK'))

      const mockEnv: Env = {
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_WEBHOOK_SECRET: 'test-secret',
        RATE_LIMIT: {
          get: vi.fn().mockResolvedValue({
            count: 25, // Exceeds strict limit of 20
            resetAt: Date.now() + 60000
          }),
          put: vi.fn(),
          delete: vi.fn(),
          list: vi.fn(),
          getWithMetadata: vi.fn()
        } as unknown as KVNamespace
      } as Env

      const res = await app.request(
        '/test',
        {
          method: 'GET'
        },
        mockEnv
      )

      expect(res.status).toBe(429)
      expect(await res.text()).toContain('Rate limit exceeded')
    })

    it('should emit events when rate limit is exceeded', async () => {
      const eventSpy = vi.fn()
      eventBus.on('rate-limit.exceeded', eventSpy)

      const policies = createRateLimitPolicies({ eventBus })

      app.get('/test', policies.strict, c => c.text('OK'))

      const mockEnv: Env = {
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_WEBHOOK_SECRET: 'test-secret',
        RATE_LIMIT: {
          get: vi.fn().mockResolvedValue({
            count: 25, // Exceeds strict limit
            resetAt: Date.now() + 60000
          }),
          put: vi.fn(),
          delete: vi.fn(),
          list: vi.fn(),
          getWithMetadata: vi.fn()
        } as unknown as KVNamespace
      } as Env

      await app.request(
        '/test',
        {
          method: 'GET'
        },
        mockEnv
      )

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            count: 25,
            maxRequests: 20,
            path: '/test',
            method: 'GET'
          })
        })
      )
    })

    it('should handle burst limiting', async () => {
      const policies = createRateLimitPolicies({ eventBus })

      app.get('/test', policies.burst, c => c.text('OK'))

      const mockEnv: Env = {
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_WEBHOOK_SECRET: 'test-secret',
        RATE_LIMIT: {
          get: vi.fn().mockResolvedValue({
            count: 15, // Exceeds burst limit of 10 per second
            resetAt: Date.now() + 1000
          }),
          put: vi.fn(),
          delete: vi.fn(),
          list: vi.fn(),
          getWithMetadata: vi.fn()
        } as unknown as KVNamespace
      } as Env

      const res = await app.request(
        '/test',
        {
          method: 'GET'
        },
        mockEnv
      )

      expect(res.status).toBe(429)
      expect(await res.text()).toContain('Burst limit exceeded')
    })
  })

  describe('Rate Limit Groups', () => {
    it('should define correct groups', async () => {
      const { rateLimitGroups } = await import('@/middleware/rate-limit-policies')

      expect(rateLimitGroups.public).toEqual(['global', 'burst'])
      expect(rateLimitGroups.protected).toEqual(['global', 'api', 'burst'])
      expect(rateLimitGroups.admin).toEqual(['global', 'strict', 'auth', 'burst'])
      expect(rateLimitGroups.webhook).toEqual(['strict', 'burst'])
      expect(rateLimitGroups.monitoring).toEqual(['health'])
    })
  })
})
