/**
 * Lightweight EventBus for vendor-agnostic communication
 */

type EventHandler = (...args: unknown[]) => void | Promise<void>

export class EventBus {
  private events: Map<string, Set<EventHandler>> = new Map()
  private maxListeners = 100

  on(event: string, handler: EventHandler): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set())
    }

    const handlers = this.events.get(event)
    if (!handlers) return
    if (handlers.size >= this.maxListeners) {
      console.warn(`Warning: Possible memory leak. ${event} has ${handlers.size} listeners`)
    }

    handlers.add(handler)
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.events.get(event)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.events.delete(event)
      }
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const handlers = this.events.get(event)
    if (handlers) {
      for (const handler of handlers) {
        try {
          const result = handler(...args)
          if (result instanceof Promise) {
            result.catch(error => {
              console.error(`Error in event handler for ${event}:`, error)
            })
          }
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error)
        }
      }
    }
  }

  async emitAsync(event: string, ...args: unknown[]): Promise<void> {
    const handlers = this.events.get(event)
    if (handlers) {
      const promises: Promise<void>[] = []
      for (const handler of handlers) {
        promises.push(Promise.resolve(handler(...args)))
      }
      await Promise.all(promises)
    }
  }

  once(event: string, handler: EventHandler): void {
    const wrapper = (...args: unknown[]) => {
      this.off(event, wrapper)
      return handler(...args)
    }
    this.on(event, wrapper)
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event)
    } else {
      this.events.clear()
    }
  }

  listenerCount(event: string): number {
    const handlers = this.events.get(event)
    return handlers ? handlers.size : 0
  }

  setMaxListeners(max: number): void {
    this.maxListeners = max
  }
}
