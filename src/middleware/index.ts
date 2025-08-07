/**
 * HTTP middleware exports for Hono server
 * These middleware handle HTTP-level concerns
 */

export { errorHandler } from './error-handler'
export { eventListenerMiddleware, eventMiddleware } from './event-middleware'
export { apiRateLimit, rateLimiter, relaxedRateLimit, strictRateLimit } from './rate-limiter'

// Platform-specific middleware should be imported from their respective adapters
// e.g., import { createAuthMiddleware } from '@/adapters/telegram/middleware';
