/**
 * Performance Monitoring Middleware
 * Platform-agnostic performance tracking for web applications
 */

import type { ILogger } from '../core/interfaces/logger'

export interface PerformanceMetrics {
  operation: string
  duration: number
  success: boolean
  timestamp: number
  metadata?: Record<string, unknown>
}

export interface OperationStats {
  operation: string
  count: number
  successCount: number
  errorCount: number
  avgDuration: number
  minDuration: number
  maxDuration: number
  p50: number
  p95: number
  p99: number
}

export interface PerformanceMonitorConfig {
  logger?: ILogger
  maxMetricsPerOperation?: number
  slowOperationThreshold?: number
  verySlowOperationThreshold?: number
  captureStackTrace?: boolean
  onSlowOperation?: (metrics: PerformanceMetrics) => void | Promise<void>
}

export interface Timer {
  stop(): number
  elapsed(): number
}

export class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetrics[]>()
  private logger?: ILogger
  private maxMetricsPerOperation: number
  private slowOperationThreshold: number
  private verySlowOperationThreshold: number
  private captureStackTrace: boolean
  private onSlowOperation?: (metrics: PerformanceMetrics) => void | Promise<void>

  constructor(config: PerformanceMonitorConfig = {}) {
    this.logger = config.logger
    this.maxMetricsPerOperation = config.maxMetricsPerOperation || 100
    this.slowOperationThreshold = config.slowOperationThreshold || 1000
    this.verySlowOperationThreshold = config.verySlowOperationThreshold || 5000
    this.captureStackTrace = config.captureStackTrace || false
    this.onSlowOperation = config.onSlowOperation
  }

  /**
   * Start timing an operation
   */
  startTimer(): Timer {
    const startTime = performance.now()
    let stopped = false
    let duration = 0

    return {
      stop(): number {
        if (!stopped) {
          duration = performance.now() - startTime
          stopped = true
        }
        return duration
      },
      elapsed(): number {
        return stopped ? duration : performance.now() - startTime
      }
    }
  }

  /**
   * Track operation performance
   */
  async trackOperation<T>(
    operation: string,
    fn: () => T | Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const timer = this.startTimer()
    let success = true
    let result: T
    let error: Error | undefined

    try {
      result = await fn()
    } catch (err) {
      success = false
      error = err instanceof Error ? err : new Error(String(err))
      throw error
    } finally {
      const duration = timer.stop()

      const metrics: PerformanceMetrics = {
        operation,
        duration,
        success,
        timestamp: Date.now(),
        metadata: {
          ...metadata,
          ...(error && this.captureStackTrace ? { stackTrace: error.stack } : {})
        }
      }

      this.recordMetric(metrics)

      // Handle slow operations
      if (duration > this.slowOperationThreshold) {
        this.handleSlowOperation(metrics)
      }
    }

    return result
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetrics): void {
    const { operation } = metric

    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, [])
    }

    const operationMetrics = this.metrics.get(operation)
    if (!operationMetrics) {
      // This should not happen as we just set it, but TypeScript doesn't know that
      return
    }
    operationMetrics.push(metric)

    // Keep only recent metrics
    if (operationMetrics.length > this.maxMetricsPerOperation) {
      operationMetrics.shift()
    }
  }

  /**
   * Handle slow operation
   */
  private handleSlowOperation(metrics: PerformanceMetrics): void {
    const { duration } = metrics

    if (duration > this.verySlowOperationThreshold) {
      this.logger?.error('Very slow operation detected', { ...metrics })
    } else {
      this.logger?.warn('Slow operation detected', { ...metrics })
    }

    // Call custom handler if provided
    if (this.onSlowOperation) {
      Promise.resolve(this.onSlowOperation(metrics)).catch(err => {
        this.logger?.error('Error in slow operation handler', { error: err })
      })
    }
  }

  /**
   * Get performance statistics for an operation
   */
  getStats(operation?: string): OperationStats | OperationStats[] | null {
    if (operation) {
      const operationMetrics = this.metrics.get(operation)
      if (!operationMetrics || operationMetrics.length === 0) {
        return null
      }
      return this.calculateStats(operation, operationMetrics)
    }

    // Return stats for all operations
    const allStats: OperationStats[] = []
    for (const [op, metrics] of this.metrics.entries()) {
      if (metrics.length > 0) {
        allStats.push(this.calculateStats(op, metrics))
      }
    }
    return allStats
  }

  /**
   * Calculate statistics for operation metrics
   */
  private calculateStats(operation: string, metrics: PerformanceMetrics[]): OperationStats {
    const durations = metrics.map(m => m.duration)
    const sortedDurations = [...durations].sort((a, b) => a - b)
    const successCount = metrics.filter(m => m.success).length
    const errorCount = metrics.length - successCount

    const sum = durations.reduce((a, b) => a + b, 0)
    const count = durations.length

    return {
      operation,
      count,
      successCount,
      errorCount,
      avgDuration: Math.round(sum / count),
      minDuration: sortedDurations[0] || 0,
      maxDuration: sortedDurations[count - 1] || 0,
      p50: sortedDurations[Math.floor(count * 0.5)] || 0,
      p95: sortedDurations[Math.floor(count * 0.95)] || 0,
      p99: sortedDurations[Math.floor(count * 0.99)] || 0
    }
  }

  /**
   * Get recent metrics for an operation
   */
  getRecentMetrics(operation: string, limit: number = 10): PerformanceMetrics[] {
    const operationMetrics = this.metrics.get(operation) || []
    return operationMetrics.slice(-limit)
  }

  /**
   * Clear metrics for an operation or all operations
   */
  clear(operation?: string): void {
    if (operation) {
      this.metrics.delete(operation)
    } else {
      this.metrics.clear()
    }
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(): Map<string, PerformanceMetrics[]> {
    return new Map(this.metrics)
  }

  /**
   * Create a scoped monitor for a specific context
   */
  scope(prefix: string): ScopedPerformanceMonitor {
    return new ScopedPerformanceMonitor(this, prefix)
  }
}

/**
 * Scoped performance monitor that prefixes all operations
 */
export class ScopedPerformanceMonitor {
  constructor(
    private monitor: PerformanceMonitor,
    private prefix: string
  ) {}

  startTimer(): Timer {
    return this.monitor.startTimer()
  }

  async trackOperation<T>(
    operation: string,
    fn: () => T | Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    return this.monitor.trackOperation(`${this.prefix}.${operation}`, fn, metadata)
  }

  recordMetric(metric: PerformanceMetrics): void {
    this.monitor.recordMetric({
      ...metric,
      operation: `${this.prefix}.${metric.operation}`
    })
  }

  getStats(operation?: string): OperationStats | OperationStats[] | null {
    if (operation) {
      return this.monitor.getStats(`${this.prefix}.${operation}`)
    }

    // Get all stats with prefix
    const allStats = this.monitor.getStats()
    if (!allStats || !Array.isArray(allStats)) {
      return null
    }

    return allStats.filter(stat => stat.operation.startsWith(`${this.prefix}.`))
  }
}

// Singleton instance storage
interface GlobalWithMonitor {
  [key: symbol]: PerformanceMonitor | undefined
}
const globalStore = globalThis as GlobalWithMonitor
const MONITOR_KEY = Symbol.for('__wireframe_performance_monitor')

/**
 * Get or create the default performance monitor
 */
export function getDefaultMonitor(config?: PerformanceMonitorConfig): PerformanceMonitor {
  if (!globalStore[MONITOR_KEY]) {
    globalStore[MONITOR_KEY] = new PerformanceMonitor(config)
  }
  return globalStore[MONITOR_KEY]
}

/**
 * Reset the default monitor (useful for testing)
 */
export function resetDefaultMonitor(): void {
  delete globalStore[MONITOR_KEY]
}

/**
 * Decorator for tracking method performance
 */
export function TrackPerformance(operation?: string) {
  return function (target: object, propertyKey: string | symbol, descriptor?: PropertyDescriptor) {
    // Handle different decorator invocation patterns
    if (!descriptor) {
      // This might be a newer decorator format or property decorator
      return
    }

    const originalMethod = descriptor.value

    if (typeof originalMethod !== 'function') {
      throw new Error('TrackPerformance can only be applied to methods')
    }

    const className = target.constructor?.name || 'UnknownClass'
    const methodName = String(propertyKey)
    const operationName = operation || `${className}.${methodName}`

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      const monitor = getDefaultMonitor()
      return monitor.trackOperation(operationName, async () => originalMethod.apply(this, args), {
        methodName,
        className
      })
    }

    return descriptor
  }
}
