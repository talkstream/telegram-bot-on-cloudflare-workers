/**
 * Setup for integration tests that require Cloudflare Workers environment
 */
import { vi } from 'vitest';

import '../mocks/logger';
import '../mocks/telegram-formatter';
import { setupGlobalTestCleanup } from './test-cleanup';

// Setup global test cleanup hooks
setupGlobalTestCleanup();

// Configure EventBus for integration tests
vi.mock('@/core/events/event-bus', async () => {
  const actual =
    await vi.importActual<typeof import('@/core/events/event-bus')>('@/core/events/event-bus');

  class IntegrationEventBus extends actual.EventBus {
    constructor(options: Record<string, unknown> = {}) {
      super({
        ...options,
        enableHistory: false, // Still disable history in tests
        maxHistorySize: 10, // If enabled, limit to 10 events
      });
    }
  }

  return {
    ...actual,
    EventBus: IntegrationEventBus,
    globalEventBus: new IntegrationEventBus(),
  };
});

// Only load Grammy mock for integration tests
vi.mock('grammy', () => ({
  Bot: vi.fn().mockImplementation(() => ({
    api: {
      setMyCommands: vi.fn().mockResolvedValue({ ok: true }),
      getMyCommands: vi.fn().mockResolvedValue([
        { command: 'start', description: 'Start the bot' },
        { command: 'help', description: 'Show help message' },
      ]),
      sendMessage: vi.fn().mockResolvedValue({ ok: true }),
      sendInvoice: vi.fn().mockResolvedValue({ ok: true }),
    },
    command: vi.fn(),
    on: vi.fn(),
    use: vi.fn(),
    handleUpdate: vi.fn().mockResolvedValue(undefined),
    catch: vi.fn(),
  })),
  session: vi.fn(() => (ctx: { session?: Record<string, unknown> }, next: () => unknown) => {
    ctx.session = ctx.session || {};
    return next();
  }),
  InlineKeyboard: vi.fn(() => {
    const kb = {
      text: vi.fn().mockReturnThis(),
      row: vi.fn().mockReturnThis(),
      url: vi.fn().mockReturnThis(),
      inline_keyboard: [],
    };
    return kb;
  }),
  InputFile: vi.fn(),
}));
