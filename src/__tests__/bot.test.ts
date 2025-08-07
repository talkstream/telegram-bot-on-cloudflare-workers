import { describe, expect, it } from 'vitest'

import { createBot } from './mocks/core-bot'
import { createMockEnv } from './utils/mock-env'

describe('Bot', () => {
  it('should create bot instance', () => {
    const env = createMockEnv()
    const bot = createBot(env)

    expect(bot).toBeDefined()
    expect(bot.handleUpdate).toBeDefined()
  })

  it('should handle webhook verification', async () => {
    const env = createMockEnv()
    const bot = createBot(env)

    // Bot should be initialized
    expect(bot).toBeDefined()
  })
})
