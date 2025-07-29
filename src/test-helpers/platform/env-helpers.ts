import { vi } from 'vitest';
import type {
  ExecutionContext,
  ScheduledController,
  DurableObjectNamespace,
} from '@cloudflare/workers-types';

import { createMockD1Database } from '../database/d1-helpers.js';
import { createMockKVNamespace } from '../storage/kv-helpers.js';

/**
 * Comprehensive environment mock for Cloudflare Workers
 */
export interface MockWorkerEnv {
  // Core services
  DB?: ReturnType<typeof createMockD1Database>;
  KV?: ReturnType<typeof createMockKVNamespace>;
  CACHE?: ReturnType<typeof createMockKVNamespace>;
  QUEUE?: MockQueue;
  DURABLE_OBJECTS?: Record<string, MockDurableObjectNamespace>;

  // Environment variables
  [key: string]: unknown;
}

/**
 * Create a mock worker environment with all services
 */
export function createMockWorkerEnv(overrides?: Partial<MockWorkerEnv>): MockWorkerEnv {
  return {
    // Default services
    DB: createMockD1Database(),
    KV: createMockKVNamespace(),
    CACHE: createMockKVNamespace(),
    QUEUE: createMockQueue(),

    // Default environment variables
    ENVIRONMENT: 'test',
    LOG_LEVEL: 'debug',
    API_URL: 'https://api.test.com',
    WEBHOOK_SECRET: 'test-webhook-secret',

    // Apply overrides
    ...overrides,
  };
}

/**
 * Mock Queue implementation
 */
export interface MockQueue {
  send: ReturnType<typeof vi.fn>;
  sendBatch: ReturnType<typeof vi.fn>;
  _messages: Array<{ body: unknown; timestamp: number }>;
  _reset: () => void;
}

export function createMockQueue(): MockQueue {
  const messages: Array<{ body: unknown; timestamp: number }> = [];

  return {
    send: vi.fn(async (message: unknown) => {
      messages.push({ body: message, timestamp: Date.now() });
    }),

    sendBatch: vi.fn(async (batch: Array<{ body: unknown }>) => {
      const timestamp = Date.now();
      for (const item of batch) {
        messages.push({ body: item.body, timestamp });
      }
    }),

    _messages: messages,
    _reset: () => {
      messages.length = 0;
      vi.clearAllMocks();
    },
  };
}

/**
 * Mock Execution Context
 */
export function createMockExecutionContext(): ExecutionContext {
  const promises: Promise<unknown>[] = [];

  const ctx = {
    waitUntil: vi.fn((promise: Promise<unknown>) => {
      promises.push(promise);
    }),

    passThroughOnException: vi.fn(),

    // Test helper
    _promises: promises,

    // Add missing ExecutionContext properties
    props: {} as Record<string, unknown>,
  };

  return ctx as ExecutionContext & { _promises: Promise<unknown>[] };
}

/**
 * Mock Scheduled Controller
 */
export function createMockScheduledController(
  options?: Partial<ScheduledController>,
): ScheduledController {
  return {
    scheduledTime: options?.scheduledTime ?? Date.now(),
    cron: options?.cron ?? '0 * * * *',
    ...options,
  } as ScheduledController;
}

/**
 * Mock Durable Object
 */
export interface MockDurableObjectNamespace extends DurableObjectNamespace {
  _stubs: Map<string, MockDurableObjectStub>;
}

export function createMockDurableObjectNamespace(): MockDurableObjectNamespace {
  const stubs = new Map<string, MockDurableObjectStub>();

  return {
    newUniqueId: vi.fn(() => {
      return {
        toString: () => `mock-id-${Date.now()}-${Math.random()}`,
      } as DurableObjectId;
    }),

    idFromName: vi.fn((name: string) => {
      return {
        toString: () => `mock-id-from-${name}`,
      } as DurableObjectId;
    }),

    idFromString: vi.fn((id: string) => {
      return {
        toString: () => id,
      } as DurableObjectId;
    }),

    get: vi.fn((id: DurableObjectId) => {
      const idString = id.toString();
      if (!stubs.has(idString)) {
        stubs.set(idString, createMockDurableObjectStub(idString));
      }
      const stub = stubs.get(idString);
      if (!stub) throw new Error(`Stub not found for id: ${idString}`);
      return stub;
    }),

    jurisdiction: vi.fn(() => {
      // Return the same namespace - jurisdiction is just a hint in tests
      return createMockDurableObjectNamespace();
    }),

    _stubs: stubs,
  } as MockDurableObjectNamespace;
}

export interface MockDurableObjectStub {
  id: DurableObjectId;
  name?: string;
  fetch: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  _storage: Map<string, unknown>;
  _id: string;
}

function createMockDurableObjectStub(id: string): MockDurableObjectStub {
  const storage = new Map<string, unknown>();

  return {
    fetch: vi.fn(async (request: Request) => {
      // Simple storage operations via fetch
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === '/get') {
        const key = url.searchParams.get('key');
        const value = key ? storage.get(key) : null;
        return new Response(JSON.stringify({ value }));
      }

      if (path === '/put' && request.method === 'POST') {
        const { key, value } = (await request.json()) as { key: string; value: unknown };
        storage.set(key, value);
        return new Response(JSON.stringify({ success: true }));
      }

      if (path === '/delete' && request.method === 'POST') {
        const { key } = (await request.json()) as { key: string };
        storage.delete(key);
        return new Response(JSON.stringify({ success: true }));
      }

      return new Response('Not found', { status: 404 });
    }),

    connect: vi.fn(() => {
      // Return a mock Socket for WebSocket connections
      return {
        close: vi.fn(),
        send: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as WebSocket;
    }),

    id: {
      toString: () => id,
      equals: (other: DurableObjectId) => other.toString() === id,
    } as DurableObjectId,
    name: undefined,
    _storage: storage,
    _id: id,
  };
}

/**
 * Environment variable helpers
 */
export class EnvTestUtils {
  /**
   * Create a type-safe environment getter
   */
  static createEnvGetter<T extends Record<string, unknown>>(env: T) {
    return {
      get<K extends keyof T>(key: K): T[K] {
        return env[key];
      },

      getRequired<K extends keyof T>(key: K): NonNullable<T[K]> {
        const value = env[key];
        if (value === null || value === undefined) {
          throw new Error(`Missing required environment variable: ${String(key)}`);
        }
        return value as NonNullable<T[K]>;
      },

      getOrDefault<K extends keyof T, D>(key: K, defaultValue: D): T[K] | D {
        const value = env[key];
        return value !== null && value !== undefined ? value : defaultValue;
      },
    };
  }

  /**
   * Create environment validators
   */
  static createEnvValidator(schema: Record<string, (value: unknown) => boolean>) {
    return {
      validate(env: Record<string, unknown>): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        for (const [key, validator] of Object.entries(schema)) {
          const value = env[key];
          if (!validator(value)) {
            errors.push(`Invalid environment variable: ${key}`);
          }
        }

        return {
          valid: errors.length === 0,
          errors,
        };
      },
    };
  }
}
