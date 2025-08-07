/**
 * Circuit Breaker Manager
 *
 * Manages multiple circuit breakers for different services
 */

import type { CircuitBreakerConfig, CircuitBreakerStats } from './circuit-breaker'
import { CircuitBreaker } from './circuit-breaker'

import { EventBus } from '@/core/events/event-bus'
import { logger } from '@/lib/logger'

export interface ServiceConfig extends CircuitBreakerConfig {
  /** Service identifier */
  service: string
}

export interface ManagerStats {
  services: Record<string, CircuitBreakerStats>
  totalRequests: number
  openCircuits: string[]
  halfOpenCircuits: string[]
}

export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager | null = null
  private breakers = new Map<string, CircuitBreaker>()
  private eventBus?: EventBus
  private defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    failureWindow: 60000, // 1 minute
    successThreshold: 0.8,
    recoveryTimeout: 30000, // 30 seconds
    halfOpenRequests: 3
  }

  private constructor(eventBus?: EventBus) {
    this.eventBus = eventBus
    this.setupEventListeners()
  }

  /**
   * Get singleton instance
   */
  static getInstance(eventBus?: EventBus): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager(eventBus)
    }
    return CircuitBreakerManager.instance
  }

  /**
   * Register a service with circuit breaker
   */
  register(config: ServiceConfig): CircuitBreaker {
    const { service, ...breakerConfig } = config

    const existing = this.breakers.get(service)
    if (existing) {
      logger.warn('Circuit breaker already registered', { service })
      return existing
    }

    const breaker = new CircuitBreaker(
      { ...this.defaultConfig, ...breakerConfig, name: service },
      this.eventBus
    )

    this.breakers.set(service, breaker)

    logger.info('Circuit breaker registered', {
      service,
      config: breakerConfig
    })

    this.eventBus?.emit('circuit:registered', { service, config }, 'CircuitBreakerManager')

    return breaker
  }

  /**
   * Get circuit breaker for a service
   */
  get(service: string): CircuitBreaker | undefined {
    return this.breakers.get(service)
  }

  /**
   * Get or create circuit breaker for a service
   */
  getOrCreate(service: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    let breaker = this.breakers.get(service)

    if (!breaker) {
      breaker = this.register({
        service,
        ...this.defaultConfig,
        ...config
      })
    }

    return breaker
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(service: string, fn: () => Promise<T>): Promise<T> {
    const breaker = this.getOrCreate(service)
    return breaker.execute(fn)
  }

  /**
   * Execute with custom config
   */
  async executeWithConfig<T>(
    service: string,
    config: Partial<CircuitBreakerConfig>,
    fn: () => Promise<T>
  ): Promise<T> {
    const breaker = this.getOrCreate(service, config)
    return breaker.execute(fn)
  }

  /**
   * Get statistics for all services
   */
  getStats(): ManagerStats {
    const stats: ManagerStats = {
      services: {},
      totalRequests: 0,
      openCircuits: [],
      halfOpenCircuits: []
    }

    for (const [service, breaker] of this.breakers) {
      const breakerStats = breaker.getStats()
      stats.services[service] = breakerStats
      stats.totalRequests += breakerStats.totalRequests

      if (breakerStats.state === 'OPEN') {
        stats.openCircuits.push(service)
      } else if (breakerStats.state === 'HALF_OPEN') {
        stats.halfOpenCircuits.push(service)
      }
    }

    return stats
  }

  /**
   * Get all statistics (alias for getStats)
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const result: Record<string, CircuitBreakerStats> = {}
    for (const [service, breaker] of this.breakers) {
      result[service] = breaker.getStats()
    }
    return result
  }

  /**
   * Reset a specific service breaker
   */
  reset(service: string): void {
    const breaker = this.breakers.get(service)
    if (breaker) {
      breaker.reset()
      logger.info('Circuit breaker reset', { service })
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const [_service, breaker] of this.breakers) {
      breaker.reset()
    }
    logger.info('All circuit breakers reset')
    this.eventBus?.emit('circuit:reset-all', {}, 'CircuitBreakerManager')
  }

  /**
   * Remove a service breaker
   */
  unregister(service: string): void {
    if (this.breakers.delete(service)) {
      logger.info('Circuit breaker unregistered', { service })
      this.eventBus?.emit('circuit:unregistered', { service }, 'CircuitBreakerManager')
    }
  }

  /**
   * Get health status
   */
  getHealth(): {
    healthy: boolean
    degraded: string[]
    unavailable: string[]
  } {
    const health = {
      healthy: true,
      degraded: [] as string[],
      unavailable: [] as string[]
    }

    for (const [service, breaker] of this.breakers) {
      const state = breaker.getState()

      if (state === 'OPEN') {
        health.healthy = false
        health.unavailable.push(service)
      } else if (state === 'HALF_OPEN') {
        health.degraded.push(service)
      }
    }

    return health
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.eventBus) return

    // Log circuit state changes
    this.eventBus.on('circuit:open', data => {
      logger.error('Service circuit opened', data)
    })

    this.eventBus.on('circuit:closed', data => {
      logger.info('Service circuit recovered', data)
    })

    this.eventBus.on('circuit:half-open', data => {
      logger.info('Service circuit testing recovery', data)
    })
  }

  /**
   * Set default configuration
   */
  setDefaultConfig(config: Partial<CircuitBreakerConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config }
    logger.info('Default circuit breaker config updated', this.defaultConfig)
  }

  /**
   * Clear singleton instance (for testing)
   */
  static clearInstance(): void {
    CircuitBreakerManager.instance = null
  }
}
