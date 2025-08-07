import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockContext } from '../utils/mock-context'

import { requestsCommand } from '@/adapters/telegram/commands/admin/requests'

// Mock the auth module
vi.mock('@/middleware/auth', () => ({
  requireAdmin: vi.fn((ctx, next) => next()),
  isAdmin: vi.fn().mockReturnValue(true)
}))

// Mock InlineKeyboard
let mockKeyboard: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }
vi.mock('grammy', () => ({
  InlineKeyboard: vi.fn().mockImplementation(() => {
    const keyboard = {
      _inline_keyboard: [] as Array<Array<{ text: string; callback_data: string }>>,
      currentRow: [] as Array<{ text: string; callback_data: string }>,
      text: vi.fn().mockImplementation(function (
        this: { currentRow: Array<{ text: string; callback_data: string }> },
        text: string,
        data: string
      ) {
        this.currentRow.push({ text, callback_data: data })
        return this
      }),
      row: vi.fn().mockImplementation(function (this: {
        currentRow: Array<{ text: string; callback_data: string }>
        _inline_keyboard: Array<Array<{ text: string; callback_data: string }>>
      }) {
        if (this.currentRow.length > 0) {
          this._inline_keyboard.push(this.currentRow)
          this.currentRow = []
        }
        return this
      })
    }
    // Finalize any pending row when accessed
    Object.defineProperty(keyboard, 'inline_keyboard', {
      get: function () {
        if (this.currentRow.length > 0) {
          this._inline_keyboard.push(this.currentRow)
          this.currentRow = []
        }
        return this._inline_keyboard
      }
    })
    mockKeyboard = keyboard
    return keyboard
  })
}))

describe('Requests Command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show the first pending request with approve/reject buttons', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'Admin',
        username: 'admin'
      }
    })

    ctx.env.BOT_ADMIN_IDS = '123456'

    // Mock DB queries
    let callCount = 0
    ctx.env.DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // First pending request
          return Promise.resolve({
            id: 1,
            user_id: 789012,
            username: 'newuser',
            first_name: 'John',
            created_at: '2025-01-18T10:00:00Z',
            telegram_id: 789012
          })
        } else {
          // Total pending count
          return Promise.resolve({ count: 3 })
        }
      })
    })

    await requestsCommand(ctx)

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('📋 <b>Access Request #1</b>'),
      expect.objectContaining({
        parse_mode: 'HTML',
        reply_markup: expect.any(Object)
      })
    )

    const replyContent = ctx.reply.mock.calls[0][0]
    expect(replyContent).toContain('Name: John')
    expect(replyContent).toContain('Username: @newuser')
    expect(replyContent).toContain('User ID: 789012')
    expect(replyContent).toContain('📊 Pending requests: 1/3')

    // Check the keyboard structure
    const keyboard = mockKeyboard
    expect(keyboard.inline_keyboard).toHaveLength(2) // Two rows
    expect(keyboard.inline_keyboard[0]).toHaveLength(2) // Approve/Reject buttons
    expect(keyboard.inline_keyboard[0][0]).toEqual({
      text: 'Approve',
      callback_data: 'access:approve:1'
    })
    expect(keyboard.inline_keyboard[0][1]).toEqual({
      text: 'Reject',
      callback_data: 'access:reject:1'
    })
    expect(keyboard.inline_keyboard[1]).toHaveLength(1) // Next button
    expect(keyboard.inline_keyboard[1][0]).toEqual({
      text: 'Next',
      callback_data: 'access:next:1'
    })
  })

  it('should show only approve/reject buttons when there is one request', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'Admin'
      }
    })

    ctx.env.BOT_ADMIN_IDS = '123456'

    // Mock DB queries
    let callCount = 0
    ctx.env.DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // Only one pending request
          return Promise.resolve({
            id: 2,
            user_id: 345678,
            username: null,
            first_name: 'Jane',
            created_at: '2025-01-18T11:00:00Z',
            telegram_id: 345678
          })
        } else {
          // Total pending count
          return Promise.resolve({ count: 1 })
        }
      })
    })

    await requestsCommand(ctx)

    expect(ctx.reply).toHaveBeenCalled()

    // Check the keyboard structure
    const keyboard = mockKeyboard
    expect(keyboard.inline_keyboard).toHaveLength(1) // Only one row
    expect(keyboard.inline_keyboard[0]).toHaveLength(2) // Two buttons (approve/reject)
    expect(keyboard.inline_keyboard[0][0].text).toBe('Approve')
    expect(keyboard.inline_keyboard[0][1].text).toBe('Reject')
  })

  it('should show message when no pending requests', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'Admin'
      }
    })

    ctx.env.BOT_ADMIN_IDS = '123456'

    // Mock DB to return no requests
    ctx.env.DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null)
    })

    await requestsCommand(ctx)

    expect(ctx.reply).toHaveBeenCalledWith('No pending access requests.')
  })

  it('should handle users without username', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'Admin'
      }
    })

    ctx.env.BOT_ADMIN_IDS = '123456'

    // Mock DB queries
    let callCount = 0
    ctx.env.DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // Request without username
          return Promise.resolve({
            id: 3,
            user_id: 111222,
            username: null,
            first_name: 'NoUsername',
            created_at: '2025-01-18T12:00:00Z',
            telegram_id: 111222
          })
        } else {
          return Promise.resolve({ count: 1 })
        }
      })
    })

    await requestsCommand(ctx)

    const replyContent = ctx.reply.mock.calls[0][0]
    expect(replyContent).toContain('Name: NoUsername')
    expect(replyContent).toContain('Username: ') // Empty username
    expect(replyContent).toContain('User ID: 111222')
  })

  it('should handle database errors gracefully', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'Admin'
      }
    })

    ctx.env.BOT_ADMIN_IDS = '123456'

    // Mock DB to throw error
    ctx.env.DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockRejectedValue(new Error('Database error'))
    })

    await requestsCommand(ctx)

    expect(ctx.reply).toHaveBeenCalledWith('❌ Failed to retrieve access requests.')
  })
})
