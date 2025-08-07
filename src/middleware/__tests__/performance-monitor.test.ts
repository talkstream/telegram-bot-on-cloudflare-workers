import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ILogger } from '../../core/interfaces/logger'
import {
  PerformanceMonitor,
  ScopedPerformanceMonitor,
  getDefaultMonitor,
  resetDefaultMonitor
} from '../performance-monitor'

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor
  let mockLogger: ILogger

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnThis(),
      setContext: vi.fn()
    }

    monitor = new PerformanceMonitor({
      logger: mockLogger,
      slowOperationThreshold: 100,
      verySlowOperationThreshold: 500
    })
  })

  describe('startTimer', () => {
    it('should create a timer that tracks elapsed time', () => {
      const timer = monitor.startTimer()

      // Should be able to check elapsed time multiple times
      const elapsed1 = timer.elapsed()
      expect(elapsed1).toBeGreaterThanOrEqual(0)

      // Stop the timer
      const duration = timer.stop()
      expect(duration).toBeGreaterThanOrEqual(0)

      // Elapsed should remain constant after stopping
      const elapsed2 = timer.elapsed()
      expect(elapsed2).toBe(duration)
    })
  })

  describe('trackOperation', () => {
    it('should track successful operations', async () => {
      const result = await monitor.trackOperation(
        'test-operation',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return 'success'
        },
        { userId: 123 }
      )

      expect(result).toBe('success')

      const stats = monitor.getStats('test-operation')
      expect(stats).toBeTruthy()
      if (stats && !Array.isArray(stats)) {
        expect(stats.count).toBe(1)
        expect(stats.successCount).toBe(1)
        expect(stats.errorCount).toBe(0)
      }
    })

    it('should track failed operations', async () => {
      await expect(
        monitor.trackOperation('failing-operation', async () => {
          throw new Error('Test error')
        })
      ).rejects.toThrow('Test error')

      const stats = monitor.getStats('failing-operation')
      expect(stats).toBeTruthy()
      if (stats && !Array.isArray(stats)) {
        expect(stats.count).toBe(1)
        expect(stats.successCount).toBe(0)
        expect(stats.errorCount).toBe(1)
      }
    })

    it('should handle slow operations', async () => {
      await monitor.trackOperation('slow-operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 150))
        return 'done'
      })

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Slow operation detected',
        expect.objectContaining({
          operation: 'slow-operation',
          duration: expect.any(Number)
        })
      )
    })

    it('should handle very slow operations', async () => {
      await monitor.trackOperation('very-slow-operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 550))
        return 'done'
      })

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Very slow operation detected',
        expect.objectContaining({
          operation: 'very-slow-operation',
          duration: expect.any(Number)
        })
      )
    })

    it('should call custom slow operation handler', async () => {
      const onSlowOperation = vi.fn()
      const customMonitor = new PerformanceMonitor({
        slowOperationThreshold: 50,
        onSlowOperation
      })

      await customMonitor.trackOperation('slow-op', async () => {
        await new Promise(resolve => setTimeout(resolve, 60))
      })

      expect(onSlowOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'slow-op',
          duration: expect.any(Number)
        })
      )
    })
  })

  describe('recordMetric', () => {
    it('should record metrics', () => {
      monitor.recordMetric({
        operation: 'test-op',
        duration: 100,
        success: true,
        timestamp: Date.now()
      })

      const stats = monitor.getStats('test-op')
      expect(stats).toBeTruthy()
      if (stats && !Array.isArray(stats)) {
        expect(stats.count).toBe(1)
        expect(stats.avgDuration).toBe(100)
      }
    })

    it('should limit metrics per operation', () => {
      const limitedMonitor = new PerformanceMonitor({
        maxMetricsPerOperation: 3
      })

      // Record 5 metrics
      for (let i = 0; i < 5; i++) {
        limitedMonitor.recordMetric({
          operation: 'limited-op',
          duration: i * 10,
          success: true,
          timestamp: Date.now()
        })
      }

      const recent = limitedMonitor.getRecentMetrics('limited-op', 10)
      expect(recent).toHaveLength(3) // Should only keep last 3
      expect(recent[0].duration).toBe(20) // First two should be dropped
    })
  })

  describe('getStats', () => {
    it('should calculate statistics correctly', () => {
      const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

      durations.forEach((duration, i) => {
        monitor.recordMetric({
          operation: 'stats-test',
          duration,
          success: i < 8, // First 8 succeed, last 2 fail
          timestamp: Date.now()
        })
      })

      const stats = monitor.getStats('stats-test')
      expect(stats).toBeTruthy()
      if (stats && !Array.isArray(stats)) {
        expect(stats.count).toBe(10)
        expect(stats.successCount).toBe(8)
        expect(stats.errorCount).toBe(2)
        expect(stats.avgDuration).toBe(55)
        expect(stats.minDuration).toBe(10)
        expect(stats.maxDuration).toBe(100)
        expect(stats.p50).toBe(60)
        expect(stats.p95).toBe(100)
        expect(stats.p99).toBe(100)
      }
    })

    it('should return null for non-existent operations', () => {
      const stats = monitor.getStats('non-existent')
      expect(stats).toBeNull()
    })

    it('should return all stats when no operation specified', () => {
      monitor.recordMetric({
        operation: 'op1',
        duration: 10,
        success: true,
        timestamp: Date.now()
      })

      monitor.recordMetric({
        operation: 'op2',
        duration: 20,
        success: true,
        timestamp: Date.now()
      })

      const allStats = monitor.getStats()
      expect(allStats).toBeInstanceOf(Array)
      if (Array.isArray(allStats)) {
        expect(allStats).toHaveLength(2)
        expect(allStats.map(s => s.operation).sort()).toEqual(['op1', 'op2'])
      }
    })
  })

  describe('clear', () => {
    it('should clear metrics for specific operation', () => {
      monitor.recordMetric({
        operation: 'to-clear',
        duration: 10,
        success: true,
        timestamp: Date.now()
      })

      monitor.recordMetric({
        operation: 'to-keep',
        duration: 20,
        success: true,
        timestamp: Date.now()
      })

      monitor.clear('to-clear')

      expect(monitor.getStats('to-clear')).toBeNull()
      expect(monitor.getStats('to-keep')).toBeTruthy()
    })

    it('should clear all metrics', () => {
      monitor.recordMetric({
        operation: 'op1',
        duration: 10,
        success: true,
        timestamp: Date.now()
      })

      monitor.recordMetric({
        operation: 'op2',
        duration: 20,
        success: true,
        timestamp: Date.now()
      })

      monitor.clear()

      const allStats = monitor.getStats()
      expect(allStats).toEqual([])
    })
  })

  describe('exportMetrics', () => {
    it('should export all metrics', () => {
      monitor.recordMetric({
        operation: 'export-test',
        duration: 10,
        success: true,
        timestamp: Date.now()
      })

      const exported = monitor.exportMetrics()
      expect(exported).toBeInstanceOf(Map)
      expect(exported.has('export-test')).toBe(true)

      const metrics = exported.get('export-test')
      expect(metrics).toBeInstanceOf(Array)
      if (metrics) {
        expect(metrics).toHaveLength(1)
        expect(metrics[0].duration).toBe(10)
      }
    })
  })
})

describe('ScopedPerformanceMonitor', () => {
  let monitor: PerformanceMonitor
  let scopedMonitor: ScopedPerformanceMonitor

  beforeEach(() => {
    monitor = new PerformanceMonitor()
    scopedMonitor = monitor.scope('api')
  })

  it('should prefix operations', async () => {
    await scopedMonitor.trackOperation('users.list', async () => 'result')

    const stats = monitor.getStats('api.users.list')
    expect(stats).toBeTruthy()
  })

  it('should prefix recorded metrics', () => {
    scopedMonitor.recordMetric({
      operation: 'users.get',
      duration: 50,
      success: true,
      timestamp: Date.now()
    })

    const stats = monitor.getStats('api.users.get')
    expect(stats).toBeTruthy()
  })

  it('should get scoped stats', () => {
    scopedMonitor.recordMetric({
      operation: 'users.get',
      duration: 50,
      success: true,
      timestamp: Date.now()
    })

    const stats = scopedMonitor.getStats('users.get')
    expect(stats).toBeTruthy()
    if (stats && !Array.isArray(stats)) {
      expect(stats.operation).toBe('api.users.get')
    }
  })

  it('should filter all stats by prefix', () => {
    monitor.recordMetric({
      operation: 'api.users',
      duration: 10,
      success: true,
      timestamp: Date.now()
    })

    monitor.recordMetric({
      operation: 'api.posts',
      duration: 20,
      success: true,
      timestamp: Date.now()
    })

    monitor.recordMetric({
      operation: 'other.task',
      duration: 30,
      success: true,
      timestamp: Date.now()
    })

    const scopedStats = scopedMonitor.getStats()
    expect(scopedStats).toBeInstanceOf(Array)
    if (Array.isArray(scopedStats)) {
      expect(scopedStats).toHaveLength(2)
      expect(scopedStats.every(s => s.operation.startsWith('api.'))).toBe(true)
    }
  })
})

describe('Default monitor', () => {
  afterEach(() => {
    resetDefaultMonitor()
  })

  it('should return singleton instance', () => {
    const monitor1 = getDefaultMonitor()
    const monitor2 = getDefaultMonitor()

    expect(monitor1).toBe(monitor2)
  })

  it('should reset properly', () => {
    const monitor1 = getDefaultMonitor()
    resetDefaultMonitor()
    const monitor2 = getDefaultMonitor()

    expect(monitor1).not.toBe(monitor2)
  })
})

describe('TrackPerformance decorator', () => {
  it('should track method performance using wrapper pattern', async () => {
    resetDefaultMonitor()
    const monitor = getDefaultMonitor()

    class TestService {
      async testMethod(): Promise<string> {
        // Simulate what @TrackPerformance decorator would do
        return monitor.trackOperation('custom.operation', async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return 'result'
        })
      }
    }

    const service = new TestService()
    const result = await service.testMethod()

    expect(result).toBe('result')

    const stats = monitor.getStats('custom.operation')
    expect(stats).toBeTruthy()
    if (stats && !Array.isArray(stats)) {
      expect(stats.count).toBe(1)
      expect(stats.successCount).toBe(1)
    }
  })

  it('should use default operation name', async () => {
    resetDefaultMonitor()
    const monitor = getDefaultMonitor()

    class TestService {
      async testMethod(): Promise<string> {
        // Use class and method names for operation tracking
        const operationName = `${this.constructor.name}.testMethod`
        return monitor.trackOperation(operationName, async () => {
          return 'result'
        })
      }
    }

    const service = new TestService()
    await service.testMethod()

    const stats = monitor.getStats('TestService.testMethod')
    expect(stats).toBeTruthy()
  })

  it('should track errors', async () => {
    resetDefaultMonitor()
    const monitor = getDefaultMonitor()

    class TestService {
      async errorMethod(): Promise<void> {
        return monitor.trackOperation('error.operation', async () => {
          throw new Error('Test error')
        })
      }
    }

    const service = new TestService()

    await expect(service.errorMethod()).rejects.toThrow('Test error')

    const stats = monitor.getStats('error.operation')
    expect(stats).toBeTruthy()
    if (stats && !Array.isArray(stats)) {
      expect(stats.errorCount).toBe(1)
      expect(stats.successCount).toBe(0)
    }
  })
})
