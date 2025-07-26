/**
 * Dashboard Handler for Admin Panel
 */

import { AdminPanelEvent } from '../../../core/interfaces/admin-panel.js';
import type {
  IAdminRouteHandler,
  AdminRouteContext,
  IAdminPanelService,
} from '../../../core/interfaces/admin-panel.js';
import type { IEventBus } from '../../../core/interfaces/event-bus.js';
import type { ILogger } from '../../../core/interfaces/logger.js';
import { AdminTemplateEngine } from '../templates/template-engine.js';

interface DashboardHandlerDeps {
  adminService: IAdminPanelService;
  templateEngine: AdminTemplateEngine;
  eventBus: IEventBus;
  logger: ILogger;
}

export class DashboardHandler implements IAdminRouteHandler {
  private adminService: IAdminPanelService;
  private templateEngine: AdminTemplateEngine;
  private eventBus: IEventBus;
  private logger: ILogger;

  constructor(deps: DashboardHandlerDeps) {
    this.adminService = deps.adminService;
    this.templateEngine = deps.templateEngine;
    this.eventBus = deps.eventBus;
    this.logger = deps.logger;
  }

  canHandle(path: string, method: string): boolean {
    return path === '/admin/dashboard' && method === 'GET';
  }

  async handle(_request: Request, context: AdminRouteContext): Promise<Response> {
    // Check authentication
    if (!context.adminUser) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: '/admin',
        },
      });
    }

    try {
      // Get stats
      const stats = await this.adminService.getStats();

      // Emit access event
      this.eventBus.emit(AdminPanelEvent.ROUTE_ACCESSED, {
        path: '/admin/dashboard',
        userId: context.adminUser.id,
        timestamp: new Date(),
      });

      // Render dashboard
      const html = this.templateEngine.renderDashboard(stats, context.adminUser);

      return new Response(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    } catch (error) {
      this.logger.error('Dashboard error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: context.adminUser.id,
      });

      const html = this.templateEngine.renderError('Failed to load dashboard', 500);

      return new Response(html, {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      });
    }
  }
}
