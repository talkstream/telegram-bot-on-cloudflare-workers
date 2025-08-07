import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockContext } from '../utils/mock-context'

import { batchCommand } from '@/adapters/telegram/commands/batch'

describe('Batch Command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should send batch info message', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'User',
        username: 'testuser'
      }
    })

    await batchCommand(ctx)

    expect(ctx.reply).toHaveBeenCalledWith(
      '🚀 Request Batching Demo\n\nThis bot uses intelligent request batching to optimize API calls.\n\nFeatures:\n• Automatic grouping of similar requests\n• Reduced API calls and costs\n• Improved performance\n• Tier-aware batching (more aggressive on free tier)',
      { parse_mode: 'HTML' }
    )
  })

  it('should handle missing user context', async () => {
    const ctx = createMockContext({
      from: undefined
    })

    await batchCommand(ctx)

    expect(ctx.reply).toHaveBeenCalled()
  })
})
