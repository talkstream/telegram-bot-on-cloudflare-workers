/**
 * Login Handler for Admin Panel
 */

import type {
  IAdminRouteHandler,
  AdminRouteContext,
  IAdminPanelService,
  IAdminPlatformAdapter,
} from '../../../core/interfaces/admin-panel.js';
import type { ILogger } from '../../../core/interfaces/logger.js';
import { AdminTemplateEngine } from '../templates/template-engine.js';
import { AdminAuthService } from '../../../core/services/admin-auth-service.js';

interface LoginHandlerDeps {
  adminService: IAdminPanelService;
  platformAdapter: IAdminPlatformAdapter;
  authService: AdminAuthService;
  templateEngine: AdminTemplateEngine;
  logger: ILogger;
}

export class LoginHandler implements IAdminRouteHandler {
  private adminService: IAdminPanelService;
  private platformAdapter: IAdminPlatformAdapter;
  private authService: AdminAuthService;
  private templateEngine: AdminTemplateEngine;
  private logger: ILogger;

  constructor(deps: LoginHandlerDeps) {
    this.adminService = deps.adminService;
    this.platformAdapter = deps.platformAdapter;
    this.authService = deps.authService;
    this.templateEngine = deps.templateEngine;
    this.logger = deps.logger;
  }

  canHandle(path: string, method: string): boolean {
    return (path === '/admin' || path === '/admin/') && (method === 'GET' || method === 'POST');
  }

  async handle(request: Request, context: AdminRouteContext): Promise<Response> {
    // If already authenticated, redirect to dashboard
    if (context.adminUser) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: '/admin/dashboard',
        },
      });
    }

    if (request.method === 'POST') {
      return this.handleLogin(request, context);
    }

    // Show login form
    const html = this.templateEngine.renderLogin();
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  private async handleLogin(request: Request, _context: AdminRouteContext): Promise<Response> {
    try {
      const formData = await request.formData();
      const adminId = formData.get('admin_id')?.toString();
      const authCode = formData.get('auth_code')?.toString()?.toUpperCase();

      if (!adminId || !authCode) {
        const html = this.templateEngine.renderLogin('Please provide both Admin ID and Auth Code');
        return new Response(html, {
          status: 400,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // Validate auth token
      const isValid = await this.adminService.validateAuthToken(adminId, authCode);

      if (!isValid) {
        const html = this.templateEngine.renderLogin('Invalid or expired auth code');
        return new Response(html, {
          status: 401,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // Get admin user info
      const adminUser = await this.platformAdapter.getAdminUser(adminId);

      if (!adminUser) {
        const html = this.templateEngine.renderLogin('Admin user not found');
        return new Response(html, {
          status: 401,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // Create session
      const session = await this.adminService.createSession(adminUser);

      // Set session cookie and redirect
      const sessionCookie = this.authService.createSessionCookie(session.id);

      return new Response(null, {
        status: 302,
        headers: {
          Location: '/admin/dashboard',
          'Set-Cookie': sessionCookie,
        },
      });
    } catch (error) {
      this.logger.error('Login error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      const html = this.templateEngine.renderLogin('An error occurred. Please try again.');
      return new Response(html, {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      });
    }
  }
}
