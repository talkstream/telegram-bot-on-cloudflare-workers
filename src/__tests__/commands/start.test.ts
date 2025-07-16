import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createMockContext } from '../utils/mock-context';
import { mockUserService } from '../mocks/user-service';

import { startCommand } from '@/adapters/telegram/commands/start';

// Mock the user service module
vi.mock('@/services/user-service', () => ({
  getUserService: () => mockUserService,
}));

describe('Start Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send welcome message with inline keyboard', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'John',
        username: 'johndoe',
        language_code: 'en',
      },
      me: {
        id: 987654,
        is_bot: true,
        first_name: 'Test Bot',
        username: 'testbot',
      },
    });

    await startCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Welcome to Test Bot'),
      expect.objectContaining({
        parse_mode: 'MarkdownV2',
        reply_markup: expect.objectContaining({
          inline_keyboard: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({ text: '📝 Help' }),
              expect.objectContaining({ text: '⚙️ Settings' }),
            ]),
          ]),
        }),
      })
    );
  });

  it('should create or update user in database', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'John',
        username: 'johndoe',
        language_code: 'en',
        is_premium: true,
      },
    });

    // Configure mock for this test
    mockUserService.createOrUpdateUser.mockResolvedValueOnce({
      id: 1,
      telegramId: 123456,
      username: 'johndoe',
      firstName: 'John',
      lastName: undefined,
      languageCode: 'en',
      isPremium: true,
      starsBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await startCommand(ctx);

    expect(mockUserService.createOrUpdateUser).toHaveBeenCalledWith({
      telegramId: 123456,
      username: 'johndoe',
      firstName: 'John',
      lastName: undefined,
      languageCode: 'en',
      isPremium: true,
    });
  });

  it('should update session data', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'John',
      },
    });

    await startCommand(ctx);

    expect(ctx.session.userId).toBe(1);
    expect(ctx.session.lastCommand).toBe('start');
    expect(ctx.session.lastActivity).toBeGreaterThan(0);
  });

  it('should handle missing user ID', async () => {
    const ctx = createMockContext({
      from: undefined,
    });

    await startCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith('❌ Unable to identify user');
  });

  it('should handle errors gracefully', async () => {
    const ctx = createMockContext({
      from: {
        id: 123456,
        is_bot: false,
        first_name: 'John',
      },
    });

    // Configure mock to throw error
    mockUserService.createOrUpdateUser.mockRejectedValueOnce(
      new Error('Database error')
    );

    await startCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      '❌ An error occurred. Please try again later.'
    );
  });
});
