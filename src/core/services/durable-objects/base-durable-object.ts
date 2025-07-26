/**
 * Base implementation for Durable Objects
 */

import type {
  IDurableObject,
  IDurableObjectState,
  DurableObjectStorage,
  DurableObjectListOptions,
} from '../../interfaces/durable-objects';

/**
 * Base class for all Durable Objects
 * Provides common functionality and state management
 */
export abstract class BaseDurableObject implements IDurableObject {
  protected state: IDurableObjectState;
  protected env: unknown;
  protected initialized = false;

  constructor(state: IDurableObjectState, env: unknown) {
    this.state = state;
    this.env = env;
  }

  /**
   * Initialize the Durable Object
   * Override this method to perform setup tasks
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Perform any common initialization
    this.initialized = true;

    // Call child class initialization
    await this.onInitialize();
  }

  /**
   * Override this method in child classes for custom initialization
   */
  protected async onInitialize(): Promise<void> {
    // Default: no-op
  }

  /**
   * Handle HTTP requests to the Durable Object
   */
  abstract fetch(request: Request): Promise<Response>;

  /**
   * Clean up resources when the object is being evicted
   */
  async cleanup(): Promise<void> {
    await this.onCleanup();
  }

  /**
   * Override this method in child classes for custom cleanup
   */
  protected async onCleanup(): Promise<void> {
    // Default: no-op
  }

  /**
   * Helper method to get data from storage
   */
  protected async get<T = unknown>(key: string): Promise<T | undefined> {
    return this.state.get<T>(key);
  }

  /**
   * Helper method to get multiple values from storage
   */
  protected async getMultiple<T = unknown>(keys: string[]): Promise<Map<string, T>> {
    return this.state.get<T>(keys);
  }

  /**
   * Helper method to set data in storage
   */
  protected async put<T = unknown>(key: string, value: T): Promise<void> {
    return this.state.put(key, value);
  }

  /**
   * Helper method to set multiple values in storage
   */
  protected async putMultiple<T = unknown>(entries: Record<string, T>): Promise<void> {
    return this.state.put(entries);
  }

  /**
   * Helper method to delete data from storage
   */
  protected async delete(key: string): Promise<boolean> {
    return this.state.delete(key);
  }

  /**
   * Helper method to delete multiple values from storage
   */
  protected async deleteMultiple(keys: string[]): Promise<number> {
    return this.state.delete(keys);
  }

  /**
   * Helper method to list keys in storage
   */
  protected async list<T = unknown>(options?: DurableObjectListOptions): Promise<Map<string, T>> {
    return this.state.list<T>(options);
  }

  /**
   * Block concurrent operations
   */
  protected async blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
    return this.state.blockConcurrencyWhile(callback);
  }

  /**
   * Create a JSON response
   */
  protected json(data: unknown, init?: ResponseInit): Response {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
  }

  /**
   * Create an error response
   */
  protected error(message: string, status = 500): Response {
    return this.json({ error: message }, { status });
  }

  /**
   * Create a success response
   */
  protected success(data?: unknown, status = 200): Response {
    return this.json({ success: true, ...data }, { status });
  }
}

/**
 * Simple state wrapper for non-Cloudflare environments (testing)
 */
export class SimpleState implements IDurableObjectState {
  private data = new Map<string, unknown>();
  storage: DurableObjectStorage;

  constructor() {
    this.storage = this.createStorage();
  }

  async get<T = unknown>(key: string): Promise<T | undefined>;
  async get<T = unknown>(keys: string[]): Promise<Map<string, T>>;
  async get<T = unknown>(keyOrKeys: string | string[]): Promise<T | undefined | Map<string, T>> {
    if (typeof keyOrKeys === 'string') {
      return this.data.get(keyOrKeys) as T | undefined;
    }

    const result = new Map<string, T>();
    for (const key of keyOrKeys) {
      const value = this.data.get(key);
      if (value !== undefined) {
        result.set(key, value as T);
      }
    }
    return result;
  }

  async put<T = unknown>(key: string, value: T): Promise<void>;
  async put<T = unknown>(entries: Record<string, T>): Promise<void>;
  async put<T = unknown>(keyOrEntries: string | Record<string, T>, value?: T): Promise<void> {
    if (typeof keyOrEntries === 'string') {
      this.data.set(keyOrEntries, value);
    } else {
      for (const [k, v] of Object.entries(keyOrEntries)) {
        this.data.set(k, v);
      }
    }
  }

  async delete(key: string): Promise<boolean>;
  async delete(keys: string[]): Promise<number>;
  async delete(keyOrKeys: string | string[]): Promise<boolean | number> {
    if (typeof keyOrKeys === 'string') {
      return this.data.delete(keyOrKeys);
    }

    let count = 0;
    for (const key of keyOrKeys) {
      if (this.data.delete(key)) {
        count++;
      }
    }
    return count;
  }

  async list<T = unknown>(options?: DurableObjectListOptions): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    let entries = Array.from(this.data.entries());

    // Apply prefix filter
    if (options?.prefix) {
      entries = entries.filter(([key]) => key.startsWith(options.prefix));
    }

    // Apply start/end filters
    if (options?.start) {
      entries = entries.filter(([key]) => key >= options.start);
    }
    if (options?.startAfter) {
      entries = entries.filter(([key]) => key > options.startAfter);
    }
    if (options?.end) {
      entries = entries.filter(([key]) => key < options.end);
    }

    // Sort
    entries.sort((a, b) => {
      const cmp = a[0].localeCompare(b[0]);
      return options?.reverse ? -cmp : cmp;
    });

    // Apply limit
    if (options?.limit) {
      entries = entries.slice(0, options.limit);
    }

    // Build result
    for (const [key, value] of entries) {
      result.set(key, value as T);
    }

    return result;
  }

  async blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
    // In testing, just execute directly
    return callback();
  }

  private createStorage(): DurableObjectStorage {
    const state = this;
    return {
      get: state.get.bind(state),
      put: state.put.bind(state),
      delete: state.delete.bind(state),
      list: state.list.bind(state),
      async deleteAll() {
        state.data.clear();
      },
      async sync() {
        // No-op in testing
      },
      async transaction<T>(closure: (txn: DurableObjectStorage) => Promise<T>): Promise<T> {
        // Simple transaction simulation
        const snapshot = new Map(state.data);
        try {
          return await closure({
            get: state.get.bind(state),
            put: state.put.bind(state),
            delete: state.delete.bind(state),
            rollback() {
              state.data = snapshot;
            },
          });
        } catch (error) {
          state.data = snapshot;
          throw error;
        }
      },
    } as DurableObjectStorage;
  }
}
