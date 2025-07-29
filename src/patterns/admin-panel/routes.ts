/**
 * Admin panel routes
 * Handles routing for all admin panel pages
 */

import type { ExecutionContext } from '@cloudflare/workers-types';

import { handleAdminAuth } from './handlers/auth';
import { handleAdminDashboard } from './handlers/dashboard';
import { handleAdminUsers, handleAdminUserDetail } from './handlers/users';
import { requireAdminAuth } from './middleware/auth';
import type { AdminEnv, AdminRequest } from './types';

export async function handleAdminRoutes(
  request: Request,
  env: AdminEnv,
  _ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Public routes (no auth required)
  if (path === '/admin' || path === '/admin/') {
    return handleAdminAuth(request, env);
  }

  // Check authentication for all other routes
  const authResult = await requireAdminAuth(request, env);
  if (authResult instanceof Response) {
    return authResult; // Return redirect to login
  }

  // Authenticated routes
  const authenticatedRequest = request as AdminRequest;
  authenticatedRequest.adminId = authResult.adminId;
  authenticatedRequest.isAuthenticated = true;

  // Route to appropriate handler
  switch (path) {
    case '/admin/dashboard':
      return handleAdminDashboard(authenticatedRequest, env);

    case '/admin/logout':
      return handleAdminLogout();

    case '/admin/users':
      return handleAdminUsers(authenticatedRequest, env);

    default: {
      // Check for user detail route pattern
      const userMatch = path.match(/^\/admin\/users\/(\d+)$/);
      if (userMatch) {
        return handleAdminUserDetail(authenticatedRequest, env, userMatch[1]);
      }

      return new Response('Not Found', { status: 404 });
    }
  }
}

/**
 * Handle logout
 */
function handleAdminLogout(): Response {
  // Clear session cookie
  return new Response('Logged out', {
    status: 302,
    headers: {
      Location: '/admin',
      'Set-Cookie': 'admin_session=; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
    },
  });
}
