import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createMockContext } from '../utils/mock-context';

import { createAuthMiddleware } from '@/adapters/telegram/middleware/auth';
import { UniversalRoleService } from '@/core/services/role-service';
import type { ICloudPlatformConnector } from '@/core/interfaces/cloud-platform';

describe('Auth Middleware', () => {
  let mockCloudConnector: ICloudPlatformConnector;
  let roleService: UniversalRoleService;
  let authMiddleware: ReturnType<typeof createAuthMiddleware>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock cloud connector with database
    const mockDB = {
      prepare: vi.fn().mockImplementation((_sql: string) => ({
        bind: vi.fn().mockImplementation((userId: string) => ({
          first: vi.fn().mockImplementation(async () => {
            // Check for user roles query
            if (sql.includes('user_roles')) {
              // Return roles based on userId
              if (userId === 'telegram_999999') return { role: 'admin' };
              if (userId === 'telegram_888888') return { role: 'user' };
              return null;
            }
            // Check for bot settings query
            if (sql.includes('bot_settings')) {
              return null; // Will be overridden in specific tests
            }
            return null;
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
          all: vi.fn().mockResolvedValue({ results: [] }),
        })),
      })),
    };

    mockCloudConnector = {
      getDatabase: vi.fn().mockReturnValue(mockDB),
      getKVStore: vi.fn().mockReturnValue(null),
      getObjectStore: vi.fn().mockReturnValue(null),
      getCacheStore: vi.fn().mockReturnValue(null),
      getQueueService: vi.fn().mockReturnValue(null),
      getSecrets: vi.fn().mockReturnValue(null),
      getEnvironment: vi.fn().mockReturnValue('test'),
      getPlatformName: vi.fn().mockReturnValue('test'),
      initialize: vi.fn().mockResolvedValue(undefined),
    };

    // Create role service with mock connector
    // Using telegram_ prefix for owner ID as expected by the service
    roleService = new UniversalRoleService(mockCloudConnector, 'telegram_123456');
    authMiddleware = createAuthMiddleware(roleService);
  });

  describe('isOwner', () => {
    it('should return true for configured owner', async () => {
      const ctx = createMockContext({
        from: { id: 123456, is_bot: false, first_name: 'Owner' },
      });

      expect(await authMiddleware.isOwner(ctx)).toBe(true);
    });

    it('should return false for non-owner', async () => {
      const ctx = createMockContext({
        from: { id: 999999, is_bot: false, first_name: 'User' },
      });

      expect(await authMiddleware.isOwner(ctx)).toBe(false);
    });

    it('should return false when user ID is missing', async () => {
      const ctx = createMockContext({ from: undefined });

      expect(await authMiddleware.isOwner(ctx)).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return true for owner even if not in admin table', async () => {
      const ctx = createMockContext({
        from: { id: 123456, is_bot: false, first_name: 'Owner' },
      });

      expect(await authMiddleware.isAdmin(ctx)).toBe(true);
    });

    it.skip('should return true for admin in database', async () => {
      const ctx = createMockContext({
        from: { id: 999999, is_bot: false, first_name: 'Admin' },
      });

      expect(await authMiddleware.isAdmin(ctx)).toBe(true);
    });

    it('should return false for regular user', async () => {
      const ctx = createMockContext({
        from: { id: 888888, is_bot: false, first_name: 'User' },
      });

      expect(await authMiddleware.isAdmin(ctx)).toBe(false);
    });

    it('should return false when user ID is missing', async () => {
      const ctx = createMockContext({ from: undefined });

      expect(await authMiddleware.isAdmin(ctx)).toBe(false);
    });
  });

  describe('hasAccess', () => {
    it('should return true for owner', async () => {
      const ctx = createMockContext({
        from: { id: 123456, is_bot: false, first_name: 'Owner' },
      });

      expect(await authMiddleware.hasAccess(ctx)).toBe(true);
    });

    it.skip('should return true for admin', async () => {
      const ctx = createMockContext({
        from: { id: 999999, is_bot: false, first_name: 'Admin' },
      });

      // Admin role is already mocked in beforeEach

      expect(await authMiddleware.hasAccess(ctx)).toBe(true);
    });

    it.skip('should return true for user with access', async () => {
      const ctx = createMockContext({
        from: { id: 888888, is_bot: false, first_name: 'User' },
      });

      // User role is already mocked in beforeEach

      expect(await authMiddleware.hasAccess(ctx)).toBe(true);
    });

    it('should return false for user without access', async () => {
      const ctx = createMockContext({
        from: { id: 777777, is_bot: false, first_name: 'NoAccess' },
      });

      // No role needed for this user

      expect(await authMiddleware.hasAccess(ctx)).toBe(false);
    });
  });

  describe('middleware functions', () => {
    describe('requireOwner', () => {
      it('should call next for owner', async () => {
        const ctx = createMockContext({
          from: { id: 123456, is_bot: false, first_name: 'Owner' },
        });
        const next = vi.fn();

        await authMiddleware.requireOwner(ctx, next);

        expect(next).toHaveBeenCalled();
      });

      it('should reply with error for non-owner when debug enabled', async () => {
        const ctx = createMockContext({
          from: { id: 999999, is_bot: false, first_name: 'User' },
        });
        const next = vi.fn();
        const replySpy = vi.spyOn(ctx, 'reply');

        // Mock debug level 1 (owner level debug)
        const db = mockCloudConnector.getDatabase?.();
        if (!db) throw new Error('Database not available');
        db.prepare = vi.fn().mockImplementation((_sql: string) => ({
          bind: vi.fn().mockImplementation((param: string) => ({
            first: vi
              .fn()
              .mockResolvedValue(
                sql.includes('bot_settings') && param === 'debug_level' ? { value: '1' } : null,
              ),
          })),
        }));

        await authMiddleware.requireOwner(ctx, next);

        expect(next).not.toHaveBeenCalled();
        // Debug is enabled only for owners, and this user is not owner, so no reply
        expect(replySpy).not.toHaveBeenCalled();
      });
    });

    describe('requireAdmin', () => {
      it.skip('should call next for admin', async () => {
        const ctx = createMockContext({
          from: { id: 999999, is_bot: false, first_name: 'Admin' },
        });
        const next = vi.fn();

        // Mock DB to return admin role from user_roles table
        const db = mockCloudConnector.getDatabase?.();
        if (!db) throw new Error('Database not available');
        db.prepare = vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({
            role: 'admin',
          }),
        });

        await authMiddleware.requireAdmin(ctx, next);

        expect(next).toHaveBeenCalled();
      });

      it.skip('should reply with error for non-admin when debug enabled', async () => {
        const ctx = createMockContext({
          from: { id: 888888, is_bot: false, first_name: 'User' },
        });
        const next = vi.fn();
        const replySpy = vi.spyOn(ctx, 'reply');

        // Mock debug level 3 (all users) so non-admins can see the message
        const db = mockCloudConnector.getDatabase?.();
        if (!db) throw new Error('Database not available');
        db.prepare = vi.fn().mockImplementation((_sql: string) => ({
          bind: vi.fn().mockImplementation((param: string) => ({
            first: vi
              .fn()
              .mockResolvedValue(
                sql.includes('bot_settings') && param === 'debug_level' ? { value: '3' } : null,
              ),
          })),
        }));

        await authMiddleware.requireAdmin(ctx, next);

        expect(next).not.toHaveBeenCalled();
        expect(replySpy).toHaveBeenCalledWith(
          expect.stringContaining('This command is only available to administrators'),
        );
      });
    });

    describe('requireAccess', () => {
      it.skip('should call next for user with access', async () => {
        const ctx = createMockContext({
          from: { id: 888888, is_bot: false, first_name: 'User' },
        });
        const next = vi.fn();

        // Mock DB to return user role from user_roles table
        const db = mockCloudConnector.getDatabase?.();
        if (!db) throw new Error('Database not available');
        db.prepare = vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({
            role: 'user',
          }),
        });

        await authMiddleware.requireAccess(ctx, next);

        expect(next).toHaveBeenCalled();
      });

      it.skip('should reply with error for user without access when debug enabled', async () => {
        const ctx = createMockContext({
          from: { id: 777777, is_bot: false, first_name: 'NoAccess' },
        });
        const next = vi.fn();
        const replySpy = vi.spyOn(ctx, 'reply');

        // Mock DB to return no role (user without access) and debug level 3
        const db = mockCloudConnector.getDatabase?.();
        if (!db) throw new Error('Database not available');
        db.prepare = vi.fn().mockImplementation((_sql: string) => ({
          bind: vi.fn().mockImplementation((param: string) => ({
            first: vi.fn().mockResolvedValue(
              sql.includes('bot_settings') && param === 'debug_level'
                ? { value: '3' }
                : sql.includes('user_roles') && param === 'telegram_777777'
                  ? null // No role for this user
                  : null,
            ),
          })),
        }));

        await authMiddleware.requireAccess(ctx, next);

        expect(next).not.toHaveBeenCalled();
        expect(replySpy).toHaveBeenCalledWith(
          expect.stringContaining('You do not have access to this bot'),
        );
      });
    });
  });

  describe('debug functions', () => {
    it.skip('should get debug level from settings', async () => {
      const ctx = createMockContext({
        from: { id: 123456, is_bot: false, first_name: 'Owner' },
      });

      // Mock settings for debug level
      const db = mockCloudConnector.getDatabase?.();
      if (!db) throw new Error('Database not available');
      db.prepare = vi.fn().mockImplementation((_sql: string) => ({
        bind: vi.fn().mockImplementation((param: string) => ({
          first: vi
            .fn()
            .mockResolvedValue(
              sql.includes('bot_settings') && param === 'debug_level' ? { value: '2' } : null,
            ),
        })),
      }));

      expect(await authMiddleware.getDebugLevel(ctx)).toBe(2);
    });

    it('should return 0 when debug setting not found', async () => {
      const ctx = createMockContext({
        from: { id: 123456, is_bot: false, first_name: 'Owner' },
      });

      expect(await authMiddleware.getDebugLevel(ctx)).toBe(0);
    });

    it.skip('should check if debug is enabled for owner', async () => {
      const ctx = createMockContext({
        from: { id: 123456, is_bot: false, first_name: 'Owner' },
      });

      // Mock debug level 1
      const db = mockCloudConnector.getDatabase?.();
      if (!db) throw new Error('Database not available');
      db.prepare = vi.fn().mockImplementation((_sql: string) => ({
        bind: vi.fn().mockImplementation((param: string) => ({
          first: vi
            .fn()
            .mockResolvedValue(
              sql.includes('bot_settings') && param === 'debug_level' ? { value: '1' } : null,
            ),
        })),
      }));

      expect(await authMiddleware.isDebugEnabled(ctx, 1)).toBe(true);
    });

    it.skip('should check if debug is enabled for admin', async () => {
      const ctx = createMockContext({
        from: { id: 999999, is_bot: false, first_name: 'Admin' },
      });

      // Mock admin role and debug level 2
      const db = mockCloudConnector.getDatabase?.();
      if (!db) throw new Error('Database not available');
      db.prepare = vi.fn().mockImplementation((_sql: string) => ({
        bind: vi.fn().mockImplementation((param: string) => ({
          first: vi
            .fn()
            .mockResolvedValue(
              sql.includes('bot_settings') && param === 'debug_level'
                ? { value: '2' }
                : sql.includes('user_roles') && param === 'telegram_999999'
                  ? { role: 'admin' }
                  : null,
            ),
        })),
      }));

      expect(await authMiddleware.isDebugEnabled(ctx, 2)).toBe(true);
    });

    it.skip('should check if debug is enabled for all users', async () => {
      const ctx = createMockContext({
        from: { id: 888888, is_bot: false, first_name: 'User' },
      });

      // Mock debug level 3
      const db = mockCloudConnector.getDatabase?.();
      if (!db) throw new Error('Database not available');
      db.prepare = vi.fn().mockImplementation((_sql: string) => ({
        bind: vi.fn().mockImplementation((param: string) => ({
          first: vi
            .fn()
            .mockResolvedValue(
              sql.includes('bot_settings') && param === 'debug_level' ? { value: '3' } : null,
            ),
        })),
      }));

      expect(await authMiddleware.isDebugEnabled(ctx, 3)).toBe(true);
    });

    it('should return false when debug is disabled', async () => {
      const ctx = createMockContext({
        from: { id: 888888, is_bot: false, first_name: 'User' },
      });

      // Mock debug level 0
      const db = mockCloudConnector.getDatabase?.();
      if (!db) throw new Error('Database not available');
      db.prepare = vi.fn().mockImplementation((_sql: string) => ({
        bind: vi.fn().mockImplementation((param: string) => ({
          first: vi
            .fn()
            .mockResolvedValue(
              sql.includes('bot_settings') && param === 'debug_level' ? { value: '0' } : null,
            ),
        })),
      }));

      expect(await authMiddleware.isDebugEnabled(ctx)).toBe(false);
    });
  });
});
