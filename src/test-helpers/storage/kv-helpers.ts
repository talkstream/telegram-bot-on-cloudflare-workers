import { vi } from 'vitest';
import type { KVNamespace, KVListResult } from '@cloudflare/workers-types';

/**
 * Enhanced KV mock with in-memory storage and expiration support
 */
export interface MockKVNamespace extends KVNamespace {
  _storage: Map<string, { value: string; expiration?: number; metadata?: unknown }>;
  _reset: () => void;
  _size: () => number;
  _dump: () => Record<string, unknown>;
}

/**
 * Create a mock KV namespace with full functionality
 */
export function createMockKVNamespace(): MockKVNamespace {
  const storage = new Map<string, { value: string; expiration?: number; metadata?: unknown }>();

  // Clean up expired entries
  const cleanExpired = () => {
    const now = Date.now();
    for (const [key, data] of storage) {
      if (data.expiration && data.expiration < now) {
        storage.delete(key);
      }
    }
  };

  const mockKV = {
    get: vi.fn(async (key: string, options?: { type?: string; cacheTtl?: number }) => {
      cleanExpired();
      const data = storage.get(key);

      if (!data) return null;

      if (options?.type === 'json') {
        try {
          return JSON.parse(data.value);
        } catch {
          return null;
        }
      } else if (options?.type === 'arrayBuffer') {
        return new TextEncoder().encode(data.value).buffer;
      } else if (options?.type === 'stream') {
        return new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(data.value));
            controller.close();
          },
        });
      }

      return data.value;
    }),

    getWithMetadata: vi.fn(async (key: string, options?: { type?: string; cacheTtl?: number }) => {
      cleanExpired();
      const data = storage.get(key);

      if (!data) return { value: null, metadata: null };

      let value: unknown = data.value;

      if (options?.type === 'json') {
        try {
          value = JSON.parse(data.value);
        } catch {
          value = null;
        }
      }

      return { value, metadata: data.metadata || null };
    }),

    put: vi.fn(
      async (
        key: string,
        value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
        options?: {
          expiration?: number;
          expirationTtl?: number;
          metadata?: unknown;
        },
      ) => {
        let stringValue: string;

        if (typeof value === 'string') {
          stringValue = value;
        } else if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
          stringValue = new TextDecoder().decode(value as ArrayBuffer);
        } else if (value instanceof ReadableStream) {
          const reader = value.getReader();
          const chunks: Uint8Array[] = [];

          while (true) {
            const { done, value: chunk } = await reader.read();
            if (done) break;
            chunks.push(chunk);
          }

          stringValue = new TextDecoder().decode(Buffer.concat(chunks));
        } else {
          stringValue = JSON.stringify(value);
        }

        const expiration = options?.expiration
          ? options.expiration * 1000
          : options?.expirationTtl
            ? Date.now() + options.expirationTtl * 1000
            : undefined;

        storage.set(key, {
          value: stringValue,
          expiration,
          metadata: options?.metadata,
        });
      },
    ),

    delete: vi.fn(async (key: string) => {
      storage.delete(key);
    }),

    list: vi.fn(
      async (options?: {
        prefix?: string;
        limit?: number;
        cursor?: string;
      }): Promise<KVListResult> => {
        cleanExpired();

        let keys = Array.from(storage.keys());

        // Filter by prefix
        if (options?.prefix) {
          keys = keys.filter((key) => key.startsWith(options.prefix!));
        }

        // Handle cursor-based pagination
        let startIndex = 0;
        if (options?.cursor) {
          const cursorIndex = parseInt(options.cursor, 10);
          if (!isNaN(cursorIndex)) {
            startIndex = cursorIndex;
          }
        }

        // Apply limit
        const limit = options?.limit || 1000;
        const endIndex = startIndex + limit;
        const paginatedKeys = keys.slice(startIndex, endIndex);

        const list_complete = endIndex >= keys.length;
        const cursor = list_complete ? null : String(endIndex);

        return {
          keys: paginatedKeys.map((name) => ({
            name,
            expiration: storage.get(name)?.expiration,
            metadata: storage.get(name)?.metadata,
          })),
          list_complete,
          cursor,
        };
      },
    ),

    // Test helpers
    _storage: storage,
    _reset: () => {
      storage.clear();
      vi.clearAllMocks();
    },
    _size: () => storage.size,
    _dump: () => {
      const dump: Record<string, unknown> = {};
      for (const [key, data] of storage) {
        dump[key] = {
          value: data.value,
          expiration: data.expiration,
          metadata: data.metadata,
        };
      }
      return dump;
    },
  };

  return mockKV as MockKVNamespace;
}

/**
 * KV test utilities
 */
export class KVTestUtils {
  /**
   * Create a batch writer for efficient bulk operations
   */
  static createBatchWriter(kv: KVNamespace) {
    const operations: Array<() => Promise<void>> = [];

    return {
      put(key: string, value: unknown, options?: Parameters<KVNamespace['put']>[2]): void {
        operations.push(async () => {
          const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
          await kv.put(key, stringValue, options);
        });
      },

      delete(key: string): void {
        operations.push(async () => {
          await kv.delete(key);
        });
      },

      async flush(): Promise<void> {
        await Promise.all(operations.map((op) => op()));
        operations.length = 0;
      },
    };
  }

  /**
   * Create a namespace prefixer
   */
  static createNamespacedKV(kv: KVNamespace, prefix: string): KVNamespace {
    const prefixKey = (key: string) => `${prefix}:${key}`;

    return {
      get: (key: string, options?: any) => kv.get(prefixKey(key), options),
      getWithMetadata: (key: string, options?: any) => kv.getWithMetadata(prefixKey(key), options),
      put: (key: string, value: any, options?: any) => kv.put(prefixKey(key), value, options),
      delete: (key: string) => kv.delete(prefixKey(key)),
      list: (options?: any) =>
        kv.list({
          ...options,
          prefix: options?.prefix ? `${prefix}:${options.prefix}` : `${prefix}:`,
        }),
    } as KVNamespace;
  }
}
