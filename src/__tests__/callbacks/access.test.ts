import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

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

// Mock InlineKeyboard
vi.mock('grammy', () => ({
  InlineKeyboard: vi.fn().mockImplementation(() => {
    const keyboard = {
      _inline_keyboard: [] as Array<Array<{ text: string; callback_data: string }>>,
      currentRow: [] as Array<{ text: string; callback_data: string }>,
      text: vi.fn().mockImplementation(function (
        this: { currentRow: Array<{ text: string; callback_data: string }> },
        text: string,
        data: string,
      ) {
        this.currentRow.push({ text, callback_data: data });
        return this;
      }),
      row: vi.fn().mockImplementation(function (this: {
        currentRow: Array<{ text: string; callback_data: string }>;
        _inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
      }) {
        if (this.currentRow.length > 0) {
          this._inline_keyboard.push(this.currentRow);
          this.currentRow = [];
        }
        return this;
      }),
    };
    // Finalize any pending row when accessed
    Object.defineProperty(keyboard, 'inline_keyboard', {
      get: function (this: {
        currentRow: Array<{ text: string; callback_data: string }>;
        _inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
      }) {
        if (this.currentRow.length > 0) {
          this._inline_keyboard.push(this.currentRow);
          this.currentRow = [];
        }
        return this._inline_keyboard;
      },
    });
    return keyboard;
  }),
}));

describe('Access Callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      mockPreparedStatement.run.mockResolvedValue({ success: true, meta: {} });
      mockPreparedStatement.all.mockResolvedValue({ results: [], success: true, meta: {} });

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
        expect(preparedCalls[0][0]).toContain('SELECT id FROM access_requests');
        expect(preparedCalls[1][0]).toContain('INSERT INTO access_requests');
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

      expect(ctx.editMessageText).toHaveBeenCalledWith(
        'You already have a pending access request.',
        { parse_mode: 'HTML' },
      );
    });

    it('should handle approved request', async () => {
      const ctx = createMockCallbackContext('access:request', {
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'User',
          username: 'testuser',
        },
      });

      // Mock DB - approved request
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockResolvedValue({ id: 1, status: 'approved' });

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

      await handleAccessRequest(ctx);

      expect(ctx.editMessageText).toHaveBeenCalledWith('You already have access to this bot.', {
        parse_mode: 'HTML',
      });
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

      expect(ctx.editMessageText).toHaveBeenCalledWith(
        '❌ An error occurred. Please try again later.',
        { parse_mode: 'HTML' },
      );
    });
  });

  describe('handleAccessStatus', () => {
    it('should show pending status', async () => {
      const ctx = createMockCallbackContext('access:status', {
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'User',
          username: 'testuser',
        },
      });

      // Mock DB - pending request
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockResolvedValue({
        id: 1,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

      await handleAccessStatus(ctx);

      expect(ctx.editMessageText).toHaveBeenCalledWith(
        'Your access request is pending approval.',
        expect.objectContaining({ parse_mode: 'HTML' }),
      );
    });

    it('should show approved status', async () => {
      const ctx = createMockCallbackContext('access:status', {
        from: {
          id: 123456,
          is_bot: false,
          first_name: 'User',
          username: 'testuser',
        },
      });

      // Mock DB - approved request
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockResolvedValue({
        id: 1,
        status: 'approved',
        approved_at: new Date().toISOString(),
      });

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

      await handleAccessStatus(ctx);

      expect(ctx.editMessageText).toHaveBeenCalledWith('You have access to this bot.', {
        parse_mode: 'HTML',
      });
    });

    it('should show no request status', async () => {
      const ctx = createMockCallbackContext('access:status', {
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

      await handleAccessStatus(ctx);

      expect(ctx.editMessageText).toHaveBeenCalledWith(
        '⚠️ You do not have access to this bot.',
        expect.objectContaining({ parse_mode: 'HTML' }),
      );
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
      mockPreparedStatement.run.mockResolvedValue({ success: true, meta: {} });

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

      await handleAccessCancel(ctx);

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

      await handleAccessCancel(ctx);

      expect(ctx.editMessageText).toHaveBeenCalledWith('No access request found to cancel.', {
        parse_mode: 'HTML',
      });
    });
  });

  describe('handleAccessApprove', () => {
    it('should approve access request', async () => {
      const ctx = createMockCallbackContext('access:approve:123456', {
        from: {
          id: 789012,
          is_bot: false,
          first_name: 'Admin',
          username: 'admin',
        },
      });

      // Mock DB operations
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockResolvedValue({
        id: 1,
        user_id: 123456,
        username: 'testuser',
        status: 'pending',
      });
      mockPreparedStatement.run.mockResolvedValue({ success: true, meta: {} });

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

      // Mock api.sendMessage
      (ctx.api.sendMessage as Mock).mockResolvedValue({ ok: true });

      await handleAccessApprove(ctx);

      expect(ctx.editMessageText).toHaveBeenCalledWith(
        '✅ Access granted to user 123456 (@testuser)',
        { parse_mode: 'HTML' },
      );
    });

    it('should handle request not found', async () => {
      const ctx = createMockCallbackContext('access:approve:123456', {
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

      await handleAccessApprove(ctx);

      expect(ctx.editMessageText).toHaveBeenCalledWith('Request not found.', {
        parse_mode: 'HTML',
      });
    });
  });

  describe('handleAccessReject', () => {
    it('should reject access request', async () => {
      const ctx = createMockCallbackContext('access:reject:123456', {
        from: {
          id: 789012,
          is_bot: false,
          first_name: 'Admin',
          username: 'admin',
        },
      });

      // Mock DB operations
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.first.mockResolvedValue({
        id: 1,
        user_id: 123456,
        username: 'testuser',
        status: 'pending',
      });
      mockPreparedStatement.run.mockResolvedValue({ success: true, meta: {} });

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

      // Mock api.sendMessage
      (ctx.api.sendMessage as Mock).mockResolvedValue({ ok: true });

      await handleAccessReject(ctx);

      expect(ctx.editMessageText).toHaveBeenCalledWith(
        '❌ Access denied to user 123456 (@testuser)',
        { parse_mode: 'HTML' },
      );
    });
  });

  describe('handleNextRequest', () => {
    it('should show next pending request', async () => {
      const ctx = createMockCallbackContext('access:next', {
        from: {
          id: 789012,
          is_bot: false,
          first_name: 'Admin',
          username: 'admin',
        },
      });

      // Mock DB - get pending requests
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.all.mockResolvedValue({
        results: [
          {
            id: 2,
            user_id: 234567,
            username: 'user2',
            first_name: 'User Two',
            created_at: new Date().toISOString(),
          },
        ],
        success: true,
        meta: {},
      });

      if (ctx.env.DB) {
        (ctx.env.DB.prepare as Mock).mockReturnValue(mockPreparedStatement);
      }

      await handleNextRequest(ctx);

      // Should show the request with proper buttons
      expect(ctx.editMessageText).toHaveBeenCalled();
      const call = (ctx.editMessageText as Mock).mock.calls[0];
      expect(call[0]).toContain('Access Request #2');
      expect(call[0]).toContain('User Two');
      expect(call[0]).toContain('@user2');
    });

    it('should handle no more pending requests', async () => {
      const ctx = createMockCallbackContext('access:next', {
        from: {
          id: 789012,
          is_bot: false,
          first_name: 'Admin',
          username: 'admin',
        },
      });

      // Mock DB - no pending requests
      const mockPreparedStatement = createMockD1PreparedStatement();
      mockPreparedStatement.all.mockResolvedValue({
        results: [],
        success: true,
        meta: {},
      });

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
