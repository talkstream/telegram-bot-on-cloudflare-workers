import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AnalyticsFactory,
  AsyncAnalytics,
  CloudflareAnalytics,
  createAnalyticsMiddleware
} from '../async-analytics'

describe('AsyncAnalytics', () => {
  let analytics: AsyncAnalytics
  let mockCtx: { waitUntil: ReturnType<typeof vi.fn> }
  let waitUntilCalls: Promise<unknown>[] = []
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    waitUntilCalls = []
    mockCtx = {
      waitUntil: vi.fn((promise: Promise<unknown>) => {
        waitUntilCalls.push(promise)
      }),
      passThroughOnException: vi.fn()
    }
    
    // Save original fetch
    originalFetch = global.fetch
    
    // Mock fetch globally to prevent real network requests
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ success: true })
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    // Restore original fetch
    global.fetch = originalFetch
  })

  describe('basic tracking', () => {
    beforeEach(() => {
      analytics = new AsyncAnalytics(mockCtx, {
        endpoint: 'https://analytics.test/events',
        apiKey: 'test-key',
        batching: false // Disable batching for immediate tracking tests
      })
    })

    it('should track events without blocking', () => {
      analytics.track('test_event', { foo: 'bar' })

      // waitUntil should be called immediately
      expect(mockCtx.waitUntil).toHaveBeenCalledTimes(1)
      expect(waitUntilCalls).toHaveLength(1)
    })

    it('should track user events', () => {
      analytics.trackUser('user123', 'login', { method: 'oauth' })

      expect(mockCtx.waitUntil).toHaveBeenCalledTimes(1)
    })

    it('should track page views', () => {
      analytics.trackPageView('/home', { referrer: '/login' })

      expect(mockCtx.waitUntil).toHaveBeenCalledTimes(1)
    })

    it('should track errors', () => {
      const error = new Error('Test error')
      analytics.trackError(error, { context: 'test' })

      expect(mockCtx.waitUntil).toHaveBeenCalledTimes(1)
    })

    it('should track performance metrics', () => {
      analytics.trackPerformance('api_call', 150, 'ms')

      expect(mockCtx.waitUntil).toHaveBeenCalledTimes(1)
    })
  })

  describe('batching', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      analytics = new AsyncAnalytics(mockCtx, {
        endpoint: 'https://analytics.test/events',
        batching: true,
        batchSize: 3,
        flushInterval: 1000
      })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should batch events until batch size reached', () => {
      analytics.track('event1')
      analytics.track('event2')

      // No calls yet - still batching
      expect(mockCtx.waitUntil).not.toHaveBeenCalled()

      analytics.track('event3')

      // Batch size reached - should flush
      expect(mockCtx.waitUntil).toHaveBeenCalledTimes(1)
    })

    it('should flush after interval', () => {
      analytics.track('event1')
      analytics.track('event2')

      expect(mockCtx.waitUntil).not.toHaveBeenCalled()

      // Advance time past flush interval
      vi.advanceTimersByTime(1001)

      expect(mockCtx.waitUntil).toHaveBeenCalledTimes(1)
    })

    it('should manually flush pending events', () => {
      analytics.track('event1')
      analytics.track('event2')

      expect(mockCtx.waitUntil).not.toHaveBeenCalled()

      analytics.flush()

      expect(mockCtx.waitUntil).toHaveBeenCalledTimes(1)
    })

    it('should not flush if no events pending', () => {
      analytics.flush()

      expect(mockCtx.waitUntil).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    beforeEach(() => {
      // Override global mock to return error response
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      analytics = new AsyncAnalytics(mockCtx, {
        endpoint: 'https://analytics.example.com/events',
        batching: false // Disable for error handling tests
      })
    })

    it('should not throw on analytics failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      analytics.track('test_event')

      // Wait for the promise to resolve
      await waitUntilCalls[0]

      // Should log error but not throw
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Analytics failed: 500'))
      consoleSpy.mockRestore()
    })
  })

  describe('no endpoint configured', () => {
    beforeEach(() => {
      analytics = new AsyncAnalytics(mockCtx, {
        // No endpoint
        debug: true,
        batching: false // Need immediate send for no-endpoint test
      })
    })

    it('should skip sending when no endpoint', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

      analytics.track('test_event')

      expect(mockCtx.waitUntil).toHaveBeenCalled()

      // Wait for the promise to complete
      if (waitUntilCalls.length > 0) {
        await waitUntilCalls[0]
      }

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No endpoint configured'))

      consoleSpy.mockRestore()
    })
  })
})

describe('CloudflareAnalytics', () => {
  let analytics: CloudflareAnalytics
  let mockCtx: { waitUntil: ReturnType<typeof vi.fn> }
  let mockAnalyticsEngine: { writeDataPoint: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    }

    mockAnalyticsEngine = {
      writeDataPoint: vi.fn()
    }
  })

  it('should write to Analytics Engine with immediate send', () => {
    analytics = new CloudflareAnalytics(mockCtx, mockAnalyticsEngine, {
      batching: false
    })

    analytics.track('test_event', { value: 42 })

    // With batching disabled, should send immediately
    expect(mockCtx.waitUntil).toHaveBeenCalledTimes(1)
  })

  it('should batch events with Analytics Engine', () => {
    analytics = new CloudflareAnalytics(mockCtx, mockAnalyticsEngine, {
      batching: true,
      batchSize: 3
    })

    // Track first two events - should not send yet
    analytics.track('event1', { value: 1 })
    analytics.track('event2', { value: 2 })
    expect(mockCtx.waitUntil).not.toHaveBeenCalled()

    // Third event reaches batch size - should trigger send
    analytics.track('event3', { value: 3 })
    expect(mockCtx.waitUntil).toHaveBeenCalledTimes(1)
  })

  it('should flush batched events to Analytics Engine', () => {
    analytics = new CloudflareAnalytics(mockCtx, mockAnalyticsEngine, {
      batching: true,
      batchSize: 10
    })

    analytics.track('event1', { value: 1 })
    analytics.track('event2', { value: 2 })

    // Events are batched, not sent yet
    expect(mockCtx.waitUntil).not.toHaveBeenCalled()

    // Manual flush sends the batch
    analytics.flush()
    expect(mockCtx.waitUntil).toHaveBeenCalledTimes(1)
  })
})

describe('AnalyticsFactory', () => {
  it('should create CloudflareAnalytics when Analytics Engine available', () => {
    const mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    }

    const env = {
      ANALYTICS_ENGINE: { writeDataPoint: vi.fn() }
    }

    const analytics = AnalyticsFactory.create(mockCtx, env)

    expect(analytics).toBeInstanceOf(CloudflareAnalytics)
  })

  it('should create AsyncAnalytics when no Analytics Engine', () => {
    const mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    }

    const env = {
      ANALYTICS_ENDPOINT: 'https://analytics.test',
      ANALYTICS_API_KEY: 'test-key'
    }

    const analytics = AnalyticsFactory.create(mockCtx, env)

    expect(analytics).toBeInstanceOf(AsyncAnalytics)
  })

  it('should create no-op analytics', () => {
    const analytics = AnalyticsFactory.createNoop()

    expect(analytics).toBeInstanceOf(AsyncAnalytics)

    // Should not throw
    analytics.track('test')
  })
})

describe('Performance tracking', () => {
  let originalFetch: typeof global.fetch
  
  beforeEach(() => {
    // Save and mock fetch for this describe block
    originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ success: true })
    })
  })
  
  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch
    vi.clearAllMocks()
  })
  
  it('should track method performance metrics', async () => {
    const mockCtx = {
      waitUntil: vi.fn()
    }

    const analytics = new AsyncAnalytics(mockCtx, {
      endpoint: 'https://analytics.test/events',
      batching: false // Need immediate tracking for performance test
    })

    // Track performance manually (what decorator would do)
    const startTime = Date.now()

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 10))

    const endTime = Date.now()
    const duration = endTime - startTime

    analytics.track('method.performance', {
      method: 'testMethod',
      duration,
      success: true
    })

    expect(mockCtx.waitUntil).toHaveBeenCalled()

    // Verify the tracked event has expected structure
    const trackedCall = mockCtx.waitUntil.mock.calls[0][0]
    expect(trackedCall).toBeInstanceOf(Promise)
  })
})

describe('createAnalyticsMiddleware', () => {
  it('should track successful requests', async () => {
    const mockAnalytics = {
      track: vi.fn()
    }

    const middleware = createAnalyticsMiddleware(() => mockAnalytics as AsyncAnalytics)

    const ctx = {
      request: {
        url: '/test',
        method: 'GET'
      },
      response: {
        status: 200
      }
    }

    const next = vi.fn().mockResolvedValue(undefined)

    await middleware(ctx, next)

    expect(next).toHaveBeenCalled()
    expect(mockAnalytics.track).toHaveBeenCalledWith(
      'request_completed',
      expect.objectContaining({
        path: '/test',
        method: 'GET',
        status: 200
      })
    )
  })

  it('should track request errors', async () => {
    const mockAnalytics = {
      track: vi.fn()
    }

    const middleware = createAnalyticsMiddleware(() => mockAnalytics as AsyncAnalytics)

    const ctx = {
      request: {
        url: '/test',
        method: 'POST'
      }
    }

    const error = new Error('Request failed')
    const next = vi.fn().mockRejectedValue(error)

    await expect(middleware(ctx, next)).rejects.toThrow('Request failed')

    expect(mockAnalytics.track).toHaveBeenCalledWith(
      'request_error',
      expect.objectContaining({
        path: '/test',
        method: 'POST',
        error: 'Request failed'
      })
    )
  })
})

describe('Production Scenarios', () => {
  let analytics: AsyncAnalytics
  let mockCtx: { waitUntil: ReturnType<typeof vi.fn> }
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    }

    // Save and mock fetch
    originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200
    })
  })
  
  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch
    vi.clearAllMocks()
  })

  it('should handle high-volume event tracking', () => {
    analytics = new AsyncAnalytics(mockCtx, {
      endpoint: 'https://analytics.test',
      batching: true,
      batchSize: 100
    })

    // Simulate high volume
    for (let i = 0; i < 1000; i++) {
      analytics.track(`event_${i}`, { index: i })
    }

    // Should batch efficiently
    // 1000 events / 100 batch size = 10 batches
    expect(mockCtx.waitUntil).toHaveBeenCalledTimes(10)
  })

  it('should not block response time', () => {
    analytics = new AsyncAnalytics(mockCtx, {
      endpoint: 'https://analytics.test',
      batching: false // Measure per-event timing without batching
    })

    const start = Date.now()

    // Track 100 events
    for (let i = 0; i < 100; i++) {
      analytics.track('event', { i })
    }

    const duration = Date.now() - start

    // Should complete almost instantly (< 10ms)
    // Events are sent async via waitUntil
    expect(duration).toBeLessThan(10)
    expect(mockCtx.waitUntil).toHaveBeenCalledTimes(100)
  })

  it('should track Telegram bot update lifecycle', () => {
    analytics = new AsyncAnalytics(mockCtx, {
      endpoint: 'https://analytics.test',
      batching: true,
      batchSize: 10
    })

    // Simulate bot update handling
    const updateId = '12345'
    const userId = 'user123'

    // Track update received
    analytics.track('telegram_update_received', {
      update_id: updateId,
      type: 'message'
    })

    // Track user action
    analytics.trackUser(userId, 'command_executed', {
      command: '/start',
      update_id: updateId
    })

    // Track processing time
    analytics.trackPerformance('update_processing', 45)

    // Track response sent
    analytics.track('telegram_response_sent', {
      update_id: updateId,
      response_type: 'text'
    })

    // Flush at end of request
    analytics.flush()

    // Should batch all events into single call
    expect(mockCtx.waitUntil).toHaveBeenCalledTimes(1)
  })
})
