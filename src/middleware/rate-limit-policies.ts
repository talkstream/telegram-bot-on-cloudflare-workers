import { rateLimiter } from './rate-limiter'

import type { EventBus } from '@/core/events/event-bus'

/**
 * Rate limiting policies for different endpoint types
 * Centralized configuration for consistent rate limiting across the application
 */

interface RateLimitPolicyConfig {
  windowMs?: number
  maxRequests?: number
  eventBus?: EventBus
}

/**
 * Creates rate limit policies with optional EventBus integration
 */
export function createRateLimitPolicies(config?: RateLimitPolicyConfig) {
  const { eventBus } = config || {}

  return {
    /**
     * Global rate limit - applies to all endpoints by default
     * Very generous to avoid blocking legitimate traffic
     */
    global: rateLimiter({
      windowMs: 60000, // 1 minute
      maxRequests: 100, // 100 requests per minute
      eventBus,
      message: 'Global rate limit exceeded. Please slow down your requests.'
    }),

    /**
     * Strict rate limit - for sensitive endpoints like webhooks
     * Prevents abuse and DDoS attacks
     */
    strict: rateLimiter({
      windowMs: 60000, // 1 minute
      maxRequests: 20, // 20 requests per minute
      eventBus,
      message: 'Rate limit exceeded for this endpoint. Please try again later.'
    }),

    /**
     * API rate limit - for API endpoints
     * Balanced between usability and protection
     */
    api: rateLimiter({
      windowMs: 60000, // 1 minute
      maxRequests: 60, // 60 requests per minute
      skipFailedRequests: true, // Don't count failed requests
      eventBus,
      message: 'API rate limit exceeded. Please check the Retry-After header.'
    }),

    /**
     * Health check rate limit - for monitoring endpoints
     * More permissive for monitoring tools
     */
    health: rateLimiter({
      windowMs: 60000, // 1 minute
      maxRequests: 120, // 120 requests per minute (2 per second)
      skipSuccessfulRequests: false,
      eventBus,
      message: 'Health check rate limit exceeded.'
    }),

    /**
     * Static content rate limit - for demo/documentation pages
     * Very permissive as these are low-cost endpoints
     */
    static: rateLimiter({
      windowMs: 60000, // 1 minute
      maxRequests: 200, // 200 requests per minute
      skipSuccessfulRequests: true, // Only count errors
      eventBus,
      message: 'Static content rate limit exceeded.'
    }),

    /**
     * Auth rate limit - for authentication endpoints
     * Very strict to prevent brute force attacks
     */
    auth: rateLimiter({
      windowMs: 900000, // 15 minutes
      maxRequests: 5, // 5 attempts per 15 minutes
      skipSuccessfulRequests: true, // Only count failed attempts
      eventBus,
      message: 'Too many authentication attempts. Please try again in 15 minutes.'
    }),

    /**
     * Burst rate limit - for preventing sudden traffic spikes
     * Short window with low limit
     */
    burst: rateLimiter({
      windowMs: 1000, // 1 second
      maxRequests: 10, // 10 requests per second max
      eventBus,
      message: 'Burst limit exceeded. Please spread out your requests.'
    })
  }
}

/**
 * Environment-aware rate limit configuration
 * Adjusts limits based on deployment environment
 */
export function getEnvironmentRateLimits(environment?: string) {
  const isProd = environment === 'production'
  const isDev = environment === 'development'

  if (isDev) {
    // Very permissive in development
    return {
      globalMax: 1000,
      apiMax: 500,
      strictMax: 100
    }
  }

  if (isProd) {
    // Conservative in production
    return {
      globalMax: 100,
      apiMax: 60,
      strictMax: 20
    }
  }

  // Default (staging, test, etc.)
  return {
    globalMax: 200,
    apiMax: 100,
    strictMax: 40
  }
}

/**
 * Rate limit groups for applying multiple policies
 */
export const rateLimitGroups = {
  /**
   * Public endpoints - accessible without authentication
   */
  public: ['global', 'burst'],

  /**
   * Protected endpoints - require authentication
   */
  protected: ['global', 'api', 'burst'],

  /**
   * Admin endpoints - highly restricted
   */
  admin: ['global', 'strict', 'auth', 'burst'],

  /**
   * Webhook endpoints - external service callbacks
   */
  webhook: ['strict', 'burst'],

  /**
   * Monitoring endpoints - health checks and metrics
   */
  monitoring: ['health']
}
