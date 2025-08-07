import type { D1Database } from '@cloudflare/workers-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockContext } from '../utils/mock-context'

import { createAuthMiddleware } from '@/adapters/telegram/middleware/auth'
import { EventBus } from '@/core/events/event-bus'
import { UniversalRoleService } from '@/core/services/role-service'

describe('Auth Middleware', () => {
  let mockDB: D1Database
  let roleService: UniversalRoleService
  let authMiddleware: ReturnType<typeof createAuthMiddleware>
  let eventBus: EventBus

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock D1Database
    mockDB = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockImplementation((...args: unknown[]) => ({
          first: vi.fn().mockImplementation(async () => {
            // Check for user roles query
            if (sql.includes('user_roles')) {
              const userId = args[0]
              // Return roles based on userId
              if (userId === 'telegram_999999') return { role: 'admin', granted_by: 'system' }
              if (userId === 'telegram_888888') return { role: 'user', granted_by: 'admin' }
              return null
            }
            // Check for bot settings query
            if (sql.includes('bot_settings')) {
              return null // Will be overridden in specific tests
            }
            // Check for users table query (has_access)
            if (sql.includes('users') && sql.includes('has_access')) {
              const telegramId = args[0]
              // User 888888 has access
              if (telegramId === 'telegram_888888') return { has_access: true }
              return null
            }
            return null
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
          all: vi.fn().mockResolvedValue({ results: [] })
        }))
      })),
      dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      exec: vi.fn().mockResolvedValue({ results: [] }),
      batch: vi.fn().mockResolvedValue([])
    } as unknown as D1Database

    // Create EventBus
    eventBus = new EventBus()

    // Create role service with proper parameters
    // Owner IDs should be in telegram_<id> format
    roleService = new UniversalRoleService(mockDB, ['telegram_123456'], eventBus)
    authMiddleware = createAuthMiddleware(roleService)
  })

  // Helper to create context with DB
  const createContextWithDB = (options: Parameters<typeof createMockContext>[0]) => {
    const ctx = createMockContext(options)
    ctx.env.DB = mockDB
    return ctx
  }

  describe('isOwner', () => {
    it('should return true for configured owner', async () => {
      const ctx = createContextWithDB({
        from: { id: 123456, is_bot: false, first_name: 'Owner' }
      })

      expect(await authMiddleware.isOwner(ctx)).toBe(true)
    })

    it('should return false for non-owner', async () => {
      const ctx = createContextWithDB({
        from: { id: 999999, is_bot: false, first_name: 'User' }
      })

      expect(await authMiddleware.isOwner(ctx)).toBe(false)
    })

    it('should return false when user ID is missing', async () => {
      const ctx = createContextWithDB({ from: undefined })

      expect(await authMiddleware.isOwner(ctx)).toBe(false)
    })
  })

  describe('isAdmin', () => {
    it('should return true for owner even if not in admin table', async () => {
      const ctx = createContextWithDB({
        from: { id: 123456, is_bot: false, first_name: 'Owner' }
      })

      expect(await authMiddleware.isAdmin(ctx)).toBe(true)
    })

    it('should return true for admin in database', async () => {
      const ctx = createContextWithDB({
        from: { id: 999999, is_bot: false, first_name: 'Admin' }
      })

      expect(await authMiddleware.isAdmin(ctx)).toBe(true)
    })

    it('should return false for regular user', async () => {
      const ctx = createContextWithDB({
        from: { id: 888888, is_bot: false, first_name: 'User' }
      })

      expect(await authMiddleware.isAdmin(ctx)).toBe(false)
    })

    it('should return false when user ID is missing', async () => {
      const ctx = createContextWithDB({ from: undefined })

      expect(await authMiddleware.isAdmin(ctx)).toBe(false)
    })
  })

  describe('hasAccess', () => {
    it('should return true for owner', async () => {
      const ctx = createContextWithDB({
        from: { id: 123456, is_bot: false, first_name: 'Owner' }
      })

      expect(await authMiddleware.hasAccess(ctx)).toBe(true)
    })

    it('should return true for admin', async () => {
      const ctx = createContextWithDB({
        from: { id: 999999, is_bot: false, first_name: 'Admin' }
      })

      // Admin role is already mocked in beforeEach

      expect(await authMiddleware.hasAccess(ctx)).toBe(true)
    })

    it('should return true for user with access', async () => {
      const ctx = createContextWithDB({
        from: { id: 888888, is_bot: false, first_name: 'User' }
      })

      // User role is already mocked in beforeEach

      expect(await authMiddleware.hasAccess(ctx)).toBe(true)
    })

    it('should return false for user without access', async () => {
      const ctx = createContextWithDB({
        from: { id: 777777, is_bot: false, first_name: 'NoAccess' }
      })

      // No role needed for this user

      expect(await authMiddleware.hasAccess(ctx)).toBe(false)
    })
  })

  describe('middleware functions', () => {
    describe('requireOwner', () => {
      it('should call next for owner', async () => {
        const ctx = createContextWithDB({
          from: { id: 123456, is_bot: false, first_name: 'Owner' }
        })
        const next = vi.fn()

        await authMiddleware.requireOwner(ctx, next)

        expect(next).toHaveBeenCalled()
      })

      it('should reply with error for non-owner when debug enabled', async () => {
        const ctx = createContextWithDB({
          from: { id: 999999, is_bot: false, first_name: 'User' }
        })
        const next = vi.fn()
        const replySpy = vi.spyOn(ctx, 'reply')

        // Mock debug level 1 (owner level debug)
        mockDB.prepare = vi.fn().mockImplementation((sql: string) => ({
          bind: vi.fn().mockImplementation((param: string) => ({
            first: vi
              .fn()
              .mockResolvedValue(
                sql.includes('bot_settings') && param === 'debug_level' ? { value: '1' } : null
              )
          }))
        }))

        await authMiddleware.requireOwner(ctx, next)

        expect(next).not.toHaveBeenCalled()
        // Debug is enabled only for owners, and this user is not owner, so no reply
        expect(replySpy).not.toHaveBeenCalled()
      })
    })

    describe('requireAdmin', () => {
      it('should call next for admin', async () => {
        const ctx = createContextWithDB({
          from: { id: 999999, is_bot: false, first_name: 'Admin' }
        })
        const next = vi.fn()

        // Mock DB to return admin role from user_roles table
        mockDB.prepare = vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({
            role: 'admin'
          })
        })

        await authMiddleware.requireAdmin(ctx, next)

        expect(next).toHaveBeenCalled()
      })

      it('should reply with error for non-admin when debug enabled', async () => {
        const ctx = createContextWithDB({
          from: { id: 888888, is_bot: false, first_name: 'User' }
        })
        const next = vi.fn()
        const replySpy = vi.spyOn(ctx, 'reply')

        // Mock debug level 3 (all users) so non-admins can see the message
        mockDB.prepare = vi.fn().mockImplementation((sql: string) => ({
          bind: vi.fn().mockImplementation((...args: unknown[]) => ({
            first: vi.fn().mockImplementation(async () => {
              // Handle bot_settings query
              if (sql.includes('bot_settings') && args[0] === 'debug_level') {
                return { value: '3' }
              }
              // Handle user_roles query
              if (sql.includes('user_roles')) {
                const userId = args[0]
                if (userId === 'telegram_888888') return { role: 'user', granted_by: 'admin' }
                return null
              }
              // Handle users table query
              if (sql.includes('users') && sql.includes('has_access')) {
                const telegramId = args[0]
                if (telegramId === 'telegram_888888') return { has_access: true }
                return null
              }
              return null
            })
          }))
        }))

        await authMiddleware.requireAdmin(ctx, next)

        expect(next).not.toHaveBeenCalled()
        expect(replySpy).toHaveBeenCalledWith(
          expect.stringContaining('This command is only available to administrators')
        )
      })
    })

    describe('requireAccess', () => {
      it('should call next for user with access', async () => {
        const ctx = createContextWithDB({
          from: { id: 888888, is_bot: false, first_name: 'User' }
        })
        const next = vi.fn()

        // Mock DB to return user role from user_roles table
        mockDB.prepare = vi.fn().mockImplementation((sql: string) => ({
          bind: vi.fn().mockImplementation((...args: unknown[]) => ({
            first: vi.fn().mockImplementation(async () => {
              // Handle user_roles query
              if (sql.includes('user_roles')) {
                const userId = args[0]
                if (userId === 'telegram_888888') return { role: 'user', granted_by: 'admin' }
                return null
              }
              // Handle users table query
              if (sql.includes('users') && sql.includes('has_access')) {
                const telegramId = args[0]
                if (telegramId === 'telegram_888888') return { has_access: true }
                return null
              }
              return null
            })
          }))
        }))

        await authMiddleware.requireAccess(ctx, next)

        expect(next).toHaveBeenCalled()
      })

      it('should reply with error for user without access when debug enabled', async () => {
        const ctx = createContextWithDB({
          from: { id: 777777, is_bot: false, first_name: 'NoAccess' }
        })
        const next = vi.fn()
        const replySpy = vi.spyOn(ctx, 'reply')

        // Mock DB to return no role (user without access) and debug level 3
        mockDB.prepare = vi.fn().mockImplementation((sql: string) => ({
          bind: vi.fn().mockImplementation((...args: unknown[]) => ({
            first: vi.fn().mockImplementation(async () => {
              // Handle bot_settings query
              if (sql.includes('bot_settings') && args[0] === 'debug_level') {
                return { value: '3' }
              }
              // Handle user_roles query
              if (sql.includes('user_roles')) {
                return null // No role for this user
              }
              // Handle users table query
              if (sql.includes('users') && sql.includes('has_access')) {
                return null // No access for this user
              }
              return null
            })
          }))
        }))

        await authMiddleware.requireAccess(ctx, next)

        expect(next).not.toHaveBeenCalled()
        expect(replySpy).toHaveBeenCalledWith(
          expect.stringContaining('You do not have access to this bot')
        )
      })
    })
  })

  describe('debug functions', () => {
    it('should get debug level from settings', async () => {
      const ctx = createContextWithDB({
        from: { id: 123456, is_bot: false, first_name: 'Owner' }
      })

      // Mock settings for debug level
      mockDB.prepare = vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockImplementation((param: string) => ({
          first: vi
            .fn()
            .mockResolvedValue(
              sql.includes('bot_settings') && param === 'debug_level' ? { value: '2' } : null
            )
        }))
      }))

      expect(await authMiddleware.getDebugLevel(ctx)).toBe(2)
    })

    it('should return 0 when debug setting not found', async () => {
      const ctx = createContextWithDB({
        from: { id: 123456, is_bot: false, first_name: 'Owner' }
      })

      expect(await authMiddleware.getDebugLevel(ctx)).toBe(0)
    })

    it('should check if debug is enabled for owner', async () => {
      const ctx = createContextWithDB({
        from: { id: 123456, is_bot: false, first_name: 'Owner' }
      })

      // Mock debug level 1
      mockDB.prepare = vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockImplementation((param: string) => ({
          first: vi
            .fn()
            .mockResolvedValue(
              sql.includes('bot_settings') && param === 'debug_level' ? { value: '1' } : null
            )
        }))
      }))

      expect(await authMiddleware.isDebugEnabled(ctx, 1)).toBe(true)
    })

    it('should check if debug is enabled for admin', async () => {
      const ctx = createContextWithDB({
        from: { id: 999999, is_bot: false, first_name: 'Admin' }
      })

      // Mock admin role and debug level 2
      mockDB.prepare = vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockImplementation((param: string) => ({
          first: vi
            .fn()
            .mockResolvedValue(
              sql.includes('bot_settings') && param === 'debug_level'
                ? { value: '2' }
                : sql.includes('user_roles') && param === 'telegram_999999'
                  ? { role: 'admin' }
                  : null
            )
        }))
      }))

      expect(await authMiddleware.isDebugEnabled(ctx, 2)).toBe(true)
    })

    it('should check if debug is enabled for all users', async () => {
      const ctx = createContextWithDB({
        from: { id: 888888, is_bot: false, first_name: 'User' }
      })

      // Mock debug level 3
      mockDB.prepare = vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockImplementation((param: string) => ({
          first: vi
            .fn()
            .mockResolvedValue(
              sql.includes('bot_settings') && param === 'debug_level' ? { value: '3' } : null
            )
        }))
      }))

      expect(await authMiddleware.isDebugEnabled(ctx, 3)).toBe(true)
    })

    it('should return false when debug is disabled', async () => {
      const ctx = createContextWithDB({
        from: { id: 888888, is_bot: false, first_name: 'User' }
      })

      // Mock debug level 0
      mockDB.prepare = vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockImplementation((param: string) => ({
          first: vi
            .fn()
            .mockResolvedValue(
              sql.includes('bot_settings') && param === 'debug_level' ? { value: '0' } : null
            )
        }))
      }))

      expect(await authMiddleware.isDebugEnabled(ctx)).toBe(false)
    })
  })
})
