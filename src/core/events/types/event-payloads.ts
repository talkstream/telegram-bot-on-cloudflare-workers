/**
 * Type-safe event payload definitions
 */

// Common event payloads
export interface RequestStartedPayload {
  requestId: string
  method?: string
  path?: string
  type?: string
  updateType?: string
  userId?: string
  timestamp?: number
}

export interface RequestCompletedPayload {
  requestId: string
  method?: string
  path?: string
  status?: number
  duration: number
  type?: string
  updateType?: string
  userId?: string
  timestamp?: number
}

export interface ErrorOccurredPayload {
  requestId?: string
  error: Error | string
  context?: Record<string, unknown>
}

export interface SessionCreatedPayload {
  sessionId: string
  userId: string
  timestamp?: number
}

export interface CacheEventPayload {
  key: string
}

export interface PluginLoadedPayload {
  pluginId?: string
  version?: string
  message?: string
}

export interface PluginErrorPayload {
  pluginId?: string
  error: Error | string
}

// AI event payloads
export interface AICompletionStartedPayload {
  requestId: string
  provider: string
  model: string
}

export interface AICompletionSuccessPayload {
  requestId?: string
  provider?: string
  model?: string
  latency?: number
  tokens?: number
  cost?: number
}

export interface AICompletionFailedPayload {
  requestId?: string
  provider?: string
  model?: string
  error: Error | string
  latency?: number
}

// Payment event payloads
export interface PaymentCompletedPayload {
  processingTime?: number
  type?: string
  amount?: number
}

export interface PaymentFailedPayload {
  type?: string
  amount?: number
  error: Error | string
}

// User event payloads
export interface UserRegisteredPayload {
  userId: string
  timestamp?: number
}

export interface UserLoggedInPayload {
  userId: string
  username?: string
  email?: string
  timestamp?: number
}

// Plugin context type
export interface PluginContext {
  eventBus?: unknown
  services?: unknown
  config?: unknown
}
