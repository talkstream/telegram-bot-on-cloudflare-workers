import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockContext } from '../utils/mock-context'

import { infoCommand } from '@/adapters/telegram/commands/owner/info'

// Mock the auth module
vi.mock('@/middleware/auth', () => ({
  requireOwner: vi.fn((ctx, next) => next()),
  isOwner: vi.fn().mockReturnValue(true)
}))

describe('Info Command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-18T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should display system information for owner', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'Owner',
        username: 'owner'
      }
    })

    // Mock environment
    ctx.env.ENVIRONMENT = 'production'
    ctx.env.TIER = 'paid' // Keep for CloudflareConnector to read
    ctx.env.BOT_OWNER_IDS = '123456'

    // Mock session with bot start time
    ctx.session.data = { botStartTime: new Date('2025-01-18T09:29:15Z').getTime() }

    // Mock DB queries
    let callCount = 0
    ctx.env.DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockImplementation(() => {
        callCount++
        // Mock different queries based on call order
        switch (callCount) {
          case 1: // User statistics
            return Promise.resolve({ total_users: 100, active_users: 50 })
          case 2: // Access requests stats
            return Promise.resolve({
              pending_requests: 5,
              approved_requests: 80,
              rejected_requests: 10
            })
          default:
            return Promise.resolve(null)
        }
      }),
      all: vi.fn().mockResolvedValue({
        results: [
          { role: 'owner', count: 1 },
          { role: 'admin', count: 3 },
          { role: 'user', count: 96 }
        ]
      })
    })

    // Mock KV sessions
    ctx.env.SESSIONS.list = vi.fn().mockResolvedValue({
      keys: [
        { name: 'session1', metadata: {} },
        { name: 'session2', metadata: {} },
        { name: 'session3', metadata: {} }
      ],
      list_complete: true,
      cursor: null
    })

    // Mock active sessions
    ctx.env.SESSIONS.get = vi.fn().mockImplementation(key => {
      const sessions: Record<string, { lastActivity: number }> = {
        session1: { lastActivity: Date.now() - 10 * 60 * 1000 }, // 10 minutes ago
        session2: { lastActivity: Date.now() - 45 * 60 * 1000 }, // 45 minutes ago (inactive)
        session3: { lastActivity: Date.now() - 5 * 60 * 1000 } // 5 minutes ago
      }
      return Promise.resolve(sessions[key])
    })

    // Mock AI service
    ctx.services.ai = {
      getActiveProvider: () => 'gemini',
      listProviders: () => ['gemini', 'openai'],
      getCostInfo: () => ({ total: 1.2345 })
    }

    await infoCommand(ctx)

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('📊 System Information'), {
      parse_mode: 'HTML'
    })

    const replyContent = ctx.reply.mock.calls[0][0]
    expect(replyContent).toContain('Environment: production')
    expect(replyContent).toContain('Tier: paid')
    expect(replyContent).toContain('Uptime: 2h 30m')
    expect(replyContent).toContain('Total Users: 100')
    expect(replyContent).toContain('Active Users: 50')
    expect(replyContent).toContain('Active Sessions: 2') // Only 2 are active in last 30 mins
    expect(replyContent).toContain('gemini (2 providers available)')
    expect(replyContent).toContain('Total Cost: $1.2345')
  })

  it('should show access request statistics', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'Owner'
      }
    })

    ctx.env.BOT_OWNER_IDS = '123456'

    // Mock DB queries with specific access request stats
    let callCount = 0
    ctx.env.DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 2) {
          // Access requests stats
          return Promise.resolve({
            pending_requests: 10,
            approved_requests: 200,
            rejected_requests: 50
          })
        }
        return Promise.resolve({ total_users: 0, active_users: 0 })
      }),
      all: vi.fn().mockResolvedValue({ results: [] })
    })

    // Mock empty sessions
    ctx.env.SESSIONS.list = vi.fn().mockResolvedValue({
      keys: [],
      list_complete: true,
      cursor: null
    })

    await infoCommand(ctx)

    const replyContent = ctx.reply.mock.calls[0][0]
    expect(replyContent).toContain('Access Requests:')
    expect(replyContent).toContain('• Pending: 10')
    expect(replyContent).toContain('• Approved: 200')
    expect(replyContent).toContain('• Rejected: 50')
  })

  it('should show role distribution', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'Owner'
      }
    })

    ctx.env.BOT_OWNER_IDS = '123456'

    // Mock DB queries with specific role distribution
    ctx.env.DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ total_users: 0, active_users: 0 }),
      all: vi.fn().mockResolvedValue({
        results: [
          { role: 'owner', count: 2 },
          { role: 'admin', count: 5 },
          { role: 'user', count: 93 }
        ]
      })
    })

    // Mock empty sessions
    ctx.env.SESSIONS.list = vi.fn().mockResolvedValue({
      keys: [],
      list_complete: true,
      cursor: null
    })

    await infoCommand(ctx)

    const replyContent = ctx.reply.mock.calls[0][0]
    expect(replyContent).toContain('Role Distribution:')
    expect(replyContent).toContain('owner: 2')
    expect(replyContent).toContain('admin: 5')
    expect(replyContent).toContain('user: 93')
  })

  it('should handle AI service not available', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'Owner'
      }
    })

    ctx.env.BOT_OWNER_IDS = '123456'
    ctx.env.TIER = 'free'

    // AI service is null by default in mock context
    ctx.services.ai = null

    // Mock DB queries
    ctx.env.DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ total_users: 0, active_users: 0 }),
      all: vi.fn().mockResolvedValue({ results: [] })
    })

    // Mock empty sessions
    ctx.env.SESSIONS.list = vi.fn().mockResolvedValue({
      keys: [],
      list_complete: true,
      cursor: null
    })

    await infoCommand(ctx)

    const replyContent = ctx.reply.mock.calls[0][0]
    expect(replyContent).toContain('AI Provider:')
    expect(replyContent).toContain('• Not configured')
  })

  it('should handle database errors gracefully', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'Owner'
      }
    })

    ctx.env.BOT_OWNER_IDS = '123456'

    // Mock DB to throw error
    ctx.env.DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockRejectedValue(new Error('Database error'))
    })

    await infoCommand(ctx)

    expect(ctx.reply).toHaveBeenCalledWith('❌ Failed to retrieve system information')
  })

  it('should calculate uptime correctly', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'Owner'
      }
    })

    ctx.env.BOT_OWNER_IDS = '123456'

    // Set a specific start time and current time
    ctx.session.data = { botStartTime: new Date('2025-01-18T09:29:15Z').getTime() }
    vi.setSystemTime(new Date('2025-01-18T12:00:00Z'))

    // Mock DB queries
    ctx.env.DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ total_users: 0, active_users: 0 }),
      all: vi.fn().mockResolvedValue({ results: [] })
    })

    // Mock empty sessions
    ctx.env.SESSIONS.list = vi.fn().mockResolvedValue({
      keys: [],
      list_complete: true,
      cursor: null
    })

    await infoCommand(ctx)

    const replyContent = ctx.reply.mock.calls[0][0]
    expect(replyContent).toContain('Uptime: 2h 30m')
  })
})
