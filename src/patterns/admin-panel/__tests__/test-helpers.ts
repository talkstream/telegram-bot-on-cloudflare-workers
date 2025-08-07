/**
 * Test helpers for admin panel
 * Provides type-safe mocking utilities
 */

import type { D1PreparedStatement, KVNamespace } from '@cloudflare/workers-types'
import { vi } from 'vitest'

/**
 * Create a type-safe mock for D1 prepared statements
 *
 * @example
 * ```typescript
 * vi.mocked(mockEnv.DB.prepare).mockImplementation(() =>
 *   createMockPreparedStatement({
 *     first: vi.fn().mockResolvedValue({ total: 42 }),
 *   }),
 * );
 * ```
 */
export function createMockPreparedStatement(
  overrides: Partial<D1PreparedStatement> = {}
): D1PreparedStatement {
  const base = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [] }),
    run: vi.fn().mockResolvedValue({ meta: {} }),
    raw: vi.fn().mockReturnThis()
  }
  return { ...base, ...overrides } as unknown as D1PreparedStatement
}

/**
 * Create a mock KV namespace
 */
export function createMockKV(): KVNamespace & { _storage: Map<string, string> } {
  const storage = new Map<string, string>()

  return {
    _storage: storage,
    get: vi.fn(async (key: string) => storage.get(key) || null),
    put: vi.fn(async (key: string, value: string) => {
      storage.set(key, value)
    }),
    delete: vi.fn(async (key: string) => {
      storage.delete(key)
    }),
    list: vi.fn(async () => ({
      keys: Array.from(storage.keys()).map(name => ({ name })),
      list_complete: true,
      cursor: undefined
    })),
    getWithMetadata: vi.fn()
  } as unknown as KVNamespace & { _storage: Map<string, string> }
}

/**
 * Create a mock admin environment
 */
export function createMockAdminEnv(overrides: Partial<unknown> = {}): unknown {
  return {
    BOT_TOKEN: 'test-bot-token',
    BOT_OWNER_IDS: '123456789,987654321',
    SESSIONS: createMockKV(),
    DB: {
      prepare: vi.fn(() => createMockPreparedStatement()),
      batch: vi.fn(),
      dump: vi.fn(),
      exec: vi.fn()
    },
    ...overrides
  }
}

/**
 * Mock Telegram Bot API
 */
export function mockTelegramBot() {
  return {
    api: {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
      editMessageText: vi.fn().mockResolvedValue({ message_id: 1 }),
      deleteMessage: vi.fn().mockResolvedValue(true),
      answerCallbackQuery: vi.fn().mockResolvedValue(true)
    }
  }
}
