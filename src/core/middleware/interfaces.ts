/**
 * Universal middleware interfaces for all platforms
 * These define the contract that platform-specific middleware must implement
 */

import type { Event } from '@/core/events/event-bus'
import type { UserRole } from '@/core/interfaces/role-system'

/**
 * Base middleware context that all platforms must provide
 */
export interface MiddlewareContext {
  /**
   * Platform name (telegram, discord, slack, etc.)
   */
  platform: string

  /**
   * User identifier in format: platform_id
   */
  userId?: string

  /**
   * Additional platform-specific data
   */
  metadata?: Record<string, unknown>
}

/**
 * Authentication result from middleware
 */
export interface AuthResult {
  authenticated: boolean
  userId?: string
  role?: UserRole
  permissions?: string[]
}

/**
 * Rate limit result from middleware
 */
export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: Date
}

/**
 * Audit event that middleware can emit
 */
export interface AuditEvent extends Event<AuditPayload> {
  type: 'audit.action' | 'audit.access' | 'audit.error'
}

export interface AuditPayload {
  action: string
  userId?: string
  resource?: string
  result: 'success' | 'failure'
  metadata?: Record<string, unknown>
}

/**
 * Universal auth middleware interface
 */
export interface IAuthMiddleware {
  /**
   * Check if user is authenticated
   */
  authenticate(context: MiddlewareContext): Promise<AuthResult>

  /**
   * Check if user has specific role
   */
  hasRole(context: MiddlewareContext, role: UserRole): Promise<boolean>

  /**
   * Check if user has specific permission
   */
  hasPermission(context: MiddlewareContext, permission: string): Promise<boolean>

  /**
   * Get user's current role
   */
  getUserRole(context: MiddlewareContext): Promise<UserRole | null>
}

/**
 * Universal rate limiter interface
 */
export interface IRateLimiter {
  /**
   * Check if request is allowed
   */
  checkLimit(context: MiddlewareContext, key?: string): Promise<RateLimitResult>

  /**
   * Reset limit for specific key
   */
  resetLimit(key: string): Promise<void>
}

/**
 * Universal audit middleware interface
 */
export interface IAuditMiddleware {
  /**
   * Log an audit event
   */
  log(event: AuditPayload): Promise<void>

  /**
   * Get audit trail for user
   */
  getUserAuditTrail(userId: string, limit?: number): Promise<AuditEvent[]>

  /**
   * Get audit trail for resource
   */
  getResourceAuditTrail(resource: string, limit?: number): Promise<AuditEvent[]>
}
