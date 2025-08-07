import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockCallbackContext } from '../utils/mock-context'

import {
  handleAccessApprove,
  handleAccessCancel,
  handleAccessReject,
  handleAccessRequest,
  handleAccessStatus,
  handleNextRequest
} from '@/adapters/telegram/callbacks/access'

// Mock the auth module
vi.mock('@/middleware/auth', () => ({
  isAdmin: vi.fn().mockReturnValue(true),
  isOwner: vi.fn().mockReturnValue(false)
}))

// Mock InlineKeyboard
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
      get: function (this: {
        currentRow: Array<{ text: string; callback_data: string }>
        _inline_keyboard: Array<Array<{ text: string; callback_data: string }>>
      }) {
        if (this.currentRow.length > 0) {
          this._inline_keyboard.push(this.currentRow)
          this.currentRow = []
        }
        return this._inline_keyboard
      }
    })
    return keyboard
  })
}))

describe('Access Callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('handleAccessRequest', () => {
    it('should create a new access request', async () => {
      const ctx = createMockCallbackContext('access:request', {
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'User',
          username: 'testuser'
        }
      })

      // Mock DB - no existing request
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn().mockResolvedValue({ results: [] })
      })

      await handleAccessRequest(ctx)

      expect(ctx.editMessageText).toHaveBeenCalledWith(
        'Your access request has been sent to the administrators.',
        { parse_mode: 'HTML' }
      )

      // Verify DB operations
      const preparedCalls = ctx.env.DB.prepare.mock.calls
      expect(preparedCalls[0][0]).toContain('SELECT id FROM access_requests')
      expect(preparedCalls[1][0]).toContain('INSERT INTO access_requests')
    })

    it('should handle existing pending request', async () => {
      const ctx = createMockCallbackContext('access:request', {
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'User'
        }
      })

      // Mock DB - existing request
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ id: 1 })
      })

      await handleAccessRequest(ctx)

      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
        'You already have a pending access request.'
      )
      expect(ctx.editMessageText).not.toHaveBeenCalled()
    })

    it('should handle user identification error', async () => {
      const ctx = createMockCallbackContext('access:request', {
        from: undefined
      })

      await handleAccessRequest(ctx)

      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith('❌ Unable to identify user')
    })
  })

  describe('handleAccessStatus', () => {
    it('should show pending status', async () => {
      const ctx = createMockCallbackContext('access:status')

      await handleAccessStatus(ctx)

      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
        'Your access request is pending approval.'
      )
    })
  })

  describe('handleAccessCancel', () => {
    it('should cancel user own request', async () => {
      const ctx = createMockCallbackContext('access:cancel:5', {
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'User'
        }
      })

      // Mock DB - request exists and belongs to user
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ id: 5 }),
        run: vi.fn().mockResolvedValue({ success: true })
      })

      await handleAccessCancel(ctx, '5')

      expect(ctx.editMessageText).toHaveBeenCalledWith('Your access request has been cancelled.', {
        parse_mode: 'HTML'
      })
    })

    it('should handle request not found', async () => {
      const ctx = createMockCallbackContext('access:cancel:5', {
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'User'
        }
      })

      // Mock DB - request not found
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null)
      })

      await handleAccessCancel(ctx, '5')

      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith('Request not found.')
    })
  })

  describe('handleAccessApprove', () => {
    it('should approve access request', async () => {
      const ctx = createMockCallbackContext('access:approve:10', {
        from: {
          id: 999999,
          is_bot: false,
          first_name: 'Admin'
        }
      })

      // Mock DB operations
      let prepareCount = 0
      ctx.env.DB.prepare = vi.fn().mockImplementation(_query => {
        prepareCount++
        if (prepareCount === 1) {
          // Get request details
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({
              user_id: 123456,
              username: 'newuser',
              first_name: 'John'
            })
          }
        } else if (prepareCount === 4) {
          // Get next request (none)
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(null)
          }
        } else {
          // Update operations
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockResolvedValue({ success: true })
          }
        }
      })

      await handleAccessApprove(ctx, '10')

      expect(ctx.editMessageText).toHaveBeenCalledTimes(1)
      expect(ctx.editMessageText).toHaveBeenCalledWith(
        '✅ Access granted to user 123456 (@newuser)',
        expect.objectContaining({
          parse_mode: 'HTML',
          reply_markup: expect.any(Object)
        })
      )

      // Verify notification was sent
      expect(ctx.api.sendMessage).toHaveBeenCalledWith(
        123456,
        '🎉 Your access request has been approved! You can now use the bot.',
        { parse_mode: 'HTML' }
      )
    })

    it('should handle request not found', async () => {
      const ctx = createMockCallbackContext('access:approve:10', {
        from: {
          id: 999999,
          is_bot: false,
          first_name: 'Admin'
        }
      })

      // Mock DB - request not found
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null)
      })

      await handleAccessApprove(ctx, '10')

      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith('Request not found.')
    })
  })

  describe('handleAccessReject', () => {
    it('should reject access request', async () => {
      const ctx = createMockCallbackContext('access:reject:10', {
        from: {
          id: 999999,
          is_bot: false,
          first_name: 'Admin'
        }
      })

      // Mock DB operations
      let prepareCount = 0
      ctx.env.DB.prepare = vi.fn().mockImplementation(_query => {
        prepareCount++
        if (prepareCount === 1) {
          // Get request details
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({
              user_id: 123456,
              username: 'newuser',
              first_name: 'John'
            })
          }
        } else if (prepareCount === 3) {
          // Get next request (none)
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(null)
          }
        } else {
          // Update operations
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockResolvedValue({ success: true })
          }
        }
      })

      await handleAccessReject(ctx, '10')

      expect(ctx.editMessageText).toHaveBeenCalledTimes(1)
      expect(ctx.editMessageText).toHaveBeenCalledWith(
        '❌ Access denied to user 123456 (@newuser)',
        expect.objectContaining({
          parse_mode: 'HTML',
          reply_markup: expect.any(Object)
        })
      )

      // Verify notification was sent
      expect(ctx.api.sendMessage).toHaveBeenCalledWith(
        123456,
        'Your access request has been rejected.',
        { parse_mode: 'HTML' }
      )
    })
  })

  describe('handleNextRequest', () => {
    it('should show next pending request', async () => {
      const ctx = createMockCallbackContext('access:next:10', {
        from: {
          id: 999999,
          is_bot: false,
          first_name: 'Admin'
        }
      })

      // Mock DB operations
      let prepareCount = 0
      ctx.env.DB.prepare = vi.fn().mockImplementation(() => {
        prepareCount++
        if (prepareCount === 1) {
          // Get next request
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({
              id: 11,
              user_id: 654321,
              username: 'anotheruser',
              first_name: 'Jane',
              created_at: '2025-01-18T12:00:00Z'
            })
          }
        } else {
          // Get total count
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ count: 5 })
          }
        }
      })

      await handleNextRequest(ctx)

      expect(ctx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('📋 <b>Access Request #11</b>'),
        expect.objectContaining({
          parse_mode: 'HTML',
          reply_markup: expect.any(Object)
        })
      )

      const messageContent = ctx.editMessageText.mock.calls[0][0]
      expect(messageContent).toContain('Name: Jane')
      expect(messageContent).toContain('Username: @anotheruser')
      expect(messageContent).toContain('User ID: 654321')
    })

    it('should show no pending requests message', async () => {
      const ctx = createMockCallbackContext('access:next:10', {
        from: {
          id: 999999,
          is_bot: false,
          first_name: 'Admin'
        }
      })

      // Mock DB - no next request
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null)
      })

      await handleNextRequest(ctx)

      expect(ctx.editMessageText).toHaveBeenCalledWith('No pending access requests.', {
        parse_mode: 'HTML'
      })
    })
  })
})
