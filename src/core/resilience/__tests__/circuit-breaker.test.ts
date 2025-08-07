/**
 * Tests for Circuit Breaker Pattern
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CircuitBreakerConfig } from '../circuit-breaker'
import { CircuitBreaker, CircuitState } from '../circuit-breaker'

import type { EventBus } from '@/core/events/event-bus'

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker
  let config: CircuitBreakerConfig

  beforeEach(() => {
    vi.useFakeTimers()
    config = {
      failureThreshold: 3,
      failureWindow: 10000, // 10 seconds
      successThreshold: 0.8,
      recoveryTimeout: 5000, // 5 seconds
      halfOpenRequests: 2,
      name: 'test-service'
    }
    breaker = new CircuitBreaker(config)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('normal operation (CLOSED state)', () => {
    it('should execute successful functions', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const result = await breaker.execute(fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalled()
      expect(breaker.getState()).toBe(CircuitState.CLOSED)
    })

    it('should handle failures without opening', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'))

      // First two failures should not open circuit
      for (let i = 0; i < 2; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow('fail')
      }

      expect(breaker.getState()).toBe(CircuitState.CLOSED)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should open after threshold failures', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'))

      // Fail threshold times
      for (let i = 0; i < config.failureThreshold; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow('fail')
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN)
      expect(fn).toHaveBeenCalledTimes(config.failureThreshold)
    })

    it('should count failures within time window', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'))

      // Two failures
      await expect(breaker.execute(fn)).rejects.toThrow('fail')
      await expect(breaker.execute(fn)).rejects.toThrow('fail')

      // Advance time past window
      vi.advanceTimersByTime(config.failureWindow + 1000)

      // Another failure should not open circuit (old failures expired)
      await expect(breaker.execute(fn)).rejects.toThrow('fail')

      expect(breaker.getState()).toBe(CircuitState.CLOSED)
    })
  })

  describe('open state', () => {
    beforeEach(async () => {
      // Open the circuit
      const fn = vi.fn().mockRejectedValue(new Error('fail'))
      for (let i = 0; i < config.failureThreshold; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow('fail')
      }
    })

    it('should reject requests when open', async () => {
      const fn = vi.fn().mockResolvedValue('success')

      await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker is OPEN')
      expect(fn).not.toHaveBeenCalled()
    })

    it('should transition to half-open after recovery timeout', async () => {
      expect(breaker.getState()).toBe(CircuitState.OPEN)

      // Advance time to recovery timeout
      vi.advanceTimersByTime(config.recoveryTimeout)

      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN)
    })

    it('should track statistics', () => {
      const stats = breaker.getStats()

      expect(stats.state).toBe(CircuitState.OPEN)
      expect(stats.failures).toBe(config.failureThreshold)
      expect(stats.consecutiveFailures).toBe(config.failureThreshold)
    })
  })

  describe('half-open state', () => {
    beforeEach(async () => {
      // Open the circuit
      const fn = vi.fn().mockRejectedValue(new Error('fail'))
      for (let i = 0; i < config.failureThreshold; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow('fail')
      }

      // Move to half-open
      vi.advanceTimersByTime(config.recoveryTimeout)
    })

    it('should allow limited test requests', async () => {
      const fn = vi.fn().mockResolvedValue('success')

      // Should allow halfOpenRequests number of requests
      for (let i = 0; i < config.halfOpenRequests; i++) {
        const result = await breaker.execute(fn)
        expect(result).toBe('success')
      }

      // Circuit should now be closed after successful test requests
      expect(breaker.getState()).toBe(CircuitState.CLOSED)

      // Next request should succeed (circuit is closed)
      const result = await breaker.execute(fn)
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(config.halfOpenRequests + 1)
    })

    it('should close on successful recovery', async () => {
      const fn = vi.fn().mockResolvedValue('success')

      // Execute successful requests
      for (let i = 0; i < config.halfOpenRequests; i++) {
        await breaker.execute(fn)
      }

      // Should be closed now
      expect(breaker.getState()).toBe(CircuitState.CLOSED)
    })

    it('should reopen on failure during recovery', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'))

      // Single failure should reopen
      await expect(breaker.execute(fn)).rejects.toThrow('fail')

      expect(breaker.getState()).toBe(CircuitState.OPEN)
    })
  })

  describe('reset functionality', () => {
    it('should reset all state', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'))

      // Cause some failures
      for (let i = 0; i < 2; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow('fail')
      }

      const statsBefore = breaker.getStats()
      expect(statsBefore.failures).toBe(2)

      // Reset
      breaker.reset()

      const statsAfter = breaker.getStats()
      expect(statsAfter.state).toBe(CircuitState.CLOSED)
      expect(statsAfter.failures).toBe(0)
      expect(statsAfter.successes).toBe(0)
      expect(statsAfter.totalRequests).toBe(0)
    })
  })

  describe('success rate calculation', () => {
    it('should track success rate correctly', async () => {
      const successFn = vi.fn().mockResolvedValue('success')
      const failFn = vi.fn().mockRejectedValue(new Error('fail'))

      // 2 successes, 1 failure
      await breaker.execute(successFn)
      await breaker.execute(successFn)
      await expect(breaker.execute(failFn)).rejects.toThrow('fail')

      const stats = breaker.getStats()
      expect(stats.successes).toBe(2)
      expect(stats.failures).toBe(1)
    })
  })

  describe('state helpers', () => {
    it('should correctly report state', async () => {
      expect(breaker.isClosed()).toBe(true)
      expect(breaker.isOpen()).toBe(false)

      // Open circuit
      const fn = vi.fn().mockRejectedValue(new Error('fail'))
      for (let i = 0; i < config.failureThreshold; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow('fail')
      }

      expect(breaker.isClosed()).toBe(false)
      expect(breaker.isOpen()).toBe(true)
    })
  })

  describe('event emissions', () => {
    it('should emit events on state changes', async () => {
      const eventBus = {
        emit: vi.fn()
      }

      const breaker = new CircuitBreaker(config, eventBus as EventBus)
      const fn = vi.fn().mockRejectedValue(new Error('fail'))

      // Cause circuit to open
      for (let i = 0; i < config.failureThreshold; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow('fail')
      }

      // Check events were emitted with 3 parameters (event, data, source)
      expect(eventBus.emit).toHaveBeenCalledWith(
        'circuit:failure',
        expect.any(Object),
        'CircuitBreaker'
      )
      expect(eventBus.emit).toHaveBeenCalledWith(
        'circuit:open',
        expect.any(Object),
        'CircuitBreaker'
      )
    })
  })
})
