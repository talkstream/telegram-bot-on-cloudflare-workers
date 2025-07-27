/**
 * Test Helpers for Wireframe Tests
 *
 * Provides type-safe factories and utilities for creating test data
 */

import type { User, Chat } from '@grammyjs/types';
import type { MockedFunction } from 'vitest';
import { vi } from 'vitest';
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';

import type { Env } from '../../types/env.js';
import type { BotContext } from '../../types/index.js';
import type { CloudPlatform } from '../../core/interfaces/cloud-platform.js';

/**
 * Create a test user with all required properties
 */
export function createTestUser(overrides: Partial<User> = {}): User {
  return {
    id: 123456789,
    is_bot: false,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    language_code: 'en',
    is_premium: false as true | undefined,
    added_to_attachment_menu: false as true | undefined,
    ...overrides,
  };
}

/**
 * Create a test private chat with all required properties
 */
export function createTestPrivateChat(overrides: Partial<Chat.PrivateChat> = {}): Chat.PrivateChat {
  return {
    id: 123456789,
    type: 'private',
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    ...overrides,
  };
}

/**
 * Create a test group chat with all required properties
 */
export function createTestGroupChat(overrides: Partial<Chat.GroupChat> = {}): Chat.GroupChat {
  return {
    id: -1001234567890,
    type: 'group',
    title: 'Test Group',
    ...overrides,
  };
}

/**
 * Create a test supergroup chat with all required properties
 */
export function createTestSupergroupChat(
  overrides: Partial<Chat.SupergroupChat> = {},
): Chat.SupergroupChat {
  return {
    id: -1001234567890,
    type: 'supergroup',
    title: 'Test Supergroup',
    username: 'testsupergroup',
    ...overrides,
  };
}

/**
 * Create a generic test chat based on type
 */
export function createTestChat(
  type: 'private' | 'group' | 'supergroup' = 'private',
  overrides: Partial<Chat> = {},
): Chat {
  switch (type) {
    case 'private':
      return createTestPrivateChat(overrides as Partial<Chat.PrivateChat>);
    case 'group':
      return createTestGroupChat(overrides as Partial<Chat.GroupChat>);
    case 'supergroup':
      return createTestSupergroupChat(overrides as Partial<Chat.SupergroupChat>);
  }
}

/**
 * Create a mock D1 prepared statement
 */
export function createMockD1PreparedStatement() {
  const mockStatement = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null) as MockedFunction<D1PreparedStatement['first']>,
    all: vi.fn().mockResolvedValue({
      results: [],
      success: true,
      meta: {
        duration: 0,
        changes: 0,
        last_row_id: 0,
        changed_db: false,
        size_after: 0,
        rows_read: 0,
        rows_written: 0,
      },
    }) as MockedFunction<D1PreparedStatement['all']>,
    run: vi.fn().mockResolvedValue({
      success: true,
      meta: {
        duration: 0,
        changes: 0,
        last_row_id: 0,
        changed_db: false,
        size_after: 0,
        rows_read: 0,
        rows_written: 0,
      },
    }) as MockedFunction<D1PreparedStatement['run']>,
    raw: vi.fn().mockResolvedValue([]) as MockedFunction<D1PreparedStatement['raw']>,
  };

  return mockStatement;
}

/**
 * Create a mock D1 database
 */
export function createMockD1Database(): D1Database {
  const mockDb = {
    prepare: vi.fn(() => createMockD1PreparedStatement()),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 }),
  } as unknown as D1Database;

  return mockDb;
}

/**
 * Create a test environment with all required properties
 */
export function createTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    // Required environment variables
    TELEGRAM_BOT_TOKEN: 'test-bot-token',
    TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',

    // Optional but commonly used
    BOT_OWNER_IDS: '123456789',
    AI_PROVIDER: 'mock',
    TIER: 'free',
    ENVIRONMENT: 'development' as 'development' | 'production' | 'staging',

    // Cloudflare bindings
    DB: createMockD1Database(),
    CACHE: createMockKVNamespace(),
    RATE_LIMIT: createMockKVNamespace(),
    SESSIONS: createMockKVNamespace(),
    AI: createMockAI(),

    // Apply overrides
    ...overrides,
  };
}

/**
 * Create a mock KV namespace
 */
export function createMockKVNamespace() {
  return {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
    getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
  };
}

/**
 * Create a mock AI binding
 */
export function createMockAI() {
  return {
    run: vi.fn().mockResolvedValue({ response: 'Mock AI response' }),
  };
}

/**
 * Create a test context with proper typing
 */
export function createTestContext(overrides: Partial<BotContext> = {}): BotContext {
  const env = createTestEnv();
  const from = createTestUser();
  const chat = createTestPrivateChat();

  const ctx = {
    // Message properties
    message: {
      message_id: 1,
      date: Date.now() / 1000,
      chat,
      from,
      text: '/test',
    },
    from,
    chat,

    // Grammy context properties
    match: null,
    update: {
      update_id: 1,
      message: {
        message_id: 1,
        date: Date.now() / 1000,
        chat,
        from,
        text: '/test',
      },
    },

    // Methods
    reply: vi.fn().mockResolvedValue({ message_id: 2 }),
    answerCallbackQuery: vi.fn().mockResolvedValue(true),
    editMessageText: vi.fn().mockResolvedValue({ message_id: 1 }),
    deleteMessage: vi.fn().mockResolvedValue(true),
    api: {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 3 }),
      editMessageText: vi.fn().mockResolvedValue({ message_id: 1 }),
      deleteMessage: vi.fn().mockResolvedValue(true),
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
    },

    // Wireframe specific
    env,
    requestId: 'test-request-id',
    platform: 'cloudflare' as CloudPlatform,

    // Apply overrides
    ...overrides,
  } as unknown as BotContext;

  return ctx;
}

/**
 * Create a context with DB guaranteed to exist
 */
export function createTestContextWithDB(overrides: Partial<BotContext> = {}): BotContext & {
  env: Env & { DB: D1Database };
} {
  const ctx = createTestContext(overrides);

  // Ensure DB exists
  if (!ctx.env.DB) {
    ctx.env.DB = createMockD1Database();
  }

  return ctx as BotContext & { env: Env & { DB: D1Database } };
}

/**
 * Type guard to check if context has DB
 */
export function hasDB(ctx: BotContext): ctx is BotContext & {
  env: Env & { DB: D1Database };
} {
  return ctx.env.DB !== undefined;
}

/**
 * Assert that context has DB (throws if not)
 */
export function assertHasDB(ctx: BotContext): asserts ctx is BotContext & {
  env: Env & { DB: D1Database };
} {
  if (!ctx.env.DB) {
    throw new Error('Context does not have DB');
  }
}

/**
 * Create a mock function with proper typing
 */
export function createMockFunction<T extends (...args: unknown[]) => unknown>(): MockedFunction<T> {
  return vi.fn() as MockedFunction<T>;
}

/**
 * Wait for all promises to resolve
 */
export async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

/**
 * Mock Sentry for tests
 */
export function mockSentry() {
  return {
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    setUser: vi.fn(),
    setContext: vi.fn(),
    addBreadcrumb: vi.fn(),
    withScope: vi.fn((callback) => callback({})),
  };
}
