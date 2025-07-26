/**
 * Logout Handler for Admin Panel
 */

import { AdminPanelEvent } from '../../../core/interfaces/admin-panel.js';
import type {
  IAdminRouteHandler,
  AdminRouteContext,
  IAdminPanelService,
} from '../../../core/interfaces/admin-panel.js';
import type { IEventBus } from '../../../core/interfaces/event-bus.js';
import type { ILogger } from '../../../core/interfaces/logger.js';
import { AdminAuthService } from '../../../core/services/admin-auth-service.js';

interface LogoutHandlerDeps {
  adminService: IAdminPanelService;
  authService: AdminAuthService;
  eventBus: IEventBus;
  logger: ILogger;
}

export class LogoutHandler implements IAdminRouteHandler {
  private adminService: IAdminPanelService;
  private authService: AdminAuthService;
  private eventBus: IEventBus;
  private logger: ILogger;

  constructor(deps: LogoutHandlerDeps) {
    this.adminService = deps.adminService;
    this.authService = deps.authService;
    this.eventBus = deps.eventBus;
    this.logger = deps.logger;
  }

  canHandle(path: string, method: string): boolean {
    return path === '/admin/logout' && method === 'POST';
  }

  async handle(_request: Request, context: AdminRouteContext): Promise<Response> {
    if (context.session) {
      // Invalidate session
      await this.adminService.invalidateSession(context.session.id);

      // Emit logout event
      this.eventBus.emit(AdminPanelEvent.ACTION_PERFORMED, {
        userId: context.adminUser?.id || 'unknown',
        action: 'logout',
        timestamp: new Date(),
      });

      this.logger.info('Admin logged out', {
        userId: context.adminUser?.id,
        sessionId: context.session.id,
      });
    }

    // Clear session cookie and redirect to login
    const logoutCookie = this.authService.createLogoutCookie();

    return new Response(null, {
      status: 302,
      headers: {
        Location: '/admin',
        'Set-Cookie': logoutCookie,
      },
    });
  }
}
