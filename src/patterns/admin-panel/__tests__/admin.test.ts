import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createMockContext } from '../../../__tests__/utils/mock-context';

import { adminCommand } from '@/adapters/telegram/commands/owner/admin';

// Mock the auth module
vi.mock('@/middleware/auth', () => ({
  requireOwner: vi.fn((_ctx, next) => next()),
  isOwner: vi.fn().mockReturnValue(true),
}));

describe('Admin Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('/admin add', () => {
    it('should add a new admin by user ID', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner',
          username: 'owner',
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' as const, first_name: 'Test', last_name: 'User' },
          from: { id: 123456, is_bot: false, first_name: 'Test' },
          text: '/admin add 789012',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'add 789012';

      // Mock DB for user lookup and insert
      let callCount = 0;
      if (!ctx.env.DB) throw new Error('DB not available');
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // User lookup
            return Promise.resolve({
              telegram_id: 789012,
              username: 'newadmin',
              first_name: 'New Admin',
            });
          }
          return Promise.resolve(null);
        }),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      await adminCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith('✅ User @newadmin is now an admin', {
        parse_mode: 'HTML',
      });

      // Verify notification was sent
      expect(ctx.api.sendMessage).toHaveBeenCalledWith(
        789012,
        '🎉 You have been granted admin rights',
      );
    });

    it('should add admin from forwarded message', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner',
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' as const, first_name: 'Test', last_name: 'User' },
          from: { id: 123456, is_bot: false, first_name: 'Test' },
          text: '/admin add',
          forward_origin: {
            type: 'user',
            date: Date.now(),
            sender_user: {
              id: 789012,
              is_bot: false,
              first_name: 'Forwarded User',
              username: 'fwduser',
            },
          },
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'add';

      // Mock DB
      if (ctx.env.DB) {
        ctx.env.DB.prepare = vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({
            telegram_id: 789012,
            username: 'fwduser',
            first_name: 'Forwarded User',
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
        });
      }

      await adminCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith('✅ User @fwduser is now an admin', {
        parse_mode: 'HTML',
      });
    });

    it('should handle user not found', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner',
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' as const, first_name: 'Test', last_name: 'User' },
          from: { id: 123456, is_bot: false, first_name: 'Test' },
          text: '/admin add 999999',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'add 999999';

      // Mock DB to return no user
      if (!ctx.env.DB) throw new Error('DB not available');
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      });

      await adminCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        '❌ User not found. They must have used the bot at least once.',
      );
    });

    it('should handle adding owner as admin gracefully', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner',
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' as const, first_name: 'Test', last_name: 'User' },
          from: { id: 123456, is_bot: false, first_name: 'Test' },
          text: '/admin add 123456',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'add 123456';

      // Mock DB to return owner as already having admin role
      let callCount = 0;
      if (!ctx.env.DB) throw new Error('DB not available');
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // User lookup - owner exists
            return Promise.resolve({
              telegram_id: 123456,
              username: 'owner',
              first_name: 'Owner',
            });
          } else {
            // Role check - already admin (owners are always admins)
            return Promise.resolve({ role: 'admin' });
          }
        }),
      });

      await adminCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith('❌ User is already an admin');
    });
  });

  describe('/admin remove', () => {
    it('should remove admin rights', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner',
          username: 'owner',
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' as const, first_name: 'Test', last_name: 'User' },
          from: { id: 123456, is_bot: false, first_name: 'Test' },
          text: '/admin remove 789012',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'remove 789012';

      // Mock DB
      let callCount = 0;
      if (!ctx.env.DB) throw new Error('DB not available');
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // Check if user exists and is admin
            return Promise.resolve({
              telegram_id: 789012,
              username: 'exadmin',
              first_name: 'Ex Admin',
              role: 'admin',
            });
          }
          return Promise.resolve(null);
        }),
        run: vi.fn().mockResolvedValue({
          success: true,
          meta: { changes: 1 },
        }),
      });

      await adminCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith('✅ User 789012 is no longer an admin', {
        parse_mode: 'HTML',
      });

      // Verify notification was sent
      expect(ctx.api.sendMessage).toHaveBeenCalledWith(
        789012,
        'Your admin rights have been revoked',
      );
    });

    it('should handle user not being admin', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner',
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' as const, first_name: 'Test', last_name: 'User' },
          from: { id: 123456, is_bot: false, first_name: 'Test' },
          text: '/admin remove 789012',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'remove 789012';

      // Mock DB to return user without admin role
      if (!ctx.env.DB) throw new Error('DB not available');
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({
          telegram_id: 789012,
          username: 'user',
          first_name: 'Regular User',
          role: null,
        }),
      });

      await adminCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith('❌ User is not an admin');
    });
  });

  describe('/admin list', () => {
    it('should list all admins', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner',
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' as const, first_name: 'Test', last_name: 'User' },
          from: { id: 123456, is_bot: false, first_name: 'Test' },
          text: '/admin list',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'list';

      // Mock DB to return admin list
      if (!ctx.env.DB) throw new Error('DB not available');
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              telegram_id: 789012,
              username: 'admin1',
              first_name: 'Admin One',
              granted_at: '2025-01-15T10:00:00Z',
              granted_by: 'owner',
            },
            {
              telegram_id: 789013,
              username: null,
              first_name: 'Admin Two',
              granted_at: '2025-01-16T15:00:00Z',
              granted_by: 'owner',
            },
          ],
        }),
      });

      await adminCommand(ctx);

      const replyCalls = vi.mocked(ctx.reply).mock.calls;
      expect(replyCalls.length).toBeGreaterThan(0);
      const replyContent = replyCalls[0]?.[0] as string;
      expect(replyContent).toContain('Current admins:');
      expect(replyContent).toContain('• @admin1 (ID: 789012)');
      expect(replyContent).toContain('• Admin Two (ID: 789013)');
      expect(replyContent).toContain('Added:');
    });

    it('should show no admins message when list is empty', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner',
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' as const, first_name: 'Test', last_name: 'User' },
          from: { id: 123456, is_bot: false, first_name: 'Test' },
          text: '/admin list',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'list';

      // Mock DB to return empty list
      if (!ctx.env.DB) throw new Error('DB not available');
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      await adminCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith('No admins configured yet.');
    });
  });

  describe('Invalid commands', () => {
    it('should show help for invalid subcommand', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner',
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' as const, first_name: 'Test', last_name: 'User' },
          from: { id: 123456, is_bot: false, first_name: 'Test' },
          text: '/admin invalid',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'invalid';

      await adminCommand(ctx);

      const replyCalls = vi.mocked(ctx.reply).mock.calls;
      expect(replyCalls.length).toBeGreaterThan(0);
      const replyContent = replyCalls[0]?.[0] as string;
      expect(replyContent).toContain('📋 Admin Management');
      expect(replyContent).toContain('Usage:');
      expect(replyContent).toContain('/admin add');
      expect(replyContent).toContain('/admin remove');
      expect(replyContent).toContain('/admin list');
    });

    it('should show help when no subcommand provided', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner',
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' as const, first_name: 'Test', last_name: 'User' },
          from: { id: 123456, is_bot: false, first_name: 'Test' },
          text: '/admin',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = '';

      await adminCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('📋 Admin Management'), {
        parse_mode: 'HTML',
      });
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner',
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' as const, first_name: 'Test', last_name: 'User' },
          from: { id: 123456, is_bot: false, first_name: 'Test' },
          text: '/admin list',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'list';

      // Mock DB to throw error
      if (!ctx.env.DB) throw new Error('DB not available');
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      await adminCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith('❌ Failed to list admins');
    });

    it('should handle notification send failures silently', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'Owner',
        },
        message: {
          message_id: 1,
          date: Date.now(),
          chat: { id: 123456, type: 'private' as const, first_name: 'Test', last_name: 'User' },
          from: { id: 123456, is_bot: false, first_name: 'Test' },
          text: '/admin add 789012',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'add 789012';

      // Mock DB
      if (ctx.env.DB) {
        ctx.env.DB.prepare = vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({
            telegram_id: 789012,
            username: 'newadmin',
            first_name: 'New Admin',
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
        });
      }

      // Mock sendMessage to fail
      ctx.api.sendMessage = vi.fn().mockRejectedValue(new Error('Blocked by user'));

      await adminCommand(ctx);

      // Should still succeed and show success message
      expect(ctx.reply).toHaveBeenCalledWith('✅ User @newadmin is now an admin', {
        parse_mode: 'HTML',
      });
    });
  });
});
