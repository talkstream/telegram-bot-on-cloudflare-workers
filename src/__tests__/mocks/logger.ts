import { vi } from 'vitest'

export const logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
}

// Mock the logger module
vi.mock('@/lib/logger', () => ({
  logger
}))
