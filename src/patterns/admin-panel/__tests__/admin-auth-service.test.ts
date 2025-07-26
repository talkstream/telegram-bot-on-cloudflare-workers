/**
 * Tests for AdminAuthService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AdminAuthService } from '../../../core/services/admin-auth-service.js';
import type {
  AdminUser,
  AdminPanelConfig,
  AdminPanelEvent,
} from '../../../core/interfaces/admin-panel.js';
import type { IKeyValueStore } from '../../../core/interfaces/storage.js';
import type { IEventBus } from '../../../core/interfaces/event-bus.js';
import type { ILogger } from '../../../core/interfaces/logger.js';

// Mock storage
const mockStorage: IKeyValueStore = {
  get: vi.fn(),
  getWithMetadata: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
};

// Mock event bus
const mockEventBus: IEventBus = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
};

// Mock logger
const mockLogger: ILogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(() => mockLogger),
};

describe('AdminAuthService', () => {
  let authService: AdminAuthService;
  const config: AdminPanelConfig = {
    baseUrl: 'https://example.com',
    sessionTTL: 86400, // 24 hours
    tokenTTL: 300, // 5 minutes
    maxLoginAttempts: 3,
    allowedOrigins: ['https://example.com'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AdminAuthService({
      storage: mockStorage,
      eventBus: mockEventBus,
      logger: mockLogger,
      config,
    });
  });

  describe('generateAuthToken', () => {
    it('should generate auth token and store it', async () => {
      const adminId = '123456';

      const result = await authService.generateAuthToken(adminId);

      expect(result).toMatchObject({
        token: expect.stringMatching(/^[A-Z0-9]{6}$/),
        adminId,
        expiresAt: expect.any(Date),
        attempts: 0,
      });

      expect(mockStorage.put).toHaveBeenCalledWith(
        `admin:auth:${adminId}`,
        expect.stringContaining('"token"'),
        { expirationTtl: config.tokenTTL },
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        AdminPanelEvent.AUTH_TOKEN_GENERATED,
        expect.objectContaining({
          adminId,
          expiresAt: expect.any(Date),
        }),
      );
    });
  });

  describe('validateAuthToken', () => {
    it('should validate correct token', async () => {
      const adminId = '123456';
      const token = 'ABC123';
      const authState = {
        token,
        adminId,
        expiresAt: new Date(Date.now() + 60000), // 1 minute from now
        attempts: 0,
      };

      (mockStorage.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(authState));

      const result = await authService.validateAuthToken(adminId, token);

      expect(result).toBe(true);
      expect(mockStorage.delete).toHaveBeenCalledWith(`admin:auth:${adminId}`);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        AdminPanelEvent.AUTH_TOKEN_VALIDATED,
        expect.objectContaining({ adminId }),
      );
    });

    it('should reject invalid token', async () => {
      const adminId = '123456';
      const authState = {
        token: 'ABC123',
        adminId,
        expiresAt: new Date(Date.now() + 60000),
        attempts: 0,
      };

      (mockStorage.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(authState));

      const result = await authService.validateAuthToken(adminId, 'WRONG');

      expect(result).toBe(false);
      expect(mockStorage.put).toHaveBeenCalled(); // Should increment attempts
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        AdminPanelEvent.AUTH_LOGIN_ATTEMPT,
        expect.objectContaining({
          adminId,
          success: false,
          attempts: 1,
        }),
      );
    });

    it('should reject expired token', async () => {
      const adminId = '123456';
      const authState = {
        token: 'ABC123',
        adminId,
        expiresAt: new Date(Date.now() - 60000), // 1 minute ago
        attempts: 0,
      };

      (mockStorage.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(authState));

      const result = await authService.validateAuthToken(adminId, 'ABC123');

      expect(result).toBe(false);
      expect(mockStorage.delete).toHaveBeenCalledWith(`admin:auth:${adminId}`);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        AdminPanelEvent.AUTH_TOKEN_EXPIRED,
        expect.objectContaining({ adminId }),
      );
    });

    it('should reject after max attempts', async () => {
      const adminId = '123456';
      const authState = {
        token: 'ABC123',
        adminId,
        expiresAt: new Date(Date.now() + 60000),
        attempts: 3, // Already at max
      };

      (mockStorage.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(authState));

      const result = await authService.validateAuthToken(adminId, 'WRONG');

      expect(result).toBe(false);
      expect(mockStorage.delete).toHaveBeenCalledWith(`admin:auth:${adminId}`);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        AdminPanelEvent.AUTH_LOGIN_FAILED,
        expect.objectContaining({
          adminId,
          reason: 'max_attempts_exceeded',
        }),
      );
    });
  });

  describe('createSession', () => {
    it('should create and store session', async () => {
      const adminUser: AdminUser = {
        id: '123456',
        platformId: '123456',
        platform: 'telegram',
        name: 'Test Admin',
        permissions: ['*'],
      };

      const result = await authService.createSession(adminUser);

      expect(result).toMatchObject({
        id: expect.stringMatching(/^[a-z0-9]+-[a-z0-9]+$/),
        adminUser,
        createdAt: expect.any(Date),
        expiresAt: expect.any(Date),
        lastActivityAt: expect.any(Date),
      });

      expect(mockStorage.put).toHaveBeenCalledWith(
        expect.stringContaining('admin:session:'),
        expect.stringContaining('"adminUser"'),
        { expirationTtl: config.sessionTTL },
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        AdminPanelEvent.SESSION_CREATED,
        expect.objectContaining({
          sessionId: result.id,
          adminId: adminUser.id,
          platform: adminUser.platform,
        }),
      );
    });
  });

  describe('getSession', () => {
    it('should retrieve valid session', async () => {
      const sessionId = 'test-session';
      const session = {
        id: sessionId,
        adminUser: {
          id: '123456',
          platformId: '123456',
          platform: 'telegram',
          name: 'Test Admin',
          permissions: ['*'],
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
        lastActivityAt: new Date(),
      };

      (mockStorage.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(session));

      const result = await authService.getSession(sessionId);

      expect(result).toBeTruthy();
      expect(result?.id).toBe(sessionId);
      expect(mockStorage.put).toHaveBeenCalled(); // Should update last activity
    });

    it('should return null for expired session', async () => {
      const sessionId = 'test-session';
      const session = {
        id: sessionId,
        adminUser: {
          id: '123456',
          platformId: '123456',
          platform: 'telegram',
          name: 'Test Admin',
          permissions: ['*'],
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 60000), // Expired
        lastActivityAt: new Date(),
      };

      (mockStorage.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(session));

      const result = await authService.getSession(sessionId);

      expect(result).toBeNull();
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        AdminPanelEvent.SESSION_EXPIRED,
        expect.objectContaining({
          sessionId,
          adminId: session.adminUser.id,
        }),
      );
    });
  });

  describe('cookie management', () => {
    it('should parse session cookie', () => {
      const cookieHeader = 'admin_session=test123; other=value';
      const sessionId = authService.parseSessionCookie(cookieHeader);

      expect(sessionId).toBe('test123');
    });

    it('should create session cookie', () => {
      const sessionId = 'test123';
      const cookie = authService.createSessionCookie(sessionId);

      expect(cookie).toBe(
        `admin_session=${sessionId}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${config.sessionTTL}`,
      );
    });

    it('should create logout cookie', () => {
      const cookie = authService.createLogoutCookie();

      expect(cookie).toBe(
        'admin_session=; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
      );
    });
  });

  describe('origin validation', () => {
    it('should allow configured origins', () => {
      expect(authService.isOriginAllowed('https://example.com')).toBe(true);
    });

    it('should reject unknown origins', () => {
      expect(authService.isOriginAllowed('https://evil.com')).toBe(false);
    });

    it('should allow same origin when no origins configured', () => {
      const service = new AdminAuthService({
        storage: mockStorage,
        eventBus: mockEventBus,
        logger: mockLogger,
        config: { ...config, allowedOrigins: undefined },
      });

      expect(service.isOriginAllowed(config.baseUrl)).toBe(true);
      expect(service.isOriginAllowed('https://other.com')).toBe(false);
    });
  });

  describe('permissions', () => {
    it('should check wildcard permission', () => {
      const adminUser: AdminUser = {
        id: '123',
        platformId: '123',
        platform: 'telegram',
        name: 'Admin',
        permissions: ['*'],
      };

      expect(authService.hasPermission(adminUser, 'any.permission')).toBe(true);
    });

    it('should check specific permission', () => {
      const adminUser: AdminUser = {
        id: '123',
        platformId: '123',
        platform: 'telegram',
        name: 'Admin',
        permissions: ['users.read', 'users.write'],
      };

      expect(authService.hasPermission(adminUser, 'users.read')).toBe(true);
      expect(authService.hasPermission(adminUser, 'users.delete')).toBe(false);
    });
  });
});
