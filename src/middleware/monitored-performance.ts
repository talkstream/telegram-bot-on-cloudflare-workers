/**
 * Monitored Performance Monitor
 *
 * Extends PerformanceMonitor to automatically report to monitoring service
 */

import type { PerformanceMetrics, PerformanceMonitorConfig } from './performance-monitor'
import { PerformanceMonitor } from './performance-monitor'

import { EventBus } from '@/core/events/event-bus'
import { CommonEventType } from '@/core/events/types/common'
import type { IMonitoringConnector } from '@/core/interfaces/monitoring'

export interface MonitoredPerformanceConfig extends PerformanceMonitorConfig {
  monitoring: IMonitoringConnector
  eventBus?: EventBus
  reportThreshold?: number // Only report operations slower than this (ms)
  reportErrors?: boolean
  reportPercentiles?: boolean
}

export class MonitoredPerformanceMonitor extends PerformanceMonitor {
  private monitoring: IMonitoringConnector
  private eventBus?: EventBus
  private reportThreshold: number
  private reportErrors: boolean
  private reportPercentiles: boolean

  constructor(config: MonitoredPerformanceConfig) {
    // Set up slow operation handler to report to monitoring
    const originalHandler = config.onSlowOperation

    super({
      ...config,
      onSlowOperation: async metrics => {
        // Report to monitoring
        this.reportToMonitoring(metrics)

        // Call original handler if provided
        if (originalHandler) {
          await originalHandler(metrics)
        }
      }
    })

    this.monitoring = config.monitoring
    this.eventBus = config.eventBus
    this.reportThreshold = config.reportThreshold ?? 100 // Default 100ms
    this.reportErrors = config.reportErrors ?? true
    this.reportPercentiles = config.reportPercentiles ?? true
  }

  /**
   * Override recordMetric to report to monitoring
   */
  override recordMetric(metric: PerformanceMetrics): void {
    super.recordMetric(metric)

    // Report errors immediately
    if (!metric.success && this.reportErrors) {
      this.monitoring.captureMessage(`Operation failed: ${metric.operation}`, 'error')

      if (this.eventBus) {
        this.eventBus.emit(
          CommonEventType.ERROR_OCCURRED,
          {
            error: new Error(`Operation failed: ${metric.operation}`),
            context: metric.metadata
          },
          'PerformanceMonitor'
        )
      }
    }

    // Report slow operations
    if (metric.duration >= this.reportThreshold) {
      this.reportToMonitoring(metric)
    }
  }

  /**
   * Report metrics to monitoring service
   */
  private reportToMonitoring(metric: PerformanceMetrics): void {
    // Track as custom event
    this.monitoring.trackEvent('performance_metric', {
      operation: metric.operation,
      duration: metric.duration,
      success: metric.success,
      timestamp: metric.timestamp,
      ...metric.metadata
    })

    // Track as metric for aggregation
    this.monitoring.trackMetric(`operation_duration`, metric.duration, {
      operation: metric.operation,
      success: String(metric.success)
    })

    // Add breadcrumb for context
    this.monitoring.addBreadcrumb({
      message: `Operation: ${metric.operation}`,
      category: 'performance',
      level: metric.duration > 1000 ? 'warning' : 'info',
      data: {
        duration: metric.duration,
        success: metric.success
      }
    })
  }

  /**
   * Periodically report aggregated stats
   */
  reportAggregatedStats(): void {
    const allStats = this.getStats()

    if (!Array.isArray(allStats)) {
      return
    }

    for (const stats of allStats) {
      // Report average duration
      this.monitoring.trackMetric('operation_avg_duration', stats.avgDuration, {
        operation: stats.operation
      })

      // Report success rate
      const successRate = stats.count > 0 ? (stats.successCount / stats.count) * 100 : 0

      this.monitoring.trackMetric('operation_success_rate', successRate, {
        operation: stats.operation
      })

      // Report percentiles if enabled
      if (this.reportPercentiles) {
        this.monitoring.trackMetric('operation_p50', stats.p50, {
          operation: stats.operation
        })

        this.monitoring.trackMetric('operation_p95', stats.p95, {
          operation: stats.operation
        })

        this.monitoring.trackMetric('operation_p99', stats.p99, {
          operation: stats.operation
        })
      }

      // Track high error rates
      if (stats.errorCount > 0 && stats.count > 0) {
        const errorRate = (stats.errorCount / stats.count) * 100
        if (errorRate > 10) {
          // More than 10% errors
          this.monitoring.captureMessage(
            `High error rate for ${stats.operation}: ${errorRate.toFixed(1)}%`,
            'warning'
          )
        }
      }
    }
  }

  /**
   * Start periodic reporting
   */
  startPeriodicReporting(intervalMs: number = 60000): NodeJS.Timeout | number {
    return setInterval(() => {
      this.reportAggregatedStats()
    }, intervalMs)
  }
}

/**
 * Factory function to create monitored performance monitor
 */
export function createMonitoredPerformance(
  monitoring: IMonitoringConnector,
  eventBus?: EventBus,
  config?: Partial<MonitoredPerformanceConfig>
): MonitoredPerformanceMonitor {
  return new MonitoredPerformanceMonitor({
    monitoring,
    eventBus,
    ...config
  })
}
