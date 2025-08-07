import { vi } from 'vitest'

export const mockUserService = {
  createOrUpdateUser: vi.fn().mockResolvedValue({
    id: 1,
    telegramId: 123456,
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    languageCode: 'en',
    isPremium: false,
    starsBalance: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }),
  getByTelegramId: vi.fn().mockResolvedValue(null),
  getById: vi.fn().mockResolvedValue(null),
  updateStarsBalance: vi.fn().mockResolvedValue(undefined)
}

export const getUserService = vi.fn(() => mockUserService)
