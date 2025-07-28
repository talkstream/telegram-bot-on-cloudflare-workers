import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Import mocks before other imports
import '../mocks/logger';
import '../setup/grammy-mock';

import { createMockCallbackContext } from '../utils/mock-context';
import { createMockD1PreparedStatement } from '../helpers/test-helpers';

import {
  handleAccessRequest,
  handleAccessStatus,
  handleAccessCancel,
  handleAccessApprove,
  handleAccessReject,
  handleNextRequest,
} from '@/adapters/telegram/callbacks/access';

// Mock the auth module
vi.mock('@/middleware/auth', () => ({
  isAdmin: vi.fn().mockReturnValue(true),
  isOwner: vi.fn().mockReturnValue(false),
}));

// InlineKeyboard is already mocked in setup/grammy-mock.ts

describe('Access Callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('handleAccessRequest', () => {
    it('should create a new access request', async () => {
      const ctx = createMockCallbackContext('access:request', {
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'User',
          username: 'testuser',
        },
      });

      // Create proper mock for DB.prepare
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockResolvedValue(null);

      // Ensure DB exists and has proper mock
      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

      await handleAccessRequest(ctx);

      expect(ctx.editMessageText).toHaveBeenCalledWith(
        'Your access request has been sent to the administrators.',
        { parse_mode: 'HTML' },
      );

      // Verify DB operations
      if (ctx.env.DB) {
        const preparedCalls = (ctx.env.DB.prepare as Mock).mock.calls;
        expect(preparedCalls[0]?.[0]).toContain('SELECT id FROM access_requests');
        expect(preparedCalls[1]?.[0]).toContain('INSERT INTO access_requests');
      }
    });

    it('should handle existing pending request', async () => {
      const ctx = createMockCallbackContext('access:request', {
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'User',
          username: 'testuser',
        },
      });

      // Mock DB - existing request
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockResolvedValue({ id: 1, status: 'pending' });

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

      await handleAccessRequest(ctx);

      // Should only answer callback query, not edit message
      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
        'You already have a pending access request.',
      );
      expect(ctx.editMessageText).not.toHaveBeenCalled();
    });

    it('should allow new request if previous was approved', async () => {
      const ctx = createMockCallbackContext('access:request', {
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'User',
          username: 'testuser',
        },
      });

      // Mock DB - no pending request (approved requests don't block new ones)
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockResolvedValue(null); // No pending request found

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

      await handleAccessRequest(ctx);

      // Should create new request since only pending requests block
      expect(ctx.editMessageText).toHaveBeenCalledWith(
        'Your access request has been sent to the administrators.',
        { parse_mode: 'HTML' },
      );
    });

    it('should handle database errors gracefully', async () => {
      const ctx = createMockCallbackContext('access:request', {
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'User',
          username: 'testuser',
        },
      });

      // Mock DB error
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockRejectedValue(new Error('DB Error'));

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

      await handleAccessRequest(ctx);

      // Should only answer callback query on error
      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
        '❌ An error occurred. Please try again later.',
      );
      expect(ctx.editMessageText).not.toHaveBeenCalled();
    });
  });

  describe('handleAccessStatus', () => {
    it('should show pending status message', async () => {
      const ctx = createMockCallbackContext('access:status', {
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'User',
          username: 'testuser',
        },
      });

      await handleAccessStatus(ctx);

      // Should only answer callback query with pending message
      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
        'Your access request is pending approval.',
      );
      expect(ctx.editMessageText).not.toHaveBeenCalled();
    });
  });

  describe('handleAccessCancel', () => {
    it('should cancel pending request', async () => {
      const ctx = createMockCallbackContext('access:cancel', {
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'User',
          username: 'testuser',
        },
      });

      // Mock DB operations
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockResolvedValue({ id: 1, status: 'pending' });

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

      await handleAccessCancel(ctx, '1');

      expect(ctx.editMessageText).toHaveBeenCalledWith('Your access request has been cancelled.', {
        parse_mode: 'HTML',
      });
    });

    it('should handle no request to cancel', async () => {
      const ctx = createMockCallbackContext('access:cancel', {
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'User',
          username: 'testuser',
        },
      });

      // Mock DB - no request
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockResolvedValue(null);

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

      await handleAccessCancel(ctx, '1');

      // Should only answer callback query
      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith('Request not found.');
      expect(ctx.editMessageText).not.toHaveBeenCalled();
    });
  });

  describe('handleAccessApprove', () => {
    it('should approve access request', async () => {
      const ctx = createMockCallbackContext('approve_1', {
        from: {
          id: 789012,
          is_bot: false,
          first_name: 'Admin',
          username: 'admin',
        },
      });

      // Mock DB operations
      const mockSelectStatement = createMockD1PreparedStatement();
      mockSelectStatement.first.mockResolvedValue({
        id: 1,
        user_id: 123456,
        username: 'testuser',
        first_name: 'Test User',
        status: 'pending',
      });

      const mockUpdateStatement = createMockD1PreparedStatement();
      mockUpdateStatement.run.mockResolvedValue({ success: true, meta: {} });

      if (ctx.env.DB) {
        const prepareMock = ctx.env.DB.prepare as Mock;
        prepareMock
          .mockReturnValueOnce(mockSelectStatement) // SELECT request
          .mockReturnValueOnce(mockUpdateStatement) // UPDATE request status
          .mockReturnValueOnce(mockUpdateStatement); // INSERT/UPDATE user
      }

      // Mock api.sendMessage
      (ctx.api.sendMessage as Mock).mockResolvedValue({ ok: true });

      await handleAccessApprove(ctx, '1');

      expect(ctx.editMessageText).toHaveBeenCalled();
      const call = (ctx.editMessageText as Mock).mock.calls[0];
      expect(call?.[0]).toContain('✅ Access granted to user 123456 (@testuser)');
      expect(call?.[1]).toMatchObject({
        parse_mode: 'HTML',
        reply_markup: expect.any(Object),
      });
    });

    it('should handle request not found', async () => {
      const ctx = createMockCallbackContext('approve_999', {
        from: {
          id: 789012,
          is_bot: false,
          first_name: 'Admin',
          username: 'admin',
        },
      });

      // Mock DB - no request
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockResolvedValue(null);

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

      await handleAccessApprove(ctx, '999');

      expect(ctx.answerCallbackQuery).toHaveBeenCalledWith('Request not found.');
      expect(ctx.editMessageText).not.toHaveBeenCalled();
    });
  });

  describe('handleAccessReject', () => {
    it('should reject access request', async () => {
      const ctx = createMockCallbackContext('reject_1', {
        from: {
          id: 789012,
          is_bot: false,
          first_name: 'Admin',
          username: 'admin',
        },
      });

      // Mock DB operations
      const mockSelectStatement = createMockD1PreparedStatement();
      mockSelectStatement.first.mockResolvedValue({
        id: 1,
        user_id: 123456,
        username: 'testuser',
        first_name: 'Test User',
        status: 'pending',
      });

      const mockUpdateStatement = createMockD1PreparedStatement();
      mockUpdateStatement.run.mockResolvedValue({ success: true, meta: {} });

      if (ctx.env.DB) {
        const prepareMock = ctx.env.DB.prepare as Mock;
        prepareMock
          .mockReturnValueOnce(mockSelectStatement) // SELECT request
          .mockReturnValueOnce(mockUpdateStatement); // UPDATE request status
      }

      // Mock api.sendMessage
      (ctx.api.sendMessage as Mock).mockResolvedValue({ ok: true });

      await handleAccessReject(ctx, '1');

      expect(ctx.editMessageText).toHaveBeenCalled();
      const call = (ctx.editMessageText as Mock).mock.calls[0];
      expect(call?.[0]).toContain('❌ Access denied to user 123456 (@testuser)');
      expect(call?.[1]).toMatchObject({
        parse_mode: 'HTML',
        reply_markup: expect.any(Object),
      });
    });
  });

  describe('handleNextRequest', () => {
    it('should show next pending request', async () => {
      const ctx = createMockCallbackContext('request_next', {
        from: {
          id: 789012,
          is_bot: false,
          first_name: 'Admin',
          username: 'admin',
        },
      });

      // Mock DB - get pending request
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockResolvedValue({
        id: 2,
        user_id: 234567,
        username: 'user2',
        first_name: 'User Two',
        created_at: new Date().toISOString(),
      });

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

      await handleNextRequest(ctx);

      // Should show the request with proper buttons
      expect(ctx.editMessageText).toHaveBeenCalled();
      const call = (ctx.editMessageText as Mock).mock.calls[0];
      expect(call?.[0]).toContain('Access Request #2');
      expect(call?.[0]).toContain('User Two');
      expect(call?.[0]).toContain('@user2');
    });

    it('should handle no more pending requests', async () => {
      const ctx = createMockCallbackContext('request_next', {
        from: {
          id: 789012,
          is_bot: false,
          first_name: 'Admin',
          username: 'admin',
        },
      });

      // Mock DB - no pending requests
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockResolvedValue(null);

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

      await handleNextRequest(ctx);

      expect(ctx.editMessageText).toHaveBeenCalledWith('No pending access requests.', {
        parse_mode: 'HTML',
      });
    });
  });
});
