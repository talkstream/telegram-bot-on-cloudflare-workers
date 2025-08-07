/**
 * Mock Monitoring Connector for deployment without real monitoring services
 *
 * This connector simulates monitoring behavior for testing and demo purposes.
 * It logs all monitoring events to console instead of sending to external services.
 */

import type {
  Breadcrumb,
  IMonitoringConnector,
  MonitoringConfig
} from '../../core/interfaces/monitoring'

export class MockMonitoringConnector implements IMonitoringConnector {
  private breadcrumbs: Array<{ message: string; timestamp: Date }> = []

  async initialize(config: MonitoringConfig): Promise<void> {
    console.info('[MockMonitoring] Initialized in DEMO mode - no real monitoring service')
    console.info('[MockMonitoring] Environment:', config.environment || 'development')
  }

  captureException(error: Error, context?: Record<string, unknown>): void {
    console.error('[MockMonitoring] Exception captured:', {
      error: error.message,
      stack: error.stack,
      context
    })
  }

  captureMessage(message: string, level: 'debug' | 'info' | 'warning' | 'error' = 'info'): void {
    const logFn =
      level === 'error' ? console.error : level === 'warning' ? console.warn : console.info

    logFn(`[MockMonitoring] ${level.toUpperCase()}: ${message}`)
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.breadcrumbs.push({
      message: breadcrumb.message,
      timestamp: new Date(breadcrumb.timestamp || Date.now())
    })

    // Keep only last 100 breadcrumbs
    if (this.breadcrumbs.length > 100) {
      this.breadcrumbs.shift()
    }

    console.info('[MockMonitoring] Breadcrumb:', breadcrumb)
  }

  trackEvent(name: string, data?: Record<string, unknown>): void {
    console.info('[MockMonitoring] Event tracked:', {
      name,
      data,
      timestamp: new Date()
    })
  }

  trackMetric(name: string, value: number, tags?: Record<string, string>): void {
    console.info('[MockMonitoring] Metric tracked:', {
      name,
      value,
      tags,
      timestamp: new Date()
    })
  }

  setUser(user: { id: string; username?: string; email?: string }): void {
    console.info('[MockMonitoring] User context set:', user)
  }

  setTag(key: string, value: string | number | boolean): void {
    console.info(`[MockMonitoring] Tag set: ${key} = ${value}`)
  }

  setContext(name: string, context: Record<string, unknown>): void {
    console.info(`[MockMonitoring] Context set: ${name}`, context)
  }

  async flush(timeout?: number): Promise<boolean> {
    console.info(`[MockMonitoring] Flush called (timeout: ${timeout}ms)`)
    console.info(`[MockMonitoring] Breadcrumbs count: ${this.breadcrumbs.length}`)
    return true
  }

  startTransaction(
    name: string,
    operation: string
  ): {
    name: string
    operation: string
    startTime: number
    finish: () => void
    setTag: (key: string, value: string | number | boolean) => void
    setData: (key: string, value: unknown) => void
  } {
    const startTime = Date.now()
    console.info(`[MockMonitoring] Transaction started: ${name} (${operation})`)

    return {
      name,
      operation,
      startTime,
      finish: () => {
        const duration = Date.now() - startTime
        console.info(`[MockMonitoring] Transaction finished: ${name} (${duration}ms)`)
      },
      setTag: (key: string, value: string | number | boolean) => {
        console.info(`[MockMonitoring] Transaction tag: ${key} = ${value}`)
      },
      setData: (key: string, value: unknown) => {
        console.info(`[MockMonitoring] Transaction data: ${key} = ${JSON.stringify(value)}`)
      }
    }
  }

  measurePerformance<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now()
    console.info(`[MockMonitoring] Performance measurement started: ${name}`)

    return operation()
      .then(result => {
        const duration = Date.now() - startTime
        console.info(`[MockMonitoring] Performance measurement completed: ${name} (${duration}ms)`)
        return result
      })
      .catch(error => {
        const duration = Date.now() - startTime
        console.error(
          `[MockMonitoring] Performance measurement failed: ${name} (${duration}ms)`,
          error
        )
        throw error
      })
  }

  setUserContext(userId: string, data?: Record<string, unknown>): void {
    console.info('[MockMonitoring] User context set:', { userId, data })
  }

  clearUserContext(): void {
    console.info('[MockMonitoring] User context cleared')
  }

  isAvailable(): boolean {
    return true
  }
}
