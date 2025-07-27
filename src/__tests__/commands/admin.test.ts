import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import { createMockContext } from '../utils/mock-context';
import { createMockD1PreparedStatement } from '../helpers/test-helpers';

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
          chat: { id: 123456, type: 'private', first_name: 'Owner' },
          from: { id: 123456, is_bot: false, first_name: 'Owner' },
          text: '/admin add 789012',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'add 789012';

      // Mock DB for user lookup and insert
      let callCount = 0;
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockImplementation(() => {
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
      });
      mockPreparedStatement.run.mockResolvedValue({ success: true, meta: {} });

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

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
          chat: { id: 123456, type: 'private', first_name: 'Owner' },
          from: { id: 123456, is_bot: false, first_name: 'Owner' },
          text: '/admin add',
          forward_from: {
            id: 789012,
            is_bot: false,
            first_name: 'Forwarded User',
            username: 'fwduser',
          },
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'add';

      // Mock DB
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockResolvedValue({
        telegram_id: 789012,
        username: 'fwduser',
        first_name: 'Forwarded User',
      });
      mockPreparedStatement.run.mockResolvedValue({ success: true, meta: {} });

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
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
          chat: { id: 123456, type: 'private', first_name: 'Owner' },
          from: { id: 123456, is_bot: false, first_name: 'Owner' },
          text: '/admin add 999999',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'add 999999';

      // Mock DB to return no user
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockResolvedValue(null);

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

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
          chat: { id: 123456, type: 'private', first_name: 'Owner' },
          from: { id: 123456, is_bot: false, first_name: 'Owner' },
          text: '/admin add 123456',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'add 123456';

      // Mock DB to return owner as already having admin role
      let callCount = 0;
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockImplementation(() => {
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
      });

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

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
          chat: { id: 123456, type: 'private', first_name: 'Owner' },
          from: { id: 123456, is_bot: false, first_name: 'Owner' },
          text: '/admin remove 789012',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'remove 789012';

      // Mock DB
      let callCount = 0;
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockImplementation(() => {
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
      });
      mockPreparedStatement.run.mockResolvedValue({
        success: true,
        meta: { changes: 1 },
      });

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

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
          chat: { id: 123456, type: 'private', first_name: 'Owner' },
          from: { id: 123456, is_bot: false, first_name: 'Owner' },
          text: '/admin remove 789012',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'remove 789012';

      // Mock DB to return user without admin role
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockResolvedValue({
        telegram_id: 789012,
        username: 'user',
        first_name: 'Regular User',
        role: null,
      });

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

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
          chat: { id: 123456, type: 'private', first_name: 'Owner' },
          from: { id: 123456, is_bot: false, first_name: 'Owner' },
          text: '/admin list',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'list';

      // Mock DB to return admin list
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.all.mockResolvedValue({
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
        success: true,
        meta: {},
      });

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

      await adminCommand(ctx);

      const replyContent = (ctx.reply as Mock).mock.calls[0][0];
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
          chat: { id: 123456, type: 'private', first_name: 'Owner' },
          from: { id: 123456, is_bot: false, first_name: 'Owner' },
          text: '/admin list',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'list';

      // Mock DB to return empty list
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.all.mockResolvedValue({ results: [], success: true, meta: {} });

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

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
          chat: { id: 123456, type: 'private', first_name: 'Owner' },
          from: { id: 123456, is_bot: false, first_name: 'Owner' },
          text: '/admin invalid',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'invalid';

      await adminCommand(ctx);

      const replyContent = (ctx.reply as Mock).mock.calls[0][0];
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
          chat: { id: 123456, type: 'private', first_name: 'Owner' },
          from: { id: 123456, is_bot: false, first_name: 'Owner' },
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
          chat: { id: 123456, type: 'private', first_name: 'Owner' },
          from: { id: 123456, is_bot: false, first_name: 'Owner' },
          text: '/admin list',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'list';

      // Mock DB to throw error
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.all.mockRejectedValue(new Error('Database error'));

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

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
          chat: { id: 123456, type: 'private', first_name: 'Owner' },
          from: { id: 123456, is_bot: false, first_name: 'Owner' },
          text: '/admin add 789012',
        },
      });

      ctx.env.BOT_OWNER_IDS = '123456';
      ctx.match = 'add 789012';

      // Mock DB
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockResolvedValue({
        telegram_id: 789012,
        username: 'newadmin',
        first_name: 'New Admin',
      });
      mockPreparedStatement.run.mockResolvedValue({ success: true, meta: {} });

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

      // Mock sendMessage to fail
      (ctx.api.sendMessage as Mock).mockRejectedValue(new Error('Blocked by user'));

      await adminCommand(ctx);

      // Should still succeed and show success message
      expect(ctx.reply).toHaveBeenCalledWith('✅ User @newadmin is now an admin', {
        parse_mode: 'HTML',
      });
    });
  });
});
