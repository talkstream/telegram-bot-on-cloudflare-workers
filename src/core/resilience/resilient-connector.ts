/**
 * Resilient Connector Wrapper - Placeholder
 *
 * NOTE: The resilient connector wrappers are temporarily disabled as they need
 * to be updated to match the new AIConnector and MessagingConnector interfaces.
 *
 * The old implementation expected methods like generateResponse() and sendMessage()
 * but the new interfaces use complete() for AI and different message structures.
 *
 * TODO: Reimplement resilient wrappers for new connector interfaces
 */

import type { CircuitBreakerConfig } from './circuit-breaker'

import { logger } from '@/lib/logger'

/**
 * Placeholder for ResilientAIConnector
 * Will be reimplemented to match new AIConnector interface
 */
export class ResilientAIConnector {
  constructor(_connector: unknown, _config?: Partial<CircuitBreakerConfig>) {
    logger.warn('ResilientAIConnector is temporarily disabled - needs update for new interface')
  }
}

/**
 * Placeholder for ResilientMessagingConnector
 * Will be reimplemented to match new MessagingConnector interface
 */
export class ResilientMessagingConnector {
  constructor(_connector: unknown, _config?: Partial<CircuitBreakerConfig>) {
    logger.warn(
      'ResilientMessagingConnector is temporarily disabled - needs update for new interface'
    )
  }
}

/**
 * Factory function placeholder
 * Currently returns connector without wrapping
 */
export function withResilience<T>(connector: T, _config?: Partial<CircuitBreakerConfig>): T {
  logger.warn('withResilience is temporarily bypassed - resilient wrappers need update')
  return connector
}
