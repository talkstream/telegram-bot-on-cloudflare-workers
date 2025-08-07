/**
 * Admin Panel Pattern
 *
 * A production-ready admin panel for Telegram bots on Cloudflare Workers
 *
 * @example
 * ```typescript
 * import { handleAdminRoutes } from './patterns/admin-panel';
 *
 * export default {
 *   async fetch(request: Request, env: Env, ctx: ExecutionContext) {
 *     const url = new URL(request.url);
 *
 *     if (url.pathname.startsWith('/admin')) {
 *       return handleAdminRoutes(request, env, ctx);
 *     }
 *
 *     // Handle other routes...
 *   },
 * };
 * ```
 */

export { createAdminSession, requireAdminAuth } from './middleware/auth'
export { handleAdminRoutes } from './routes'
export { renderAdminLayout } from './templates/layout'
export { renderLoginPage } from './templates/login'

// Export types
export type {
  AdminEnv,
  AdminRequest,
  AdminSession,
  AuthState,
  DashboardStats,
  LayoutOptions,
  LoginPageOptions
} from './types'

// Export test helpers for consumers
export {
  createMockAdminEnv,
  createMockKV,
  createMockPreparedStatement,
  mockTelegramBot
} from './__tests__/test-helpers'
