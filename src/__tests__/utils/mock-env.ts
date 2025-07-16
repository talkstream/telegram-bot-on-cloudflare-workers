import { vi } from 'vitest';
import type { Env } from '@/types';

export function createMockEnv(): Env {
  return {
    // Environment variables
    TELEGRAM_BOT_TOKEN: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
    TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
    GEMINI_API_KEY: 'test-gemini-api-key',
    SENTRY_DSN: 'https://test@sentry.io/123456',
    ENVIRONMENT: 'development',
    
    // Mock D1 Database
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
      batch: vi.fn().mockResolvedValue([]),
      exec: vi.fn().mockResolvedValue({ results: [] }),
    } as any,
    
    // Mock KV Namespaces
    CACHE: createMockKV(),
    RATE_LIMIT: createMockKV(),
    SESSIONS: createMockKV(),
  };
}

export function createMockKV() {
  const storage = new Map<string, any>();
  
  return {
    get: vi.fn(async (key: string, type?: string) => {
      const value = storage.get(key);
      if (!value) return null;
      
      if (type === 'json') {
        return JSON.parse(value);
      }
      
      return value;
    }),
    
    put: vi.fn(async (key: string, value: any, options?: any) => {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      storage.set(key, stringValue);
      
      if (options?.expirationTtl) {
        // Simulate expiration
        setTimeout(() => storage.delete(key), options.expirationTtl * 1000);
      }
    }),
    
    delete: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    
    list: vi.fn(async (options?: any) => {
      const keys = Array.from(storage.keys())
        .filter(key => !options?.prefix || key.startsWith(options.prefix))
        .map(name => ({ name, metadata: {} }));
      
      return {
        keys,
        list_complete: true,
        cursor: null,
      };
    }),
    
    // Helper for tests
    _storage: storage,
  } as any;
}

export function createMockD1Result<T>(data: T) {
  return {
    results: Array.isArray(data) ? data : [data],
    success: true,
    meta: {},
  };
}

export function createMockD1Database() {
  const mockDb = {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      raw: vi.fn().mockResolvedValue([]),
    })),
    
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ results: [] }),
    
    // Helper methods for tests
    _setQueryResult: (sql: string, result: any) => {
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes(sql)) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(result),
            run: vi.fn().mockResolvedValue({ success: true }),
            all: vi.fn().mockResolvedValue({ results: Array.isArray(result) ? result : [result] }),
            raw: vi.fn().mockResolvedValue(Array.isArray(result) ? result : [result]),
          };
        }
        
        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          raw: vi.fn().mockResolvedValue([]),
        };
      });
    },
  };
  
  return mockDb as any;
}