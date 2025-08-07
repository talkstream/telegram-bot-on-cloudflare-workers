/**
 * Analytics Types
 * Proper type definitions for analytics system
 */

// Event types
export interface AnalyticsEvent {
  type: string
  timestamp: number
  data?: Record<string, unknown>
  userId?: string
  sessionId?: string
  metadata?: Record<string, unknown>
}

export interface ErrorEvent extends AnalyticsEvent {
  type: 'error'
  error: {
    message: string
    stack?: string
    code?: string
  }
  context?: Record<string, unknown>
}

export interface PageViewEvent extends AnalyticsEvent {
  type: 'page_view'
  path: string
  referrer?: string
  userAgent?: string
}

export interface PerformanceEvent extends AnalyticsEvent {
  type: 'performance'
  metric: string
  value: number
  unit?: string
}

export interface UserEvent extends AnalyticsEvent {
  userId: string
  action: string
  properties?: Record<string, unknown>
}

// Config types
export interface AsyncAnalyticsConfig {
  endpoint?: string
  apiKey?: string
  batching?: boolean
  batchSize?: number
  flushInterval?: number
  debug?: boolean
  analyticsEngine?: AnalyticsEngineDataset
}

export interface AnalyticsEngineDataset {
  writeDataPoint: (data: AnalyticsEngineData) => void
}

export interface AnalyticsEngineData {
  blobs?: string[]
  doubles?: number[]
  indexes?: string[]
}

// Factory types
export interface AnalyticsEnvironment {
  ANALYTICS_ENDPOINT?: string
  ANALYTICS_API_KEY?: string
  ANALYTICS_ENGINE?: AnalyticsEngineDataset
  DEBUG?: string
}

// Export a union type for all event types
export type AnyAnalyticsEvent =
  | AnalyticsEvent
  | ErrorEvent
  | PageViewEvent
  | PerformanceEvent
  | UserEvent
