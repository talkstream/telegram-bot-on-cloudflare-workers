/**
 * Event Bus for inter-component communication
 */

export interface Event<T = unknown> {
  /**
   * Event type/name
   */
  type: string

  /**
   * Event payload
   */
  payload: T

  /**
   * Event source identifier
   */
  source: string

  /**
   * Event timestamp
   */
  timestamp: number

  /**
   * Event ID for tracking
   */
  id?: string

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>
}

export type EventHandler<T = unknown> = (event: Event<T>) => void | Promise<void>
export type EventFilter<T = unknown> = (event: Event<T>) => boolean
export type Unsubscribe = () => void

export interface EventBusOptions {
  /**
   * Enable async event handling
   */
  async?: boolean

  /**
   * Maximum listeners per event type
   */
  maxListeners?: number

  /**
   * Enable debug logging
   */
  debug?: boolean

  /**
   * Error handler for async events
   */
  errorHandler?: (error: Error, event: Event) => void
}

export class EventBus {
  private listeners: Map<string, Set<EventHandler>>
  private wildcardListeners: Set<EventHandler>
  private options: Required<EventBusOptions>
  private eventHistory: Event[]
  private maxHistorySize = 1000

  constructor(options: EventBusOptions = {}) {
    this.listeners = new Map()
    this.wildcardListeners = new Set()
    this.eventHistory = []

    this.options = {
      async: options.async ?? true,
      maxListeners: options.maxListeners ?? 100,
      debug: options.debug ?? false,
      errorHandler: options.errorHandler ?? this.defaultErrorHandler
    }
  }

  /**
   * Emit an event
   */
  emit<T>(type: string, payload: T, source: string, metadata?: Record<string, unknown>): void {
    const event: Event<T> = {
      type,
      payload,
      source,
      timestamp: Date.now(),
      id: this.generateEventId(),
      ...(metadata && { metadata })
    }

    this.addToHistory(event)

    if (this.options.debug) {
      console.info('[EventBus] Emitting event:', event)
    }

    // Notify specific listeners
    const listeners = this.listeners.get(type)
    if (listeners) {
      this.notifyListeners(Array.from(listeners), event)
    }

    // Notify wildcard listeners
    if (this.wildcardListeners.size > 0) {
      this.notifyListeners(Array.from(this.wildcardListeners), event)
    }
  }

  /**
   * Subscribe to specific event type
   */
  on<T = unknown>(type: string, handler: EventHandler<T>): Unsubscribe {
    this.validateEventType(type)
    this.validateHandler(handler as EventHandler)

    let listeners = this.listeners.get(type)
    if (!listeners) {
      listeners = new Set()
      this.listeners.set(type, listeners)
    }

    if (listeners.size >= this.options.maxListeners) {
      console.warn(
        `[EventBus] Maximum listeners (${this.options.maxListeners}) reached for event type: ${type}`
      )
    }

    // Type-safe handler storage - we store untyped handlers internally
    // but expose typed interface through generic methods
    listeners.add(handler as EventHandler)

    return () => {
      listeners?.delete(handler as EventHandler)
      if (listeners?.size === 0) {
        this.listeners.delete(type)
      }
    }
  }

  /**
   * Subscribe to all events
   */
  onAny(handler: EventHandler): Unsubscribe {
    this.validateHandler(handler)
    this.wildcardListeners.add(handler)

    return () => {
      this.wildcardListeners.delete(handler)
    }
  }

  /**
   * Subscribe to event type once
   */
  once<T>(type: string, handler: EventHandler<T>): Unsubscribe {
    const wrappedHandler: EventHandler<T> = event => {
      unsubscribe()
      handler(event)
    }

    const unsubscribe = this.on(type, wrappedHandler)
    return unsubscribe
  }

  /**
   * Unsubscribe from specific event type
   */
  off(type?: string, handler?: EventHandler): void {
    if (!type) {
      // Clear all listeners
      this.listeners.clear()
      this.wildcardListeners.clear()
      return
    }

    if (!handler) {
      // Clear all listeners for specific type
      this.listeners.delete(type)
      return
    }

    // Remove specific handler
    const listeners = this.listeners.get(type)
    if (listeners) {
      listeners.delete(handler)
      if (listeners.size === 0) {
        this.listeners.delete(type)
      }
    }
  }

  /**
   * Wait for a specific event
   */
  waitFor<T>(type: string, filter?: EventFilter<T>, timeout?: number): Promise<Event<T>> {
    return new Promise((resolve, reject) => {
      const timer = timeout
        ? setTimeout(() => {
            unsubscribe()
            reject(new Error(`Timeout waiting for event: ${type}`))
          }, timeout)
        : null

      const unsubscribe = this.on<T>(type, event => {
        if (!filter || filter(event)) {
          if (timer) clearTimeout(timer)
          unsubscribe()
          resolve(event)
        }
      })
    })
  }

  /**
   * Get event history
   */
  getHistory(filter?: { type?: string; source?: string; since?: number; limit?: number }): Event[] {
    let events = [...this.eventHistory]

    if (filter?.type) {
      events = events.filter(e => e.type === filter.type)
    }

    if (filter?.source) {
      events = events.filter(e => e.source === filter.source)
    }

    if (filter?.since !== undefined) {
      const since = filter.since
      events = events.filter(e => e.timestamp >= since)
    }

    if (filter?.limit) {
      events = events.slice(-filter.limit)
    }

    return events
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = []
  }

  /**
   * Get listener count
   */
  listenerCount(type?: string): number {
    if (!type) {
      let total = this.wildcardListeners.size
      this.listeners.forEach(listeners => {
        total += listeners.size
      })
      return total
    }

    const listeners = this.listeners.get(type)
    return listeners ? listeners.size : 0
  }

  /**
   * Get all event types with listeners
   */
  eventTypes(): string[] {
    return Array.from(this.listeners.keys())
  }

  /**
   * Create a scoped event bus
   */
  scope(prefix: string): ScopedEventBus {
    return new ScopedEventBus(this, prefix)
  }

  /**
   * Notify listeners about an event
   */
  private notifyListeners(listeners: EventHandler[], event: Event): void {
    if (this.options.async) {
      // Async notification
      listeners.forEach(handler => {
        Promise.resolve()
          .then(() => handler(event))
          .catch(error => this.options.errorHandler(error, event))
      })
    } else {
      // Sync notification
      listeners.forEach(handler => {
        try {
          handler(event)
        } catch (error) {
          this.options.errorHandler(error as Error, event)
        }
      })
    }
  }

  /**
   * Add event to history
   */
  private addToHistory(event: Event): void {
    this.eventHistory.push(event)
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift()
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Validate event type
   */
  private validateEventType(type: string): void {
    if (!type || typeof type !== 'string') {
      throw new Error('Event type must be a non-empty string')
    }
  }

  /**
   * Validate event handler
   */
  private validateHandler(handler: EventHandler): void {
    if (typeof handler !== 'function') {
      throw new Error('Event handler must be a function')
    }
  }

  /**
   * Default error handler
   */
  private defaultErrorHandler(error: Error, event: Event): void {
    console.error('[EventBus] Error in event handler:', {
      error: error.message,
      event,
      stack: error.stack
    })
  }
}

/**
 * Scoped event bus for namespaced events
 */
export class ScopedEventBus {
  constructor(
    private parent: EventBus,
    private prefix: string
  ) {}

  emit<T>(type: string, payload: T, source: string, metadata?: Record<string, unknown>): void {
    this.parent.emit(`${this.prefix}:${type}`, payload, source, metadata)
  }

  on<T>(type: string, handler: EventHandler<T>): Unsubscribe {
    return this.parent.on(`${this.prefix}:${type}`, handler)
  }

  once<T>(type: string, handler: EventHandler<T>): Unsubscribe {
    return this.parent.once(`${this.prefix}:${type}`, handler)
  }

  off(type?: string, handler?: EventHandler): void {
    if (type) {
      this.parent.off(`${this.prefix}:${type}`, handler)
    }
  }

  waitFor<T>(type: string, filter?: EventFilter<T>, timeout?: number): Promise<Event<T>> {
    return this.parent.waitFor(`${this.prefix}:${type}`, filter, timeout)
  }
}

/**
 * Global event bus instance
 */
export const globalEventBus = new EventBus({
  async: true,
  debug: process.env.NODE_ENV === 'development'
})

/**
 * Common event types
 */
export enum CommonEventType {
  // System events
  SYSTEM_STARTUP = 'system:startup',
  SYSTEM_SHUTDOWN = 'system:shutdown',
  SYSTEM_ERROR = 'system:error',

  // Connector events
  CONNECTOR_REGISTERED = 'connector:registered',
  CONNECTOR_INITIALIZED = 'connector:initialized',
  CONNECTOR_ERROR = 'connector:error',
  CONNECTOR_DESTROYED = 'connector:destroyed',

  // Message events
  MESSAGE_RECEIVED = 'message:received',
  MESSAGE_SENT = 'message:sent',
  MESSAGE_EDITED = 'message:edited',
  MESSAGE_DELETED = 'message:deleted',

  // Command events
  COMMAND_EXECUTED = 'command:executed',
  COMMAND_ERROR = 'command:error',

  // User events
  USER_JOINED = 'user:joined',
  USER_LEFT = 'user:left',
  USER_UPDATED = 'user:updated',

  // Plugin events
  PLUGIN_LOADED = 'plugin:loaded',
  PLUGIN_ACTIVATED = 'plugin:activated',
  PLUGIN_DEACTIVATED = 'plugin:deactivated',
  PLUGIN_ERROR = 'plugin:error'
}
