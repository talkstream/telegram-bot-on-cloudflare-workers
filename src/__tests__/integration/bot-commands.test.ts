import type { BotCommand } from 'grammy/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createBot } from '../mocks/core-bot'
import { createMockEnv } from '../utils/mock-env'

describe('Bot Commands Registration', () => {
  const mockEnv = createMockEnv()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should register all required commands', async () => {
    const bot = createBot(mockEnv)

    // Get the registered commands
    const commands = await bot.api.getMyCommands()

    // Check that commands array exists and has the expected commands
    expect(commands).toBeDefined()
    expect(Array.isArray(commands)).toBe(true)
    expect(commands.length).toBeGreaterThan(0)

    // Check for specific commands
    const commandNames = commands.map((c: BotCommand) => c.command)
    expect(commandNames).toContain('start')
    expect(commandNames).toContain('help')
    expect(commandNames).toContain('balance')
    expect(commandNames).toContain('settings')
    expect(commandNames).toContain('pay')
    expect(commandNames).toContain('stats')
  })

  it('should have proper descriptions for commands', async () => {
    const bot = createBot(mockEnv)
    const commands = await bot.api.getMyCommands()

    // Find the help command
    const helpCommand = commands.find((c: BotCommand) => c.command === 'help')
    expect(helpCommand).toBeDefined()
    expect(helpCommand?.description).toBeTruthy()
    expect(helpCommand?.description).toContain('help')
  })
})
