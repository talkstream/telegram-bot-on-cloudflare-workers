import { vi } from 'vitest'

export const mockBot = {
  handleUpdate: vi.fn().mockResolvedValue(undefined),
  api: {
    setMyCommands: vi.fn().mockResolvedValue({ ok: true }),
    getMyCommands: vi.fn().mockResolvedValue([
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Show help message' },
      { command: 'pay', description: 'Make a payment' },
      { command: 'settings', description: 'Bot settings' },
      { command: 'stats', description: 'View statistics' },
      { command: 'balance', description: 'Check balance' }
    ])
  },
  command: vi.fn(),
  on: vi.fn(),
  use: vi.fn(),
  catch: vi.fn()
}

export const createBot = vi.fn(() => mockBot)

// Mock the module
vi.mock('@/core/bot', () => ({
  createBot
}))
