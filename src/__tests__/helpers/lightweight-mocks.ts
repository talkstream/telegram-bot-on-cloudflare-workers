/**
 * Lightweight mocks for unit tests
 * These mocks avoid heavy initialization and memory usage
 */
import { vi } from 'vitest';

// Mock KV namespace with Map
export class MockKVNamespace {
  private store = new Map<string, string>();

  async get(key: string, _options?: unknown): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(_options?: unknown): Promise<Record<string, unknown>> {
    return {
      keys: Array.from(this.store.keys()).map((name) => ({ name })),
      list_complete: true,
      cacheStatus: null,
    };
  }

  clear(): void {
    this.store.clear();
  }
}

// Mock D1 database
export class MockD1Database {
  prepare = vi.fn(() => ({
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({
      success: true,
      meta: {},
      results: [],
    }),
    all: vi.fn().mockResolvedValue({
      success: true,
      meta: {},
      results: [],
    }),
  }));

  batch = vi.fn().mockResolvedValue([]);
  exec = vi.fn().mockResolvedValue({ count: 0, duration: 0 });
}

// Mock execution context
export class MockExecutionContext {
  private promises: Promise<unknown>[] = [];
  props: Record<string, unknown> = {};

  waitUntil(promise: Promise<unknown>): void {
    this.promises.push(promise);
  }

  passThroughOnException(): void {
    // No-op
  }

  async waitForAll(): Promise<void> {
    await Promise.all(this.promises);
    this.promises = [];
  }
}

// Factory functions for creating mocks
export function createMockEnv() {
  return {
    DB: new MockD1Database(),
    SESSIONS: new MockKVNamespace(),
    CACHE: new MockKVNamespace(),
    TELEGRAM_BOT_TOKEN: 'test-token',
    TELEGRAM_WEBHOOK_SECRET: 'test-secret',
    ENVIRONMENT: 'test',
  };
}

export function createMockContext() {
  return new MockExecutionContext();
}
