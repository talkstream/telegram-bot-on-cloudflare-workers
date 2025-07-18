import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createMockContext } from '../utils/mock-context';

import {
  hasAccess,
  isOwner,
  isAdmin,
  requireOwner,
  requireAdmin,
  requireAccess,
  getDebugLevel,
  isDebugEnabled,
} from '@/middleware/auth';

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isOwner', () => {
    it('should return true for configured owner', () => {
      const ctx = createMockContext({
        from: { id: 123456, is_bot: false, first_name: 'Owner' },
      });
      ctx.env.BOT_OWNER_IDS = '123456,789012';

      expect(isOwner(ctx)).toBe(true);
    });

    it('should return false for non-owner', () => {
      const ctx = createMockContext({
        from: { id: 999999, is_bot: false, first_name: 'User' },
      });
      ctx.env.BOT_OWNER_IDS = '123456,789012';

      expect(isOwner(ctx)).toBe(false);
    });

    it('should return false when BOT_OWNER_IDS is not configured', () => {
      const ctx = createMockContext({
        from: { id: 123456, is_bot: false, first_name: 'User' },
      });
      ctx.env.BOT_OWNER_IDS = undefined;

      expect(isOwner(ctx)).toBe(false);
    });

    it('should return false when user ID is missing', () => {
      const ctx = createMockContext({ from: undefined });
      ctx.env.BOT_OWNER_IDS = '123456,789012';

      expect(isOwner(ctx)).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return true for owner even if not in admin table', async () => {
      const ctx = createMockContext({
        from: { id: 123456, is_bot: false, first_name: 'Owner' },
      });
      ctx.env.BOT_OWNER_IDS = '123456';

      // Mock DB to return no admin role
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      });

      expect(await isAdmin(ctx)).toBe(true);
    });

    it('should return true for admin in database', async () => {
      const ctx = createMockContext({
        from: { id: 999999, is_bot: false, first_name: 'Admin' },
      });
      ctx.env.BOT_OWNER_IDS = '123456';

      // Mock DB to return admin role
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ role: 'admin' }),
      });

      expect(await isAdmin(ctx)).toBe(true);
    });

    it('should return false for regular user', async () => {
      const ctx = createMockContext({
        from: { id: 888888, is_bot: false, first_name: 'User' },
      });
      ctx.env.BOT_OWNER_IDS = '123456';

      // Mock DB to return no admin role
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      });

      expect(await isAdmin(ctx)).toBe(false);
    });

    it('should return false when user ID is missing', async () => {
      const ctx = createMockContext({ from: undefined });

      expect(await isAdmin(ctx)).toBe(false);
    });
  });

  describe('hasAccess', () => {
    it('should return true for owner', async () => {
      const ctx = createMockContext({
        from: { id: 123456, is_bot: false, first_name: 'Owner' },
      });
      ctx.env.BOT_OWNER_IDS = '123456';

      expect(await hasAccess(ctx)).toBe(true);
    });

    it('should return true for admin', async () => {
      const ctx = createMockContext({
        from: { id: 999999, is_bot: false, first_name: 'Admin' },
      });
      ctx.env.BOT_OWNER_IDS = '123456';

      // Mock DB to return admin role
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ role: 'admin' }),
      });

      expect(await hasAccess(ctx)).toBe(true);
    });

    it('should return true for user with access', async () => {
      const ctx = createMockContext({
        from: { id: 888888, is_bot: false, first_name: 'User' },
      });
      ctx.env.BOT_OWNER_IDS = '123456';

      // Mock DB to return user with access
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ has_access: true }),
      });

      expect(await hasAccess(ctx)).toBe(true);
    });

    it('should return false for user without access', async () => {
      const ctx = createMockContext({
        from: { id: 777777, is_bot: false, first_name: 'User' },
      });
      ctx.env.BOT_OWNER_IDS = '123456';

      // Mock DB to return user without access
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ has_access: false }),
      });

      expect(await hasAccess(ctx)).toBe(false);
    });

    it('should return false when user not in database', async () => {
      const ctx = createMockContext({
        from: { id: 666666, is_bot: false, first_name: 'New User' },
      });
      ctx.env.BOT_OWNER_IDS = '123456';

      // Mock DB to return no user
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      });

      expect(await hasAccess(ctx)).toBe(false);
    });
  });

  describe('requireOwner', () => {
    it('should call next for owner', async () => {
      const ctx = createMockContext({
        from: { id: 123456, is_bot: false, first_name: 'Owner' },
      });
      ctx.env.BOT_OWNER_IDS = '123456';

      const next = vi.fn();
      await requireOwner(ctx, next);

      expect(next).toHaveBeenCalled();
      expect(ctx.reply).not.toHaveBeenCalled();
    });

    it('should not show error for non-owner even with debug enabled (level 1 is owner-only)', async () => {
      const ctx = createMockContext({
        from: { id: 999999, is_bot: false, first_name: 'User' },
      });
      ctx.env.BOT_OWNER_IDS = '123456';

      // Mock debug level to be enabled for owners only (level 1)
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ value: '1' }), // Debug level 1
      });

      const next = vi.fn();
      await requireOwner(ctx, next);

      expect(next).not.toHaveBeenCalled();
      // Non-owners don't see debug messages at level 1
      expect(ctx.reply).not.toHaveBeenCalled();
    });

    it('should not reply with error for non-owner when debug is disabled', async () => {
      const ctx = createMockContext({
        from: { id: 999999, is_bot: false, first_name: 'User' },
      });
      ctx.env.BOT_OWNER_IDS = '123456';

      // Mock debug level to be disabled
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null), // No debug level set
      });

      const next = vi.fn();
      await requireOwner(ctx, next);

      expect(next).not.toHaveBeenCalled();
      expect(ctx.reply).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should call next for admin', async () => {
      const ctx = createMockContext({
        from: { id: 999999, is_bot: false, first_name: 'Admin' },
      });
      ctx.env.BOT_OWNER_IDS = '123456';

      // Mock DB to return admin role
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ role: 'admin' }),
      });

      const next = vi.fn();
      await requireAdmin(ctx, next);

      expect(next).toHaveBeenCalled();
      expect(ctx.reply).not.toHaveBeenCalled();
    });

    it('should not show error for non-admin with debug level 2 (admin-only)', async () => {
      const ctx = createMockContext({
        from: { id: 888888, is_bot: false, first_name: 'User' },
      });
      ctx.env.BOT_OWNER_IDS = '123456';

      // Mock DB calls
      let callCount = 0;
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(() => {
          callCount++;
          // First call checks admin role, second call checks debug level
          return callCount === 1 ? null : { value: '2' };
        }),
      });

      const next = vi.fn();
      await requireAdmin(ctx, next);

      expect(next).not.toHaveBeenCalled();
      // Non-admins don't see debug messages at level 2
      expect(ctx.reply).not.toHaveBeenCalled();
    });
  });

  describe('requireAccess', () => {
    it('should call next for user with access', async () => {
      const ctx = createMockContext({
        from: { id: 888888, is_bot: false, first_name: 'User' },
      });
      ctx.env.BOT_OWNER_IDS = '123456';

      // Mock DB to return user with access
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ has_access: true }),
      });

      const next = vi.fn();
      await requireAccess(ctx, next);

      expect(next).toHaveBeenCalled();
      expect(ctx.reply).not.toHaveBeenCalled();
    });

    it('should reply with error for user without access when debug is enabled', async () => {
      const ctx = createMockContext({
        from: { id: 777777, is_bot: false, first_name: 'User' },
      });
      ctx.env.BOT_OWNER_IDS = '123456';

      // Mock DB calls
      let callCount = 0;
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(() => {
          callCount++;
          // First call checks admin role, second call checks user access, third call checks debug level
          if (callCount === 1) return null; // Not admin
          if (callCount === 2) return { has_access: false }; // No access
          return { value: '3' }; // Debug level 3
        }),
      });

      const next = vi.fn();
      await requireAccess(ctx, next);

      expect(next).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(
        '⚠️ You do not have access to this bot. use_start_to_request',
      );
    });
  });

  describe('getDebugLevel', () => {
    it('should return debug level from database', async () => {
      const ctx = createMockContext();

      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ value: '2' }),
      });

      const level = await getDebugLevel(ctx);
      expect(level).toBe(2);
    });

    it('should return 0 when no debug level is set', async () => {
      const ctx = createMockContext();

      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      });

      const level = await getDebugLevel(ctx);
      expect(level).toBe(0);
    });
  });

  describe('isDebugEnabled', () => {
    it('should return true for owner when debug level is 1', async () => {
      const ctx = createMockContext({
        from: { id: 123456, is_bot: false, first_name: 'Owner' },
      });
      ctx.env.BOT_OWNER_IDS = '123456';

      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ value: '1' }),
      });

      expect(await isDebugEnabled(ctx, 1)).toBe(true);
    });

    it('should return false for non-owner when debug level is 1', async () => {
      const ctx = createMockContext({
        from: { id: 999999, is_bot: false, first_name: 'User' },
      });
      ctx.env.BOT_OWNER_IDS = '123456';

      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ value: '1' }),
      });

      expect(await isDebugEnabled(ctx, 1)).toBe(false);
    });

    it('should return true for admin when debug level is 2', async () => {
      const ctx = createMockContext({
        from: { id: 999999, is_bot: false, first_name: 'Admin' },
      });
      ctx.env.BOT_OWNER_IDS = '123456';

      // Mock calls for getDebugLevel and isAdmin
      let callCount = 0;
      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(() => {
          callCount++;
          // First call is for debug level, second is for admin check
          return callCount === 1 ? { value: '2' } : { role: 'admin' };
        }),
      });

      expect(await isDebugEnabled(ctx, 2)).toBe(true);
    });

    it('should return true for all users when debug level is 3', async () => {
      const ctx = createMockContext({
        from: { id: 777777, is_bot: false, first_name: 'User' },
      });

      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ value: '3' }),
      });

      expect(await isDebugEnabled(ctx, 3)).toBe(true);
    });

    it('should return false when debug is disabled', async () => {
      const ctx = createMockContext({
        from: { id: 123456, is_bot: false, first_name: 'Owner' },
      });
      ctx.env.BOT_OWNER_IDS = '123456';

      ctx.env.DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ value: '0' }),
      });

      expect(await isDebugEnabled(ctx, 1)).toBe(false);
    });
  });
});
