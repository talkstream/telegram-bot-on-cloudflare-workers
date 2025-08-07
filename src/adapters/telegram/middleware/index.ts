/**
 * Telegram-specific middleware exports
 * These implement the universal middleware interfaces for Telegram platform
 */

export { TelegramAuditMiddleware, createAuditMiddleware, createTelegramAuditLogger } from './audit'
export { createAuthMiddleware } from './auth'
export { TelegramRateLimiter, createRateLimitMiddleware, telegramRateLimits } from './rate-limiter'

// Re-export types for convenience
export type {
  AuditEvent,
  AuditPayload,
  AuthResult,
  IAuditMiddleware,
  IAuthMiddleware,
  IRateLimiter,
  MiddlewareContext,
  RateLimitResult
} from '@/core/middleware/interfaces'
