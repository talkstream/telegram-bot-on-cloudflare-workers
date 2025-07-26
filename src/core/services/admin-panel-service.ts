/**
 * Admin Panel Service
 * Core service for managing admin panel functionality
 */

import type {
  IAdminPanelService,
  IAdminRouteHandler,
  AdminPanelConfig,
  AdminPanelStats,
  AdminUser,
  AdminSession,
  AdminAuthState,
  AdminRouteContext,
} from '../interfaces/admin-panel.js';
import type { IKeyValueStore, IDatabaseStore } from '../interfaces/storage.js';
import type { IEventBus } from '../interfaces/event-bus.js';
import type { ILogger } from '../interfaces/logger.js';

import { AdminAuthService } from './admin-auth-service.js';

interface AdminPanelServiceDeps {
  storage: IKeyValueStore;
  database?: IDatabaseStore;
  eventBus: IEventBus;
  logger: ILogger;
}

export class AdminPanelService implements IAdminPanelService {
  private storage: IKeyValueStore;
  private database?: IDatabaseStore;
  private eventBus: IEventBus;
  private logger: ILogger;
  private config!: AdminPanelConfig;
  private authService!: AdminAuthService;
  private routeHandlers = new Map<string, IAdminRouteHandler>();
  private isInitialized = false;

  constructor(deps: AdminPanelServiceDeps) {
    this.storage = deps.storage;
    this.database = deps.database;
    this.eventBus = deps.eventBus;
    this.logger = deps.logger;
  }

  async initialize(config: AdminPanelConfig): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Admin Panel Service already initialized');
      return;
    }

    this.config = config;

    // Initialize auth service
    this.authService = new AdminAuthService({
      storage: this.storage,
      eventBus: this.eventBus,
      logger: this.logger.child({ service: 'admin-auth' }),
      config,
    });

    // Register default route handlers
    this.registerDefaultRoutes();

    this.isInitialized = true;
    this.logger.info('Admin Panel Service initialized', {
      baseUrl: config.baseUrl,
      features: config.features,
    });
  }

  async generateAuthToken(adminId: string): Promise<AdminAuthState> {
    this.ensureInitialized();
    return this.authService.generateAuthToken(adminId);
  }

  async validateAuthToken(adminId: string, token: string): Promise<boolean> {
    this.ensureInitialized();
    return this.authService.validateAuthToken(adminId, token);
  }

  async createSession(adminUser: AdminUser): Promise<AdminSession> {
    this.ensureInitialized();
    return this.authService.createSession(adminUser);
  }

  async getSession(sessionId: string): Promise<AdminSession | null> {
    this.ensureInitialized();
    return this.authService.getSession(sessionId);
  }

  async invalidateSession(sessionId: string): Promise<void> {
    this.ensureInitialized();
    return this.authService.invalidateSession(sessionId);
  }

  async getStats(): Promise<AdminPanelStats> {
    this.ensureInitialized();

    const stats: AdminPanelStats = {
      systemStatus: 'healthy',
      customStats: {},
    };

    // Get stats from database if available
    if (this.database) {
      try {
        // Total users
        const usersResult = await this.database
          .prepare('SELECT COUNT(*) as count FROM users')
          .first<{ count: number }>();

        if (usersResult) {
          stats.totalUsers = usersResult.count;
        }

        // Active users (last 24 hours)
        const activeResult = await this.database
          .prepare(
            `
            SELECT COUNT(DISTINCT user_id) as count 
            FROM user_activity 
            WHERE timestamp > datetime('now', '-1 day')
          `,
          )
          .first<{ count: number }>();

        if (activeResult) {
          stats.activeUsers = activeResult.count;
        }

        // Total messages
        const messagesResult = await this.database
          .prepare('SELECT COUNT(*) as count FROM messages')
          .first<{ count: number }>();

        if (messagesResult) {
          stats.totalMessages = messagesResult.count;
        }
      } catch (error) {
        this.logger.error('Failed to get database stats', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        stats.systemStatus = 'degraded';
      }
    }

    return stats;
  }

  registerRouteHandler(path: string, handler: IAdminRouteHandler): void {
    this.ensureInitialized();
    this.routeHandlers.set(path, handler);
    this.logger.debug('Route handler registered', { path });
  }

  async handleRequest(request: Request): Promise<Response> {
    this.ensureInitialized();

    const url = new URL(request.url);
    const path = url.pathname;

    // Check CORS
    if (request.method === 'OPTIONS') {
      return this.handleCorsPreFlight(request);
    }

    // Find matching route handler
    for (const [, handler] of this.routeHandlers) {
      if (handler.canHandle(path, request.method)) {
        // Check authentication if needed
        const context = await this.createRouteContext(request);

        // Handle the request
        const response = await handler.handle(request, context);

        // Add CORS headers
        return this.addCorsHeaders(request, response);
      }
    }

    // No matching route
    return new Response('Not Found', { status: 404 });
  }

  private async createRouteContext(request: Request): Promise<AdminRouteContext> {
    const context: AdminRouteContext = {
      config: this.config,
      storage: this.storage,
    };

    // Try to get session from cookie
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
      const sessionId = this.authService.parseSessionCookie(cookieHeader);
      if (sessionId) {
        const session = await this.authService.getSession(sessionId);
        if (session) {
          context.session = session;
          context.adminUser = session.adminUser;
        }
      }
    }

    // Extract URL parameters
    const url = new URL(request.url);
    const params: Record<string, string> = {};

    for (const [key, value] of url.searchParams) {
      params[key] = value;
    }

    context.params = params;

    return context;
  }

  private registerDefaultRoutes(): void {
    // These would be imported from the handlers directory
    // For now, we'll create inline handlers

    // Login route
    this.registerRouteHandler('/admin', {
      canHandle: (path, method) => {
        return (path === '/admin' || path === '/admin/') && (method === 'GET' || method === 'POST');
      },
      handle: async () => {
        // This would be handled by a proper login handler
        return new Response('Login page would be here', {
          headers: { 'Content-Type': 'text/html' },
        });
      },
    });

    // Dashboard route
    this.registerRouteHandler('/admin/dashboard', {
      canHandle: (path, method) => {
        return path === '/admin/dashboard' && method === 'GET';
      },
      handle: async (_, context) => {
        if (!context.adminUser) {
          return new Response('Unauthorized', { status: 401 });
        }

        // This would be handled by a proper dashboard handler
        return new Response('Dashboard would be here', {
          headers: { 'Content-Type': 'text/html' },
        });
      },
    });
  }

  private handleCorsPreFlight(request: Request): Response {
    const origin = request.headers.get('Origin');

    if (!origin || !this.authService.isOriginAllowed(origin)) {
      return new Response(null, { status: 403 });
    }

    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  private addCorsHeaders(request: Request, response: Response): Response {
    const origin = request.headers.get('Origin');

    if (origin && this.authService.isOriginAllowed(origin)) {
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Credentials', 'true');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return response;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Admin Panel Service not initialized');
    }
  }
}
