/**
 * Admin Authentication Service
 * Platform-agnostic authentication for admin panels
 */

import { AdminPanelEvent } from '../interfaces/admin-panel.js';
import type {
  AdminUser,
  AdminSession,
  AdminAuthState,
  AdminPanelConfig,
} from '../interfaces/admin-panel.js';
import type { IKeyValueStore } from '../interfaces/storage.js';
import type { IEventBus } from '../interfaces/event-bus.js';
import type { ILogger } from '../interfaces/logger.js';

interface AdminAuthServiceDeps {
  storage: IKeyValueStore;
  eventBus: IEventBus;
  logger: ILogger;
  config: AdminPanelConfig;
}

export class AdminAuthService {
  private storage: IKeyValueStore;
  private eventBus: IEventBus;
  private logger: ILogger;
  private config: AdminPanelConfig;

  constructor(deps: AdminAuthServiceDeps) {
    this.storage = deps.storage;
    this.eventBus = deps.eventBus;
    this.logger = deps.logger;
    this.config = deps.config;
  }

  /**
   * Generate authentication token for admin
   */
  async generateAuthToken(adminId: string): Promise<AdminAuthState> {
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + this.config.tokenTTL * 1000);

    const authState: AdminAuthState = {
      token,
      adminId,
      expiresAt,
      attempts: 0,
    };

    // Store auth state
    const key = `admin:auth:${adminId}`;
    await this.storage.put(key, JSON.stringify(authState), {
      expirationTtl: this.config.tokenTTL,
    });

    // Emit event
    this.eventBus.emit(AdminPanelEvent.AUTH_TOKEN_GENERATED, {
      adminId,
      expiresAt,
      timestamp: new Date(),
    });

    this.logger.info('Auth token generated', {
      adminId,
      expiresAt,
    });

    return authState;
  }

  /**
   * Validate authentication token
   */
  async validateAuthToken(adminId: string, token: string): Promise<boolean> {
    const key = `admin:auth:${adminId}`;
    const stored = await this.storage.get(key);

    if (!stored) {
      this.logger.warn('Auth token not found', { adminId });
      return false;
    }

    let authState: AdminAuthState;
    try {
      authState = JSON.parse(stored);
    } catch (error) {
      this.logger.error('Failed to parse auth state', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }

    // Check if expired
    if (new Date() > new Date(authState.expiresAt)) {
      this.logger.warn('Auth token expired', { adminId });
      await this.storage.delete(key);

      this.eventBus.emit(AdminPanelEvent.AUTH_TOKEN_EXPIRED, {
        adminId,
        timestamp: new Date(),
      });

      return false;
    }

    // Check attempts
    if ((authState.attempts || 0) >= this.config.maxLoginAttempts) {
      this.logger.warn('Max login attempts exceeded', { adminId });
      await this.storage.delete(key);

      this.eventBus.emit(AdminPanelEvent.AUTH_LOGIN_FAILED, {
        adminId,
        reason: 'max_attempts_exceeded',
        timestamp: new Date(),
      });

      return false;
    }

    // Validate token
    if (authState.token !== token) {
      // Increment attempts
      authState.attempts = (authState.attempts || 0) + 1;
      await this.storage.put(key, JSON.stringify(authState), {
        expirationTtl: Math.floor((new Date(authState.expiresAt).getTime() - Date.now()) / 1000),
      });

      this.logger.warn('Invalid auth token', {
        adminId,
        attempts: authState.attempts,
      });

      this.eventBus.emit(AdminPanelEvent.AUTH_LOGIN_ATTEMPT, {
        adminId,
        success: false,
        attempts: authState.attempts,
        timestamp: new Date(),
      });

      return false;
    }

    // Valid token - delete it (one-time use)
    await this.storage.delete(key);

    this.eventBus.emit(AdminPanelEvent.AUTH_TOKEN_VALIDATED, {
      adminId,
      timestamp: new Date(),
    });

    return true;
  }

  /**
   * Create admin session
   */
  async createSession(adminUser: AdminUser): Promise<AdminSession> {
    const sessionId = this.generateSessionId();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + this.config.sessionTTL * 1000);

    const session: AdminSession = {
      id: sessionId,
      adminUser,
      createdAt,
      expiresAt,
      lastActivityAt: createdAt,
    };

    // Store session
    const key = `admin:session:${sessionId}`;
    await this.storage.put(key, JSON.stringify(session), {
      expirationTtl: this.config.sessionTTL,
    });

    // Emit event
    this.eventBus.emit(AdminPanelEvent.SESSION_CREATED, {
      sessionId,
      adminId: adminUser.id,
      platform: adminUser.platform,
      expiresAt,
      timestamp: createdAt,
    });

    this.logger.info('Admin session created', {
      sessionId,
      adminId: adminUser.id,
      platform: adminUser.platform,
      expiresAt,
    });

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<AdminSession | null> {
    const key = `admin:session:${sessionId}`;
    const stored = await this.storage.get(key);

    if (!stored) {
      return null;
    }

    try {
      const session: AdminSession = JSON.parse(stored);

      // Check if expired
      if (new Date() > new Date(session.expiresAt)) {
        await this.invalidateSession(sessionId);

        this.eventBus.emit(AdminPanelEvent.SESSION_EXPIRED, {
          sessionId,
          adminId: session.adminUser.id,
          timestamp: new Date(),
        });

        return null;
      }

      // Update last activity
      session.lastActivityAt = new Date();
      await this.storage.put(key, JSON.stringify(session), {
        expirationTtl: Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000),
      });

      return session;
    } catch (error) {
      this.logger.error('Failed to parse session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Invalidate session
   */
  async invalidateSession(sessionId: string): Promise<void> {
    const key = `admin:session:${sessionId}`;
    const session = await this.getSession(sessionId);

    await this.storage.delete(key);

    if (session) {
      this.eventBus.emit(AdminPanelEvent.SESSION_INVALIDATED, {
        sessionId,
        adminId: session.adminUser.id,
        timestamp: new Date(),
      });
    }

    this.logger.info('Admin session invalidated', { sessionId });
  }

  /**
   * Parse session ID from cookie header
   */
  parseSessionCookie(cookieHeader: string): string | null {
    const cookies = cookieHeader.split(';').map((c) => c.trim());

    for (const cookie of cookies) {
      const [name, value] = cookie.split('=');
      if (name === 'admin_session') {
        return value || null;
      }
    }

    return null;
  }

  /**
   * Create session cookie header
   */
  createSessionCookie(sessionId: string): string {
    const maxAge = this.config.sessionTTL;
    return `admin_session=${sessionId}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
  }

  /**
   * Create logout cookie header (clears session)
   */
  createLogoutCookie(): string {
    return 'admin_session=; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
  }

  /**
   * Generate secure random token
   */
  private generateSecureToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const length = 6;
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);

    let token = '';
    for (let i = 0; i < length; i++) {
      const value = array[i];
      if (value !== undefined) {
        token += chars[value % chars.length];
      }
    }

    return token;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${random}`;
  }

  /**
   * Check if request origin is allowed
   */
  isOriginAllowed(origin: string): boolean {
    if (!this.config.allowedOrigins || this.config.allowedOrigins.length === 0) {
      // If no origins specified, allow same origin
      return origin === this.config.baseUrl;
    }

    return this.config.allowedOrigins.includes(origin);
  }

  /**
   * Validate admin permissions
   */
  hasPermission(adminUser: AdminUser, permission: string): boolean {
    if (!adminUser.permissions) {
      return false;
    }

    // Check for wildcard permission
    if (adminUser.permissions.includes('*')) {
      return true;
    }

    // Check specific permission
    return adminUser.permissions.includes(permission);
  }
}
