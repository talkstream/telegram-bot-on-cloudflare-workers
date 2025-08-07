import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockContext } from '../utils/mock-context'

import { debugCommand } from '@/adapters/telegram/commands/owner/debug'

// Mock the auth module
vi.mock('@/middleware/auth', () => ({
  requireOwner: vi.fn((ctx, next) => next()),
  isOwner: vi.fn().mockReturnValue(true),
  getDebugLevel: vi.fn().mockResolvedValue(0)
}))

describe('Debug Command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('/debug on', () => {
    it('should enable debug mode with default level 1', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner'
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' },
          from: { id: 123456, is_bot: false },
          text: '/debug on'
        }
      })

      ctx.env.BOT_OWNER_IDS = '123456'
      ctx.match = 'on'

      // Mock DB
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true })
      })

      await debugCommand(ctx)

      expect(ctx.reply).toHaveBeenCalledWith('🐛 Debug mode enabled (Level 1)', {
        parse_mode: 'HTML'
      })
    })

    it('should enable debug mode with level 2', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner'
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' },
          from: { id: 123456, is_bot: false },
          text: '/debug on 2'
        }
      })

      ctx.env.BOT_OWNER_IDS = '123456'
      ctx.match = 'on 2'

      // Mock DB
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true })
      })

      await debugCommand(ctx)

      expect(ctx.reply).toHaveBeenCalledWith('🐛 Debug mode enabled (Level 2)', {
        parse_mode: 'HTML'
      })
    })

    it('should enable debug mode with level 3', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner'
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' },
          from: { id: 123456, is_bot: false },
          text: '/debug on 3'
        }
      })

      ctx.env.BOT_OWNER_IDS = '123456'
      ctx.match = 'on 3'

      // Mock DB
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true })
      })

      await debugCommand(ctx)

      expect(ctx.reply).toHaveBeenCalledWith('🐛 Debug mode enabled (Level 3)', {
        parse_mode: 'HTML'
      })
    })

    it('should reject invalid debug levels', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner'
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' },
          from: { id: 123456, is_bot: false },
          text: '/debug on 5'
        }
      })

      ctx.env.BOT_OWNER_IDS = '123456'
      ctx.match = 'on 5'

      await debugCommand(ctx)

      expect(ctx.reply).toHaveBeenCalledWith(
        '❌ Invalid debug level. Use 1-3 or omit for default (1).'
      )
    })
  })

  describe('/debug off', () => {
    it('should disable debug mode', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner'
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' },
          from: { id: 123456, is_bot: false },
          text: '/debug off'
        }
      })

      ctx.env.BOT_OWNER_IDS = '123456'
      ctx.match = 'off'

      // Mock DB
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true })
      })

      await debugCommand(ctx)

      expect(ctx.reply).toHaveBeenCalledWith('🐛 Debug mode disabled')
    })
  })

  describe('/debug status', () => {
    it('should show debug status when enabled', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner'
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' },
          from: { id: 123456, is_bot: false },
          text: '/debug status'
        }
      })

      ctx.env.BOT_OWNER_IDS = '123456'
      ctx.match = 'status'

      // Mock DB to return debug level 2
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ value: '2', updated_at: '2025-01-18T10:00:00Z' })
      })

      await debugCommand(ctx)

      expect(ctx.reply).toHaveBeenCalledWith('🐛 Debug mode: Status: Enabled\nLevel: 2', {
        parse_mode: 'HTML'
      })
    })

    it('should show debug status when disabled', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner'
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' },
          from: { id: 123456, is_bot: false },
          text: '/debug status'
        }
      })

      ctx.env.BOT_OWNER_IDS = '123456'
      ctx.match = 'status'

      // Mock DB to return debug level 0 (disabled)
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ value: '0', updated_at: '2025-01-18T10:00:00Z' })
      })

      await debugCommand(ctx)

      expect(ctx.reply).toHaveBeenCalledWith('🐛 Debug mode: Status: Disabled', {
        parse_mode: 'HTML'
      })
    })
  })

  describe('Invalid commands', () => {
    it('should show help for invalid subcommand', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner'
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' },
          from: { id: 123456, is_bot: false },
          text: '/debug invalid'
        }
      })

      ctx.env.BOT_OWNER_IDS = '123456'
      ctx.match = 'invalid'

      await debugCommand(ctx)

      const replyContent = ctx.reply.mock.calls[0][0]
      expect(replyContent).toContain('🐛 Debug Mode Control')
      expect(replyContent).toContain('Usage:')
      expect(replyContent).toContain('/debug on')
      expect(replyContent).toContain('/debug off')
      expect(replyContent).toContain('/debug status')
    })

    it('should show help when no subcommand provided', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner'
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' },
          from: { id: 123456, is_bot: false },
          text: '/debug'
        }
      })

      ctx.env.BOT_OWNER_IDS = '123456'
      ctx.match = ''

      await debugCommand(ctx)

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('🐛 Debug Mode Control'), {
        parse_mode: 'HTML'
      })
    })
  })

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner'
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' },
          from: { id: 123456, is_bot: false },
          text: '/debug on'
        }
      })

      ctx.env.BOT_OWNER_IDS = '123456'
      ctx.match = 'on'

      // Mock DB to throw error
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockRejectedValue(new Error('Database error'))
      })

      await debugCommand(ctx)

      expect(ctx.reply).toHaveBeenCalledWith('❌ Failed to enable debug mode. Please try again.')
    })
  })

  describe('Message details', () => {
    it('should include correct explanations for each debug level', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner'
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' },
          from: { id: 123456, is_bot: false },
          text: '/debug status'
        }
      })

      ctx.env.BOT_OWNER_IDS = '123456'
      ctx.match = 'status'

      // Mock DB to return debug level 1
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ value: '1', updated_at: '2025-01-18T10:00:00Z' })
      })

      await debugCommand(ctx)

      const replyContent = ctx.reply.mock.calls[0][0]
      expect(replyContent).toContain('🐛 Debug mode:')
      expect(replyContent).toContain('Level: 1')
    })
  })
})
