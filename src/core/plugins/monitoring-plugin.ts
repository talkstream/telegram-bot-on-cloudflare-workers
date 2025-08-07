/**
 * Monitoring Plugin for EventBus
 *
 * Automatically tracks all events and integrates with monitoring service
 */

import { EventBus } from '../events/event-bus'
import { AIEventType } from '../events/types/ai'
import { CommonEventType } from '../events/types/common'
import type {
  AICompletionFailedPayload,
  AICompletionSuccessPayload,
  CacheEventPayload,
  ErrorOccurredPayload,
  PaymentCompletedPayload,
  PaymentFailedPayload,
  PluginContext,
  PluginErrorPayload,
  PluginLoadedPayload,
  RequestCompletedPayload,
  RequestStartedPayload,
  SessionCreatedPayload,
  UserLoggedInPayload,
  UserRegisteredPayload
} from '../events/types/event-payloads'
import { PaymentEventType } from '../events/types/payment'
import { UserEventType } from '../events/types/user'
import type { IMonitoringConnector } from '../interfaces/monitoring'

import type { Plugin } from './plugin'

import { logger } from '@/lib/logger'

export interface MonitoringPluginConfig {
  monitoring: IMonitoringConnector
  eventBus: EventBus
  trackPerformance?: boolean
  trackErrors?: boolean
  trackCustomEvents?: boolean
  excludeEvents?: string[]
}

export class MonitoringPlugin implements Plugin {
  public readonly id: string
  public readonly name: string
  public readonly version: string
  public readonly description: string
  public readonly author: string
  public enabled: boolean
  private monitoring: IMonitoringConnector
  private eventBus: EventBus
  private config: MonitoringPluginConfig
  private performanceTracking: Map<string, number> = new Map()

  constructor(config: MonitoringPluginConfig) {
    this.id = 'monitoring-plugin'
    this.name = 'Monitoring Plugin'
    this.version = '1.0.0'
    this.description = 'Automatic event tracking and monitoring integration'
    this.author = 'Wireframe Team'
    this.enabled = true

    this.monitoring = config.monitoring
    this.eventBus = config.eventBus
    this.config = config
  }

  async install(_context: PluginContext): Promise<void> {
    // Subscribe to all event types
    this.subscribeToEvents()
    logger.info('Monitoring plugin installed')
  }

  async activate(): Promise<void> {
    this.subscribeToEvents()
    this.enabled = true
    logger.info('Monitoring plugin activated')
  }

  async deactivate(): Promise<void> {
    // Unsubscribe from events - need to track and remove specific listeners
    // For now, just log
    this.enabled = false
    logger.info('Monitoring plugin deactivated')
  }

  async uninstall(): Promise<void> {
    // Unsubscribe from events - need to track and remove specific listeners
    this.performanceTracking.clear()
    logger.info('Monitoring plugin uninstalled')
  }

  private subscribeToEvents(): void {
    // Track performance events
    if (this.config.trackPerformance !== false) {
      this.trackPerformanceEvents()
    }

    // Track error events
    if (this.config.trackErrors !== false) {
      this.trackErrorEvents()
    }

    // Track custom events
    if (this.config.trackCustomEvents !== false) {
      this.trackCustomEvents()
    }
  }

  private trackPerformanceEvents(): void {
    // Track request start/end for performance metrics
    this.eventBus.on(CommonEventType.REQUEST_STARTED, event => {
      const data = event.payload as RequestStartedPayload
      const requestId = data.requestId || `request-${Date.now()}`
      this.performanceTracking.set(requestId, Date.now())

      this.monitoring.trackEvent('request_started', {
        requestId,
        timestamp: Date.now()
      })
    })

    this.eventBus.on(CommonEventType.REQUEST_COMPLETED, event => {
      const data = event.payload as RequestCompletedPayload
      const requestId = data.requestId || `request-${Date.now()}`
      const startTime = this.performanceTracking.get(requestId)

      if (startTime) {
        const duration = Date.now() - startTime
        this.performanceTracking.delete(requestId)

        // Track performance metric
        this.monitoring.trackMetric('request_duration', duration, {
          requestId
        })

        // Track event
        this.monitoring.trackEvent('request_completed', {
          requestId,
          duration,
          timestamp: Date.now()
        })
      }
    })

    // Track AI completion performance
    this.eventBus.on(AIEventType.COMPLETION_SUCCESS, event => {
      const data = event.payload as AICompletionSuccessPayload
      if (data.latency) {
        this.monitoring.trackMetric('ai_completion_latency', data.latency, {
          provider: data.provider || 'unknown',
          model: data.model || 'unknown'
        })
      }

      if (data.tokens) {
        this.monitoring.trackMetric('ai_tokens_used', data.tokens, {
          provider: data.provider || 'unknown',
          model: data.model || 'unknown'
        })
      }
    })

    // Track payment processing time
    this.eventBus.on(PaymentEventType.PAYMENT_COMPLETED, event => {
      const data = event.payload as PaymentCompletedPayload
      if (data.processingTime) {
        this.monitoring.trackMetric('payment_processing_time', data.processingTime, {
          paymentType: data.type || 'unknown',
          amount: String(data.amount ?? 0)
        })
      }
    })
  }

  private trackErrorEvents(): void {
    // Track all error events
    this.eventBus.on(CommonEventType.ERROR_OCCURRED, event => {
      const data = event.payload as ErrorOccurredPayload
      const error = data.error instanceof Error ? data.error : new Error(String(data.error))

      this.monitoring.captureException(error, {
        context: data.context,
        timestamp: Date.now()
      })
    })

    // Track AI failures
    this.eventBus.on(AIEventType.COMPLETION_FAILED, event => {
      const data = event.payload as AICompletionFailedPayload
      const error = data.error instanceof Error ? data.error : new Error(String(data.error))

      this.monitoring.captureException(error, {
        provider: data.provider,
        model: data.model,
        timestamp: Date.now()
      })
    })

    // Track payment failures
    this.eventBus.on(PaymentEventType.PAYMENT_FAILED, event => {
      const data = event.payload as PaymentFailedPayload
      const error = data.error instanceof Error ? data.error : new Error(String(data.error))

      this.monitoring.captureException(error, {
        paymentType: data.type,
        amount: data.amount,
        timestamp: Date.now()
      })
    })

    // Track plugin errors
    this.eventBus.on(CommonEventType.PLUGIN_ERROR, event => {
      const data = event.payload as PluginErrorPayload
      const error = data.error instanceof Error ? data.error : new Error(String(data.error))

      this.monitoring.captureException(error, {
        pluginId: data.pluginId,
        timestamp: Date.now()
      })
    })
  }

  private trackCustomEvents(): void {
    // Track user events
    this.eventBus.on(UserEventType.USER_REGISTERED, event => {
      const data = event.payload as UserRegisteredPayload
      if (this.shouldTrackEvent(UserEventType.USER_REGISTERED)) {
        this.monitoring.trackEvent('user_registered', {
          userId: data.userId,
          timestamp: Date.now()
        })
      }
    })

    this.eventBus.on(UserEventType.USER_LOGGED_IN, event => {
      const data = event.payload as UserLoggedInPayload
      if (this.shouldTrackEvent(UserEventType.USER_LOGGED_IN)) {
        this.monitoring.trackEvent('user_logged_in', {
          userId: data.userId,
          timestamp: Date.now()
        })

        // Set user context for future events
        if (data.userId) {
          this.monitoring.setUserContext(String(data.userId), {
            username: data.username,
            email: data.email
          })
        }
      }
    })

    // Track plugin lifecycle
    this.eventBus.on(CommonEventType.PLUGIN_LOADED, event => {
      const data = event.payload as PluginLoadedPayload
      if (this.shouldTrackEvent(CommonEventType.PLUGIN_LOADED)) {
        this.monitoring.trackEvent('plugin_loaded', {
          pluginId: data.pluginId,
          version: data.version,
          timestamp: Date.now()
        })
      }
    })

    // Track session events
    this.eventBus.on(CommonEventType.SESSION_CREATED, event => {
      const data = event.payload as SessionCreatedPayload
      if (this.shouldTrackEvent(CommonEventType.SESSION_CREATED)) {
        this.monitoring.trackEvent('session_created', {
          sessionId: data.sessionId,
          userId: data.userId,
          timestamp: Date.now()
        })
      }
    })

    // Track cache events for performance insights
    this.eventBus.on(CommonEventType.CACHE_HIT, event => {
      const data = event.payload as CacheEventPayload
      if (this.shouldTrackEvent(CommonEventType.CACHE_HIT)) {
        this.monitoring.trackMetric('cache_hit', 1, {
          key: data.key
        })
      }
    })

    this.eventBus.on(CommonEventType.CACHE_MISS, event => {
      const data = event.payload as CacheEventPayload
      if (this.shouldTrackEvent(CommonEventType.CACHE_MISS)) {
        this.monitoring.trackMetric('cache_miss', 1, {
          key: data.key
        })
      }
    })
  }

  private shouldTrackEvent(eventType: string): boolean {
    return !this.config.excludeEvents?.includes(eventType)
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    activeRequests: number
    averageResponseTime?: number
  } {
    return {
      activeRequests: this.performanceTracking.size
    }
  }

  /**
   * Clear performance tracking data
   */
  clearPerformanceData(): void {
    this.performanceTracking.clear()
  }
}

/**
 * Factory function to create and install monitoring plugin
 */
export function createMonitoringPlugin(
  monitoring: IMonitoringConnector,
  eventBus: EventBus,
  config?: Partial<MonitoringPluginConfig>
): MonitoringPlugin {
  const plugin = new MonitoringPlugin({
    monitoring,
    eventBus,
    ...config
  })

  // Auto-install the plugin
  plugin.install({}).catch((error: unknown) => {
    console.error('Failed to install monitoring plugin:', error)
  })

  return plugin
}
