/**
 * Platform-agnostic monitoring interfaces
 */

export interface IMonitoringConnector {
  /**
   * Initialize monitoring with configuration
   */
  initialize(config: MonitoringConfig): Promise<void>

  /**
   * Capture an exception
   */
  captureException(error: Error, context?: Record<string, unknown>): void

  /**
   * Capture a message
   */
  captureMessage(message: string, level?: 'debug' | 'info' | 'warning' | 'error'): void

  /**
   * Set user context
   */
  setUserContext(userId: string, data?: Record<string, unknown>): void

  /**
   * Clear user context
   */
  clearUserContext(): void

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb: Breadcrumb): void

  /**
   * Track custom event
   */
  trackEvent(name: string, data?: Record<string, unknown>): void

  /**
   * Track metric
   */
  trackMetric(name: string, value: number, tags?: Record<string, string>): void

  /**
   * Flush pending events
   */
  flush(timeout?: number): Promise<boolean>

  /**
   * Check if monitoring is available
   */
  isAvailable(): boolean
}

export interface MonitoringConfig {
  dsn?: string
  environment?: string
  release?: string
  sampleRate?: number
  beforeSend?: (event: MonitoringEvent) => MonitoringEvent | null
  integrations?: unknown[]
  platform?: 'cloudflare' | 'aws' | 'gcp' | 'node'
}

export interface MonitoringEvent {
  message?: string
  level?: string
  logger?: string
  tags?: Record<string, string>
  extra?: Record<string, unknown>
  user?: {
    id?: string
    username?: string
    email?: string
    [key: string]: unknown
  }
  request?: {
    url?: string
    method?: string
    headers?: Record<string, string>
    data?: unknown
  }
  exception?: {
    type?: string
    value?: string
    stacktrace?: unknown
  }
  timestamp?: number
}

export interface Breadcrumb {
  message: string
  category?: string
  level?: 'debug' | 'info' | 'warning' | 'error'
  type?: 'default' | 'http' | 'navigation' | 'user'
  data?: Record<string, unknown>
  timestamp?: number
}

/**
 * Factory for creating monitoring connectors
 */
export interface IMonitoringFactory {
  /**
   * Create monitoring connector for specific provider
   */
  create(
    provider: 'sentry' | 'datadog' | 'newrelic' | 'custom',
    config: MonitoringConfig
  ): IMonitoringConnector
}
