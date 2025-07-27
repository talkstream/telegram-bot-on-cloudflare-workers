/**
 * Admin Panel Connector
 * Integrates admin panel functionality with EventBus
 */

import { AdminPanelEvent } from '../core/interfaces/admin-panel.js';
import type {
  IAdminPanelConnector,
  IAdminPanelService,
  AdminPanelConfig,
} from '../core/interfaces/admin-panel.js';
import type { IEventBus } from '../core/interfaces/event-bus.js';
import type { ILogger } from '../core/interfaces/logger.js';
import type { ConnectorConfig } from '../core/interfaces/connector.js';
import { ConnectorType } from '../core/interfaces/connector.js';

interface AdminPanelConnectorDeps {
  adminService: IAdminPanelService;
  eventBus: IEventBus;
  logger: ILogger;
  config: AdminPanelConfig;
}

export class AdminPanelConnector implements IAdminPanelConnector {
  public readonly id = 'admin-panel';
  public readonly name = 'Admin Panel Connector';
  public readonly version = '1.0.0';
  public readonly type = ConnectorType.ADMIN;

  private adminService: IAdminPanelService;
  private eventBus: IEventBus;
  private logger: ILogger;
  private config: AdminPanelConfig;
  private isRunning = false;

  constructor(deps: AdminPanelConnectorDeps) {
    this.adminService = deps.adminService;
    this.eventBus = deps.eventBus;
    this.logger = deps.logger;
    this.config = deps.config;
  }

  async initialize(_config: ConnectorConfig): Promise<void> {
    this.logger.info('Initializing Admin Panel Connector', {
      baseUrl: this.config.baseUrl,
      features: this.config.features,
    });

    // Initialize admin service
    await this.adminService.initialize(this.config);

    // Set up event listeners
    this.setupEventListeners();

    this.logger.info('Admin Panel Connector initialized');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Admin Panel Connector already running');
      return;
    }

    this.logger.info('Starting Admin Panel Connector');

    await this.startServer();
    this.isRunning = true;

    // Emit server started event
    this.eventBus.emit(AdminPanelEvent.SERVER_STARTED, {
      url: this.getAdminUrl(),
      timestamp: new Date(),
    });

    this.logger.info('Admin Panel Connector started', {
      adminUrl: this.getAdminUrl(),
    });
  }

  isReady(): boolean {
    return this.isRunning;
  }

  validateConfig(config: ConnectorConfig): {
    valid: boolean;
    errors?: Array<{ field: string; message: string }>;
  } {
    const errors: Array<{ field: string; message: string }> = [];
    const adminConfig = config as unknown as AdminPanelConfig;

    if (!adminConfig.baseUrl) {
      errors.push({ field: 'baseUrl', message: 'Base URL is required' });
    }

    if (!adminConfig.sessionTTL || adminConfig.sessionTTL <= 0) {
      errors.push({ field: 'sessionTTL', message: 'Session TTL must be positive' });
    }

    if (!adminConfig.tokenTTL || adminConfig.tokenTTL <= 0) {
      errors.push({ field: 'tokenTTL', message: 'Token TTL must be positive' });
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  getCapabilities(): { features: string[]; [key: string]: unknown } {
    return {
      features: [
        'web-admin-panel',
        'telegram-2fa',
        'session-management',
        'statistics-dashboard',
        'audit-logging',
      ],
      maxSessionTTL: 86400 * 7, // 7 days
      maxTokenTTL: 3600, // 1 hour
    };
  }

  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    details?: Record<string, unknown>;
    timestamp: number;
  }> {
    const health = await this.getHealth();
    return {
      ...health,
      timestamp: Date.now(),
    };
  }

  async destroy(): Promise<void> {
    await this.stop();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Admin Panel Connector not running');
      return;
    }

    this.logger.info('Stopping Admin Panel Connector');

    await this.stopServer();
    this.isRunning = false;

    // Emit server stopped event
    this.eventBus.emit(AdminPanelEvent.SERVER_STOPPED, {
      timestamp: new Date(),
    });

    this.logger.info('Admin Panel Connector stopped');
  }

  async startServer(): Promise<void> {
    // In Cloudflare Workers, the server is always running
    // This method is for initialization tasks

    // Register default route handlers
    this.registerDefaultRoutes();

    this.logger.debug('Admin panel server ready');
  }

  async stopServer(): Promise<void> {
    // Cleanup tasks
    this.logger.debug('Admin panel server cleanup completed');
  }

  getAdminUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * Handle incoming HTTP request
   */
  async handleRequest(request: Request): Promise<Response> {
    try {
      const response = await this.adminService.handleRequest(request);

      // Log access
      const url = new URL(request.url);
      this.eventBus.emit(AdminPanelEvent.PANEL_ACCESSED, {
        path: url.pathname,
        method: request.method,
        timestamp: new Date(),
      });

      return response;
    } catch (error) {
      this.logger.error('Error handling admin panel request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        url: request.url,
        method: request.method,
      });

      // Emit error event
      this.eventBus.emit(AdminPanelEvent.ERROR_OCCURRED, {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });

      // Return error response
      return new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  }

  private setupEventListeners(): void {
    // Listen for authentication events
    this.eventBus.on(AdminPanelEvent.AUTH_TOKEN_GENERATED, (data: unknown) => {
      const eventData = data as { adminId: string; expiresAt: Date };
      this.logger.info('Auth token generated', {
        adminId: eventData.adminId,
        expiresAt: eventData.expiresAt,
      });
    });

    this.eventBus.on(AdminPanelEvent.AUTH_LOGIN_SUCCESS, (data: unknown) => {
      const eventData = data as { adminId: string; platform: string };
      this.logger.info('Admin login successful', {
        adminId: eventData.adminId,
        platform: eventData.platform,
      });
    });

    this.eventBus.on(AdminPanelEvent.AUTH_LOGIN_FAILED, (data: unknown) => {
      const eventData = data as { adminId: string; reason: string };
      this.logger.warn('Admin login failed', {
        adminId: eventData.adminId,
        reason: eventData.reason,
      });
    });

    // Listen for session events
    this.eventBus.on(AdminPanelEvent.SESSION_CREATED, (data: unknown) => {
      const eventData = data as { sessionId: string; adminId: string; expiresAt: Date };
      this.logger.info('Admin session created', {
        sessionId: eventData.sessionId,
        adminId: eventData.adminId,
        expiresAt: eventData.expiresAt,
      });
    });

    this.eventBus.on(AdminPanelEvent.SESSION_EXPIRED, (data: unknown) => {
      const eventData = data as { sessionId: string; adminId: string };
      this.logger.info('Admin session expired', {
        sessionId: eventData.sessionId,
        adminId: eventData.adminId,
      });
    });

    // Listen for action events
    this.eventBus.on(AdminPanelEvent.ACTION_PERFORMED, (data: unknown) => {
      const eventData = data as {
        userId: string;
        action: string;
        resource?: string;
        resourceId?: string;
      };
      this.logger.info('Admin action performed', {
        userId: eventData.userId,
        action: eventData.action,
        resource: eventData.resource,
        resourceId: eventData.resourceId,
      });
    });
  }

  private registerDefaultRoutes(): void {
    // Default routes are registered in the AdminPanelService
    // This method is for any connector-specific routes
    this.logger.debug('Default admin routes registered');
  }

  /**
   * Get connector health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details?: Record<string, unknown>;
  }> {
    try {
      const stats = await this.adminService.getStats();

      const status =
        stats.systemStatus === 'down'
          ? 'unhealthy'
          : stats.systemStatus === 'healthy' ||
              stats.systemStatus === 'degraded' ||
              stats.systemStatus === 'unhealthy'
            ? stats.systemStatus
            : 'healthy';

      return {
        status,
        details: {
          isRunning: this.isRunning,
          adminUrl: this.getAdminUrl(),
          stats,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Get connector metrics
   */
  async getMetrics(): Promise<Record<string, number>> {
    const stats = await this.adminService.getStats();

    return {
      total_users: stats.totalUsers || 0,
      active_users: stats.activeUsers || 0,
      total_messages: stats.totalMessages || 0,
      ...Object.entries(stats.customStats || {}).reduce(
        (acc, [key, value]) => {
          if (typeof value === 'number') {
            acc[`custom_${key}`] = value;
          }
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}
