/**
 * Async testing utilities
 */

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options?: {
    timeout?: number;
    interval?: number;
    message?: string;
  },
): Promise<void> {
  const timeout = options?.timeout ?? 5000;
  const interval = options?.interval ?? 50;
  const message = options?.message ?? 'Condition not met';

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }

  throw new Error(`Timeout: ${message}`);
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a deferred promise
 */
export interface DeferredPromise<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

export function createDeferred<T>(): DeferredPromise<T> {
  let resolve: (value: T) => void;
  let reject: (error: Error) => void;

  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });

  return { promise, resolve: resolve!, reject: reject! };
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
    onError?: (error: Error, attempt: number) => void;
  },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const initialDelay = options?.initialDelay ?? 100;
  const maxDelay = options?.maxDelay ?? 5000;
  const factor = options?.factor ?? 2;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (options?.onError) {
        options.onError(lastError, attempt);
      }

      if (attempt < maxAttempts) {
        const delay = Math.min(initialDelay * Math.pow(factor, attempt - 1), maxDelay);
        await sleep(delay);
      }
    }
  }

  throw lastError!;
}

/**
 * Run functions in parallel with concurrency limit
 */
export async function parallelLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  const executing: Set<Promise<void>> = new Set();

  for (const [index, task] of tasks.entries()) {
    const promise = task()
      .then((result) => {
        results[index] = result;
        return result;
      })
      .finally(() => {
        executing.delete(promise);
      });

    executing.add(promise);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Create a timeout wrapper for promises
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string,
): Promise<T> {
  return Promise.race([
    promise,
    sleep(timeoutMs).then(() => {
      throw new Error(errorMessage ?? `Operation timed out after ${timeoutMs}ms`);
    }),
  ]);
}

/**
 * Event emitter for testing async flows
 */
export class TestEventEmitter<T extends Record<string, unknown[]>> {
  private listeners = new Map<keyof T, Array<(...args: any[]) => void>>();
  private eventHistory: Array<{ event: keyof T; args: unknown[]; timestamp: number }> = [];

  on<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void {
    const listeners = this.listeners.get(event) || [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  emit<K extends keyof T>(event: K, ...args: T[K]): void {
    this.eventHistory.push({
      event,
      args,
      timestamp: Date.now(),
    });

    const listeners = this.listeners.get(event) || [];
    for (const listener of listeners) {
      listener(...args);
    }
  }

  async waitForEvent<K extends keyof T>(event: K, timeout = 5000): Promise<T[K]> {
    return withTimeout(
      new Promise<T[K]>((resolve) => {
        this.on(event, (...args: T[K]) => resolve(args));
      }),
      timeout,
      `Timeout waiting for event: ${String(event)}`,
    );
  }

  getEventHistory() {
    return this.eventHistory;
  }

  clearHistory() {
    this.eventHistory = [];
  }

  removeAllListeners() {
    this.listeners.clear();
  }
}

/**
 * Async queue for testing sequential operations
 */
export class AsyncQueue<T> {
  private queue: T[] = [];
  private waiters: Array<(value: T) => void> = [];

  push(item: T): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(item);
    } else {
      this.queue.push(item);
    }
  }

  async pop(): Promise<T> {
    const item = this.queue.shift();
    if (item !== undefined) {
      return item;
    }

    return new Promise<T>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
    this.waiters = [];
  }
}
