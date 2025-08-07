import type { Context, Next } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockEnv } from '../utils/mock-env'

import { rateLimiter } from '@/middleware/rate-limiter'
import type { Env } from '@/types/env'

describe('Rate Limiter Middleware', () => {
  let mockEnv: Env
  let mockContext: Context<{ Bindings: Env }>
  let mockNext: Next

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv = createMockEnv()
    mockNext = vi.fn().mockResolvedValue(undefined)

    mockContext = {
      env: mockEnv,
      req: {
        header: vi.fn((name: string) => {
          if (name === 'cf-connecting-ip') return '192.168.1.1'
          return null
        })
      },
      res: {
        status: 200
      },
      text: vi.fn(),
      header: vi.fn()
    } as unknown as Context<{ Bindings: Env }>
  })

  it('should allow requests under the limit', async () => {
    const middleware = rateLimiter({ maxRequests: 5, windowMs: 60000 })

    // Make 5 requests
    for (let i = 0; i < 5; i++) {
      await middleware(mockContext, mockNext)
    }

    expect(mockNext).toHaveBeenCalledTimes(5)
    expect(mockContext.text).not.toHaveBeenCalled()
  })

  it('should block requests over the limit', async () => {
    const middleware = rateLimiter({ maxRequests: 2, windowMs: 60000 })

    // Make 3 requests
    for (let i = 0; i < 3; i++) {
      await middleware(mockContext, mockNext)
    }

    expect(mockNext).toHaveBeenCalledTimes(2)
    expect(mockContext.text).toHaveBeenCalledWith(
      'Too many requests, please try again later.',
      429,
      expect.objectContaining({
        'Retry-After': expect.any(String),
        'X-RateLimit-Limit': '2',
        'X-RateLimit-Remaining': '0'
      })
    )
  })

  it('should use custom key generator', async () => {
    const keyGenerator = vi.fn(() => 'custom-key')
    const middleware = rateLimiter({
      maxRequests: 1,
      windowMs: 60000,
      keyGenerator
    })

    await middleware(mockContext, mockNext)
    await middleware(mockContext, mockNext)

    expect(keyGenerator).toHaveBeenCalledTimes(2)
    expect(mockContext.text).toHaveBeenCalledWith(expect.any(String), 429, expect.any(Object))
  })

  it('should skip successful requests when configured', async () => {
    const middleware = rateLimiter({
      maxRequests: 1,
      windowMs: 60000,
      skipSuccessfulRequests: true
    })

    mockContext.res.status = 200

    // Make multiple successful requests
    await middleware(mockContext, mockNext)
    await middleware(mockContext, mockNext)
    await middleware(mockContext, mockNext)

    expect(mockNext).toHaveBeenCalledTimes(3)
    expect(mockContext.text).not.toHaveBeenCalled()
  })

  it('should skip failed requests when configured', async () => {
    const middleware = rateLimiter({
      maxRequests: 1,
      windowMs: 60000,
      skipFailedRequests: true
    })

    mockContext.res.status = 500

    // Make multiple failed requests
    await middleware(mockContext, mockNext)
    await middleware(mockContext, mockNext)
    await middleware(mockContext, mockNext)

    expect(mockNext).toHaveBeenCalledTimes(3)
    expect(mockContext.text).not.toHaveBeenCalled()
  })

  it('should add rate limit headers', async () => {
    const middleware = rateLimiter({ maxRequests: 10, windowMs: 60000 })

    await middleware(mockContext, mockNext)

    expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Limit', '10')
    expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '9')
    expect(mockContext.header).toHaveBeenCalledWith(
      'X-RateLimit-Reset',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    )
  })

  it('should handle KV storage errors gracefully', async () => {
    mockEnv.RATE_LIMIT.get.mockRejectedValue(new Error('KV error'))

    const middleware = rateLimiter({ maxRequests: 5, windowMs: 60000 })

    await middleware(mockContext, mockNext)

    // Should allow request on error
    expect(mockNext).toHaveBeenCalled()
    expect(mockContext.text).not.toHaveBeenCalled()
  })

  it('should reset window after expiration', async () => {
    const middleware = rateLimiter({ maxRequests: 1, windowMs: 100 }) // 100ms window

    // First request
    await middleware(mockContext, mockNext)
    expect(mockNext).toHaveBeenCalledTimes(1)

    // Second request (should be blocked)
    await middleware(mockContext, mockNext)
    expect(mockContext.text).toHaveBeenCalled()

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150))

    // Reset mocks
    mockContext.text.mockClear()
    mockNext.mockClear()

    // Third request (should be allowed)
    await middleware(mockContext, mockNext)
    expect(mockNext).toHaveBeenCalled()
    expect(mockContext.text).not.toHaveBeenCalled()
  })
})
