/**
 * Node environment mocks for CI tests
 *
 * This file provides mocks for Cloudflare Workers APIs when running
 * tests in Node.js environment instead of Workers runtime.
 */

import { vi } from 'vitest';

declare global {
  var D1Database: any;

  var KVNamespace: any;

  var R2Bucket: any;

  var DurableObjectNamespace: any;

  var DurableObjectState: any;

  var Queue: any;

  var AnalyticsEngineDataset: any;

  var caches: any;
}

// Mock D1Database
global.D1Database = class D1Database {
  prepare() {
    return {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    };
  }
  dump = vi.fn().mockResolvedValue(new ArrayBuffer(0));
  exec = vi.fn().mockResolvedValue({ results: [] });
  batch = vi.fn().mockResolvedValue([]);
} as any;

// Mock KV namespace
global.KVNamespace = class KVNamespace {
  get = vi.fn().mockResolvedValue(null);
  put = vi.fn().mockResolvedValue(undefined);
  delete = vi.fn().mockResolvedValue(undefined);
  list = vi.fn().mockResolvedValue({ keys: [] });
  getWithMetadata = vi.fn().mockResolvedValue({ value: null, metadata: null });
} as any;

// Mock R2Bucket
global.R2Bucket = class R2Bucket {
  put = vi.fn().mockResolvedValue({});
  get = vi.fn().mockResolvedValue(null);
  delete = vi.fn().mockResolvedValue(undefined);
  list = vi.fn().mockResolvedValue({ objects: [] });
  head = vi.fn().mockResolvedValue(null);
} as any;

// Mock DurableObjectNamespace
global.DurableObjectNamespace = class DurableObjectNamespace {
  idFromName = vi.fn();
  get = vi.fn();
} as any;

// Mock DurableObjectState
global.DurableObjectState = class DurableObjectState {
  storage = {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue(new Map()),
  };
} as any;

// Mock Queue
global.Queue = class Queue {
  send = vi.fn().mockResolvedValue(undefined);
  sendBatch = vi.fn().mockResolvedValue(undefined);
} as any;

// Mock AnalyticsEngineDataset
global.AnalyticsEngineDataset = class AnalyticsEngineDataset {
  writeDataPoint = vi.fn().mockResolvedValue(undefined);
} as any;

// Mock Cache API
global.caches = {
  default: {
    match: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(true),
  },
  open: vi.fn().mockResolvedValue({
    match: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(true),
  }),
} as any;

// Mock crypto.subtle
const globalAny = global as any;
if (!globalAny.crypto) {
  globalAny.crypto = {};
}
globalAny.crypto.subtle = {
  digest: vi.fn().mockImplementation(async (_algorithm: string, _data: ArrayBuffer) => {
    // Simple mock hash
    return new ArrayBuffer(32);
  }),
  generateKey: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
} as any;

// Mock fetch if not available
if (!global.fetch) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(''),
    headers: new Map(),
  }) as any;
}

// Mock Request/Response if not available
if (!global.Request) {
  global.Request = class Request {
    constructor(
      public url: string,
      public init?: RequestInit,
    ) {}
    clone() {
      return this;
    }
  } as any;
}

if (!global.Response) {
  global.Response = class Response {
    constructor(
      public body: any,
      public init?: ResponseInit,
    ) {}
    clone() {
      return this;
    }
  } as any;
}

// Export for use in tests
export const mockD1Database = () => new global.D1Database();
export const mockKVNamespace = () => new global.KVNamespace();
export const mockR2Bucket = () => new global.R2Bucket();
export const mockQueue = () => new global.Queue();
