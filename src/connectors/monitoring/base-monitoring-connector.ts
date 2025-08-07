/**
 * Base monitoring connector implementation
 */

import type {
  Breadcrumb,
  IMonitoringConnector,
  MonitoringConfig,
  MonitoringEvent
} from '../../core/interfaces/monitoring'

export abstract class BaseMonitoringConnector implements IMonitoringConnector {
  protected config?: MonitoringConfig
  protected initialized = false
  protected breadcrumbs: Breadcrumb[] = []
  protected userContext?: { id: string; data?: Record<string, unknown> }

  async initialize(config: MonitoringConfig): Promise<void> {
    this.config = config
    await this.doInitialize(config)
    this.initialized = true
  }

  abstract captureException(error: Error, context?: Record<string, unknown>): void

  abstract captureMessage(message: string, level?: 'debug' | 'info' | 'warning' | 'error'): void

  setUserContext(userId: string, data?: Record<string, unknown>): void {
    this.userContext = { id: userId, data }
    this.doSetUserContext(userId, data)
  }

  clearUserContext(): void {
    this.userContext = undefined
    this.doClearUserContext()
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    // Keep last 100 breadcrumbs
    if (this.breadcrumbs.length >= 100) {
      this.breadcrumbs.shift()
    }

    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: breadcrumb.timestamp || Date.now()
    })

    this.doAddBreadcrumb(breadcrumb)
  }

  trackEvent(name: string, data?: Record<string, unknown>): void {
    // Default implementation - add as breadcrumb
    this.addBreadcrumb({
      message: name,
      category: 'event',
      level: 'info',
      data
    })
  }

  trackMetric(name: string, value: number, tags?: Record<string, string>): void {
    // Default implementation - add as breadcrumb
    this.addBreadcrumb({
      message: `Metric: ${name}`,
      category: 'metric',
      level: 'info',
      data: {
        value,
        ...tags
      }
    })
  }

  abstract flush(timeout?: number): Promise<boolean>

  isAvailable(): boolean {
    return this.initialized && !!this.config?.dsn
  }

  /**
   * Platform-specific initialization
   */
  protected abstract doInitialize(config: MonitoringConfig): Promise<void>

  /**
   * Platform-specific user context setting
   */
  protected abstract doSetUserContext(userId: string, data?: Record<string, unknown>): void

  /**
   * Platform-specific user context clearing
   */
  protected abstract doClearUserContext(): void

  /**
   * Platform-specific breadcrumb adding
   */
  protected abstract doAddBreadcrumb(breadcrumb: Breadcrumb): void

  /**
   * Helper to create monitoring event
   */
  protected createEvent(base: Partial<MonitoringEvent>): MonitoringEvent {
    const event: MonitoringEvent = {
      ...base,
      timestamp: Date.now(),
      tags: {
        environment: this.config?.environment || 'development',
        release: this.config?.release || 'unknown',
        ...base.tags
      }
    }

    if (this.userContext) {
      event.user = {
        id: this.userContext.id,
        ...this.userContext.data
      }
    }

    return event
  }
}
