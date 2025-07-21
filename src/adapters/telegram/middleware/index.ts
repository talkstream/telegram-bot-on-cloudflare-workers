/**
 * Telegram-specific middleware exports
 * These implement the universal middleware interfaces for Telegram platform
 */

export { createAuthMiddleware } from './auth';
export { createRateLimitMiddleware, TelegramRateLimiter, telegramRateLimits } from './rate-limiter';
export { createAuditMiddleware, TelegramAuditMiddleware, createTelegramAuditLogger } from './audit';

// Re-export types for convenience
export type {
  IAuthMiddleware,
  IRateLimiter,
  IAuditMiddleware,
  MiddlewareContext,
  AuthResult,
  RateLimitResult,
  AuditEvent,
  AuditPayload,
} from '@/core/middleware/interfaces';
