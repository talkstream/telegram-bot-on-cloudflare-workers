/**
 * Application context types
 */

import type { EventBus } from '../core/events/event-bus.js'

/**
 * Base application context
 */
export interface AppContext {
  /**
   * Event bus instance
   */
  eventBus?: EventBus

  /**
   * Request ID for tracing
   */
  requestId?: string

  /**
   * User session data
   */
  session?: Record<string, unknown>

  /**
   * Custom context data
   */
  [key: string]: unknown
}
