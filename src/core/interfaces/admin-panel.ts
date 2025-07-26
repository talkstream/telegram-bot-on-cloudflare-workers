/**
 * Universal Admin Panel interfaces
 * Platform-agnostic admin panel system for bots
 */

import type { IConnector } from './connector.js';
import type { IKeyValueStore } from './storage.js';

/**
 * Admin panel authentication methods
 */
export enum AdminAuthMethod {
  TOKEN = 'token', // Temporary token via messaging platform
  PASSWORD = 'password', // Traditional password
  OAUTH = 'oauth', // OAuth providers
  WEBHOOK = 'webhook', // Webhook-based auth
}

/**
 * Admin user information
 */
export interface AdminUser {
  id: string;
  platformId: string; // Platform-specific ID (Telegram ID, Discord ID, etc.)
  platform: string; // telegram, discord, slack, etc.
  name: string;
  permissions: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Admin session data
 */
export interface AdminSession {
  id: string;
  adminUser: AdminUser;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Authentication state for temporary tokens
 */
export interface AdminAuthState {
  token: string;
  adminId: string;
  expiresAt: Date;
  attempts?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Admin panel configuration
 */
export interface AdminPanelConfig {
  baseUrl: string;
  sessionTTL: number; // Session TTL in seconds
  tokenTTL: number; // Auth token TTL in seconds
  maxLoginAttempts: number;
  allowedOrigins?: string[];
  features?: {
    dashboard?: boolean;
    userManagement?: boolean;
    analytics?: boolean;
    logs?: boolean;
    settings?: boolean;
  };
}

/**
 * Admin panel statistics
 */
export interface AdminPanelStats {
  totalUsers?: number;
  activeUsers?: number;
  totalMessages?: number;
  systemStatus?: 'healthy' | 'degraded' | 'down' | 'unhealthy';
  customStats?: Record<string, number | string>;
}

/**
 * Admin panel route handler
 */
export interface IAdminRouteHandler {
  handle(request: Request, context: AdminRouteContext): Promise<Response>;
  canHandle(path: string, method: string): boolean;
}

/**
 * Context passed to admin route handlers
 */
export interface AdminRouteContext {
  adminUser?: AdminUser;
  session?: AdminSession;
  config: AdminPanelConfig;
  storage: IKeyValueStore;
  params?: Record<string, string>;
}

/**
 * Admin panel service interface
 */
export interface IAdminPanelService {
  /**
   * Initialize admin panel
   */
  initialize(config: AdminPanelConfig): Promise<void>;

  /**
   * Generate authentication token
   */
  generateAuthToken(adminId: string): Promise<AdminAuthState>;

  /**
   * Validate authentication token
   */
  validateAuthToken(adminId: string, token: string): Promise<boolean>;

  /**
   * Create admin session
   */
  createSession(adminUser: AdminUser): Promise<AdminSession>;

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Promise<AdminSession | null>;

  /**
   * Invalidate session
   */
  invalidateSession(sessionId: string): Promise<void>;

  /**
   * Get admin statistics
   */
  getStats(): Promise<AdminPanelStats>;

  /**
   * Register route handler
   */
  registerRouteHandler(path: string, handler: IAdminRouteHandler): void;

  /**
   * Handle HTTP request
   */
  handleRequest(request: Request): Promise<Response>;
}

/**
 * Admin panel connector for EventBus integration
 */
export interface IAdminPanelConnector extends IConnector {
  /**
   * Start admin panel server
   */
  startServer(): Promise<void>;

  /**
   * Stop admin panel server
   */
  stopServer(): Promise<void>;

  /**
   * Get admin panel URL
   */
  getAdminUrl(): string;
}

/**
 * Platform-specific admin adapter
 */
export interface IAdminPlatformAdapter {
  /**
   * Platform name (telegram, discord, etc.)
   */
  platform: string;

  /**
   * Send auth token to admin
   */
  sendAuthToken(adminId: string, token: string, expiresIn: number): Promise<void>;

  /**
   * Get admin user info
   */
  getAdminUser(platformId: string): Promise<AdminUser | null>;

  /**
   * Check if user is admin
   */
  isAdmin(platformId: string): Promise<boolean>;

  /**
   * Handle admin command
   */
  handleAdminCommand(command: string, userId: string, args?: string[]): Promise<void>;
}

/**
 * HTML template options
 */
export interface AdminTemplateOptions {
  title: string;
  content: string;
  user?: AdminUser;
  stats?: AdminPanelStats;
  messages?: Array<{
    type: 'success' | 'error' | 'warning' | 'info';
    text: string;
  }>;
  scripts?: string[];
  styles?: string[];
}

/**
 * Admin panel template engine
 */
export interface IAdminTemplateEngine {
  /**
   * Render layout template
   */
  renderLayout(options: AdminTemplateOptions): string;

  /**
   * Render login page
   */
  renderLogin(error?: string): string;

  /**
   * Render dashboard
   */
  renderDashboard(stats: AdminPanelStats, user: AdminUser): string;

  /**
   * Render error page
   */
  renderError(error: string, statusCode: number): string;
}

/**
 * Admin panel events
 */
export enum AdminPanelEvent {
  // Authentication events
  AUTH_TOKEN_GENERATED = 'admin:auth:token_generated',
  AUTH_TOKEN_VALIDATED = 'admin:auth:token_validated',
  AUTH_TOKEN_EXPIRED = 'admin:auth:token_expired',
  AUTH_LOGIN_ATTEMPT = 'admin:auth:login_attempt',
  AUTH_LOGIN_SUCCESS = 'admin:auth:login_success',
  AUTH_LOGIN_FAILED = 'admin:auth:login_failed',

  // Session events
  SESSION_CREATED = 'admin:session:created',
  SESSION_EXPIRED = 'admin:session:expired',
  SESSION_INVALIDATED = 'admin:session:invalidated',

  // Access events
  PANEL_ACCESSED = 'admin:panel:accessed',
  ROUTE_ACCESSED = 'admin:route:accessed',
  ACTION_PERFORMED = 'admin:action:performed',

  // System events
  SERVER_STARTED = 'admin:server:started',
  SERVER_STOPPED = 'admin:server:stopped',
  ERROR_OCCURRED = 'admin:error:occurred',
}

/**
 * Admin action for audit logging
 */
export interface AdminAction {
  id: string;
  userId: string;
  action: string;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
}
