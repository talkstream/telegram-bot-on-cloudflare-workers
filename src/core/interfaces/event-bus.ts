/**
 * Event bus interface for decoupled communication
 */

export interface EventBusEvents {
  [key: string]: unknown
}

export interface IEventBus {
  /**
   * Emit an event
   */
  emit<K extends keyof EventBusEvents>(event: K, data: EventBusEvents[K]): void
  emit(event: string, data: unknown): void

  /**
   * Subscribe to an event
   */
  on<K extends keyof EventBusEvents>(event: K, handler: (data: EventBusEvents[K]) => void): void
  on(event: string, handler: (data: unknown) => void): void

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof EventBusEvents>(event: K, handler: (data: EventBusEvents[K]) => void): void
  off(event: string, handler: (data: unknown) => void): void

  /**
   * Subscribe to an event once
   */
  once<K extends keyof EventBusEvents>(event: K, handler: (data: EventBusEvents[K]) => void): void
  once(event: string, handler: (data: unknown) => void): void
}
