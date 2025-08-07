/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by temporarily blocking requests to failing services
 */

import { EventBus } from '@/core/events/event-bus'
import { logger } from '@/lib/logger'

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Blocking all requests
  HALF_OPEN = 'HALF_OPEN' // Testing recovery
}

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number
  /** Time window for counting failures (ms) */
  failureWindow: number
  /** Success rate threshold (0-1) */
  successThreshold: number
  /** Time before attempting recovery (ms) */
  recoveryTimeout: number
  /** Number of test requests in half-open state */
  halfOpenRequests: number
  /** Optional name for logging */
  name?: string
}

export interface CircuitBreakerStats {
  state: CircuitState
  failures: number
  successes: number
  lastFailureTime?: number
  lastStateChange: number
  totalRequests: number
  consecutiveFailures: number
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failures: number[] = []
  private successes: number[] = []
  private consecutiveFailures = 0
  private halfOpenRequests = 0
  private lastStateChange = Date.now()
  private recoveryTimer?: NodeJS.Timeout
  private totalRequests = 0
  private eventBus?: EventBus

  constructor(
    private config: CircuitBreakerConfig,
    eventBus?: EventBus
  ) {
    this.eventBus = eventBus
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<R>(fn: () => Promise<R>): Promise<R> {
    this.totalRequests++

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      const error = new Error(`Circuit breaker is OPEN for ${this.config.name || 'service'}`)
      this.emitEvent('circuit:rejected', { name: this.config.name, state: this.state })
      throw error
    }

    // Check half-open limit
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenRequests >= this.config.halfOpenRequests) {
        const error = new Error(
          `Circuit breaker is testing recovery for ${this.config.name || 'service'}`
        )
        this.emitEvent('circuit:rejected', { name: this.config.name, state: this.state })
        throw error
      }
      this.halfOpenRequests++
    }

    try {
      const result = await fn()
      this.recordSuccess()
      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }

  /**
   * Record successful execution
   */
  private recordSuccess(): void {
    const now = Date.now()
    this.successes.push(now)
    this.consecutiveFailures = 0

    // Clean old successes
    this.successes = this.successes.filter(time => now - time < this.config.failureWindow)

    // Handle half-open state
    if (this.state === CircuitState.HALF_OPEN) {
      // Check if we've completed all test requests successfully
      if (this.halfOpenRequests >= this.config.halfOpenRequests) {
        // All test requests succeeded, close the circuit
        this.close()
      }
    }

    this.emitEvent('circuit:success', {
      name: this.config.name,
      state: this.state,
      successRate: this.getSuccessRate()
    })
  }

  /**
   * Record failed execution
   */
  private recordFailure(): void {
    const now = Date.now()
    this.failures.push(now)
    this.consecutiveFailures++

    // Clean old failures
    this.failures = this.failures.filter(time => now - time < this.config.failureWindow)

    // Check if we should open the circuit
    if (this.state === CircuitState.CLOSED) {
      if (this.failures.length >= this.config.failureThreshold) {
        this.open()
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Single failure in half-open reopens circuit
      this.open()
    }

    this.emitEvent('circuit:failure', {
      name: this.config.name,
      state: this.state,
      failures: this.failures.length,
      consecutiveFailures: this.consecutiveFailures
    })
  }

  /**
   * Open the circuit (block requests)
   */
  private open(): void {
    if (this.state === CircuitState.OPEN) return

    this.state = CircuitState.OPEN
    this.lastStateChange = Date.now()
    this.halfOpenRequests = 0

    logger.warn('Circuit breaker opened', {
      name: this.config.name,
      failures: this.failures.length,
      consecutiveFailures: this.consecutiveFailures
    })

    // Schedule recovery attempt
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer)
    }

    this.recoveryTimer = setTimeout(() => {
      this.halfOpen()
    }, this.config.recoveryTimeout)

    this.emitEvent('circuit:open', {
      name: this.config.name,
      recoveryTimeout: this.config.recoveryTimeout
    })
  }

  /**
   * Enter half-open state (test recovery)
   */
  private halfOpen(): void {
    this.state = CircuitState.HALF_OPEN
    this.lastStateChange = Date.now()
    this.halfOpenRequests = 0
    this.consecutiveFailures = 0

    logger.info('Circuit breaker half-open', {
      name: this.config.name
    })

    this.emitEvent('circuit:half-open', {
      name: this.config.name,
      testRequests: this.config.halfOpenRequests
    })
  }

  /**
   * Close the circuit (resume normal operation)
   */
  private close(): void {
    if (this.state === CircuitState.CLOSED) return

    this.state = CircuitState.CLOSED
    this.lastStateChange = Date.now()
    this.halfOpenRequests = 0
    this.failures = []
    this.consecutiveFailures = 0

    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer)
      this.recoveryTimer = undefined
    }

    logger.info('Circuit breaker closed', {
      name: this.config.name
    })

    this.emitEvent('circuit:closed', { name: this.config.name })
  }

  /**
   * Get current success rate
   */
  private getSuccessRate(): number {
    const total = this.successes.length + this.failures.length
    if (total === 0) return 1
    return this.successes.length / total
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    // eslint-disable-next-line db-mapping/use-field-mapper -- Not database mapping, just stats object
    return {
      state: this.state,
      failures: this.failures.length,
      successes: this.successes.length,
      lastFailureTime: this.failures[this.failures.length - 1],
      lastStateChange: this.lastStateChange,
      totalRequests: this.totalRequests,
      consecutiveFailures: this.consecutiveFailures
    }
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.close()
    this.failures = []
    this.successes = []
    this.consecutiveFailures = 0
    this.totalRequests = 0

    logger.info('Circuit breaker manually reset', {
      name: this.config.name
    })

    this.emitEvent('circuit:reset', { name: this.config.name })
  }

  /**
   * Emit event through EventBus if available
   */
  private emitEvent(event: string, data: Record<string, unknown>): void {
    if (this.eventBus) {
      this.eventBus.emit(event, data, 'CircuitBreaker')
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN
  }

  /**
   * Check if circuit is closed
   */
  isClosed(): boolean {
    return this.state === CircuitState.CLOSED
  }
}
