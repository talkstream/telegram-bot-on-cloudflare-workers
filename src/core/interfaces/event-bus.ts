/**
 * Event Bus interface for inter-component communication
 */

export interface IEventBus {
  /**
   * Emit an event
   */
  emit(event: string, data?: unknown): void;

  /**
   * Subscribe to an event
   */
  on(event: string, handler: EventHandler): void;

  /**
   * Unsubscribe from an event
   */
  off(event: string, handler: EventHandler): void;

  /**
   * Subscribe to an event once
   */
  once(event: string, handler: EventHandler): void;
}

export type EventHandler = (data: unknown) => void | Promise<void>;
