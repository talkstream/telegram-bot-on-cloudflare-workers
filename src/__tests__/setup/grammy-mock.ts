import { vi } from 'vitest'
import '../mocks/logger'
import '../mocks/telegram-formatter'

// Mock grammy module
vi.mock('grammy', () => ({
  Bot: vi.fn().mockImplementation(() => ({
    api: {
      setMyCommands: vi.fn().mockResolvedValue({ ok: true }),
      getMyCommands: vi.fn().mockResolvedValue([
        { command: 'start', description: 'Start the bot' },
        { command: 'help', description: 'Show help message' },
        { command: 'pay', description: 'Make a payment' },
        { command: 'settings', description: 'Bot settings' },
        { command: 'stats', description: 'View statistics' },
        { command: 'balance', description: 'Check balance' }
      ]),
      sendMessage: vi.fn().mockResolvedValue({ ok: true }),
      sendInvoice: vi.fn().mockResolvedValue({ ok: true })
    },
    command: vi.fn(),
    on: vi.fn(),
    use: vi.fn(),
    handleUpdate: vi.fn().mockResolvedValue(undefined),
    catch: vi.fn()
  })),
  session: vi.fn(() => (ctx: { session?: Record<string, unknown> }, next: () => unknown) => {
    ctx.session = ctx.session || {}
    return next()
  }),
  InlineKeyboard: vi.fn().mockImplementation(() => ({
    text: vi.fn().mockReturnThis(),
    row: vi.fn().mockReturnThis(),
    url: vi.fn().mockReturnThis()
  })),
  InputFile: vi.fn()
}))
