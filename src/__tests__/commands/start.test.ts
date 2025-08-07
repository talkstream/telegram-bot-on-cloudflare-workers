import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockUserService } from '../mocks/user-service'
import { createMockContext } from '../utils/mock-context'

import { startCommand } from '@/adapters/telegram/commands/start'

// Mock the user service module
vi.mock('@/services/user-service', () => ({
  getUserService: () => mockUserService
}))

// Mock role service
const mockRoleService = {
  hasAccess: vi.fn().mockResolvedValue(true),
  isOwner: vi.fn().mockResolvedValue(false),
  isAdmin: vi.fn().mockResolvedValue(false),
  getUserRole: vi.fn().mockResolvedValue('user'),
  hasPermission: vi.fn().mockResolvedValue(false)
}

describe('Start Command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock role service
    mockRoleService.hasAccess.mockResolvedValue(true)
    mockRoleService.isOwner.mockResolvedValue(false)
    mockRoleService.isAdmin.mockResolvedValue(false)
  })

  it('should send welcome message with inline keyboard for users with access', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'John',
        username: 'johndoe',
        language_code: 'en'
      },
      me: {
        id: 987654,
        is_bot: true,
        first_name: 'Test Bot',
        username: 'testbot'
      }
    })
    ctx.roleService = mockRoleService

    // Mock user service response
    mockUserService.createOrUpdateUser.mockResolvedValueOnce({
      id: 1,
      telegramId: 123456,
      username: 'johndoe',
      firstName: 'John',
      lastName: undefined,
      languageCode: 'en',
      isPremium: false,
      starsBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    await startCommand(ctx)

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Welcome to Test Bot'),
      expect.objectContaining({
        parse_mode: 'MarkdownV2',
        reply_markup: expect.objectContaining({
          inline_keyboard: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({ text: '📝 Help' }),
              expect.objectContaining({ text: '⚙️ Settings' })
            ])
          ])
        })
      })
    )
  })

  it('should show access denied message for users without access', async () => {
    mockRoleService.hasAccess.mockResolvedValueOnce(false)

    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'John',
        username: 'johndoe',
        language_code: 'en'
      }
    })
    ctx.roleService = mockRoleService

    // Mock user service response
    mockUserService.createOrUpdateUser.mockResolvedValueOnce({
      id: 1,
      telegramId: 123456,
      username: 'johndoe',
      firstName: 'John',
      lastName: undefined,
      languageCode: 'en',
      isPremium: false,
      starsBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    // Mock DB response for pending request check
    ctx.env.DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null) // No pending request
    })

    await startCommand(ctx)

    expect(ctx.reply).toHaveBeenCalledWith(
      '⚠️ You do not have access to this bot.',
      expect.objectContaining({
        parse_mode: 'HTML'
      })
    )
  })

  it('should show pending request message if user has pending request', async () => {
    mockRoleService.hasAccess.mockResolvedValueOnce(false)

    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'John',
        username: 'johndoe',
        language_code: 'en'
      }
    })
    ctx.roleService = mockRoleService

    // Mock user service response
    mockUserService.createOrUpdateUser.mockResolvedValueOnce({
      id: 1,
      telegramId: 123456,
      username: 'johndoe',
      firstName: 'John',
      lastName: undefined,
      languageCode: 'en',
      isPremium: false,
      starsBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    // Mock DB response for pending request
    ctx.env.DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ id: 1, status: 'pending' })
    })

    await startCommand(ctx)

    expect(ctx.reply).toHaveBeenCalledWith(
      'Your access request is pending approval.',
      expect.objectContaining({
        parse_mode: 'HTML'
      })
    )
  })

  it('should handle users without username', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'John',
        // No username
        language_code: 'en'
      },
      me: {
        id: 987654,
        is_bot: true,
        first_name: 'Test Bot',
        username: 'testbot'
      }
    })
    ctx.roleService = mockRoleService

    // Mock user service response
    mockUserService.createOrUpdateUser.mockResolvedValueOnce({
      id: 1,
      telegramId: 123456,
      username: undefined,
      firstName: 'John',
      lastName: undefined,
      languageCode: 'en',
      isPremium: false,
      starsBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    await startCommand(ctx)

    expect(mockUserService.createOrUpdateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        telegramId: 123456,
        username: undefined,
        firstName: 'John'
      })
    )

    expect(ctx.reply).toHaveBeenCalled()
  })

  it('should use Russian language for Russian users', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'Иван',
        username: 'ivan',
        language_code: 'ru'
      },
      me: {
        id: 987654,
        is_bot: true,
        first_name: 'Test Bot',
        username: 'testbot'
      }
    })
    ctx.roleService = mockRoleService

    // Mock user service response
    mockUserService.createOrUpdateUser.mockResolvedValueOnce({
      id: 1,
      telegramId: 123456,
      username: 'ivan',
      firstName: 'Иван',
      lastName: undefined,
      languageCode: 'ru',
      isPremium: false,
      starsBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    await startCommand(ctx)

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Welcome to Test Bot'),
      expect.any(Object)
    )
  })

  it('should handle errors gracefully', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'John',
        username: 'johndoe'
      }
    })
    ctx.roleService = mockRoleService

    // Mock user service to throw an error
    mockUserService.createOrUpdateUser.mockRejectedValueOnce(new Error('Database error'))

    await startCommand(ctx)

    expect(ctx.reply).toHaveBeenCalledWith('❌ An error occurred. Please try again later.')
  })

  it('should show demo mode message when DB is not available and user has no access', async () => {
    mockRoleService.hasAccess.mockResolvedValueOnce(false)

    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'John',
        username: 'johndoe',
        language_code: 'en'
      }
    })
    ctx.roleService = mockRoleService
    ctx.env.DB = undefined // No database

    // Mock user service response
    mockUserService.createOrUpdateUser.mockResolvedValueOnce({
      id: 1,
      telegramId: 123456,
      username: 'johndoe',
      firstName: 'John',
      lastName: undefined,
      languageCode: 'en',
      isPremium: false,
      starsBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    await startCommand(ctx)

    expect(ctx.reply).toHaveBeenCalledWith(
      '🎯 Demo Mode: This feature requires a database.\nConfigure D1 database to enable this functionality.'
    )
  })
})
