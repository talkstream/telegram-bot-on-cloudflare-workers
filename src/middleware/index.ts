/**
 * HTTP middleware exports for Hono server
 * These middleware handle HTTP-level concerns
 */

export { errorHandler } from './error-handler';
export { rateLimiter, strictRateLimit, relaxedRateLimit, apiRateLimit } from './rate-limiter';
export { eventMiddleware, eventListenerMiddleware } from './event-middleware';
export * from './performance-monitor';
export * from './performance-http';

// Platform-specific middleware should be imported from their respective adapters
// e.g., import { createAuthMiddleware } from '@/adapters/telegram/middleware';
