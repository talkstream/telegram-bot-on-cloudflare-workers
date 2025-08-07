/**
 * Health Check System
 *
 * Provides comprehensive health monitoring for all system components
 */

import type { Context } from 'hono'

import { TieredCache } from '@/core/cache/tiered-cache'
import type { EventBus } from '@/core/events/event-bus'
import type { ICloudPlatformConnector } from '@/core/interfaces/cloud-platform'
import { CircuitBreakerManager } from '@/core/resilience/circuit-breaker-manager'
import { logger } from '@/lib/logger'

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: number
  checks: Record<string, ComponentHealth>
  summary: {
    totalChecks: number
    healthyChecks: number
    degradedChecks: number
    unhealthyChecks: number
  }
}

export interface ComponentHealth {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime?: number
  details?: Record<string, unknown>
  error?: string
}

export interface HealthCheckConfig {
  includeDetails?: boolean
  timeout?: number
  components?: string[]
}

export class HealthCheckService {
  private checks: Map<string, () => Promise<ComponentHealth>> = new Map()
  private lastCheck: HealthCheckResult | null = null
  private checkInterval: number = 60000 // 1 minute default

  constructor(
    private eventBus: EventBus,
    private platform: ICloudPlatformConnector
  ) {
    this.registerDefaultChecks()
  }

  /**
   * Register default health checks
   */
  private registerDefaultChecks(): void {
    // Platform health
    this.registerCheck('platform', async () => {
      const start = Date.now()
      try {
        if (!this.platform) {
          return {
            name: 'Platform',
            status: 'degraded',
            error: 'Platform not configured'
          }
        }
        const kv = this.platform.getKeyValueStore('CACHE')
        await kv.get('health_check_test')
        return {
          name: 'Platform',
          status: 'healthy',
          responseTime: Date.now() - start
        }
      } catch (error) {
        return {
          name: 'Platform',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    // Database health
    this.registerCheck('database', async () => {
      const start = Date.now()
      try {
        if (!this.platform) {
          return {
            name: 'Database',
            status: 'degraded',
            error: 'Platform not configured'
          }
        }
        const db = this.platform.getDatabaseStore('DB')
        await db.prepare('SELECT 1').first()
        return {
          name: 'Database',
          status: 'healthy',
          responseTime: Date.now() - start
        }
      } catch (error) {
        return {
          name: 'Database',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    // Cache health
    this.registerCheck('cache', async () => {
      const start = Date.now()
      try {
        const cache = TieredCache.getInstance()
        const stats = cache.getStats()

        // If cache is empty (no hits or misses), it's still healthy
        const totalOps = stats.hits + stats.misses
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
        let hitRate = 0

        if (totalOps > 0) {
          hitRate = stats.hits / totalOps
          status = hitRate >= 0.5 ? 'healthy' : hitRate >= 0.3 ? 'degraded' : 'unhealthy'
        }

        // Calculate total entries from tier stats
        let totalEntries = 0
        for (const tierStat of Object.values(stats.tierStats || {})) {
          totalEntries += tierStat.items || 0
        }

        return {
          name: 'Cache',
          status,
          responseTime: Date.now() - start,
          details: {
            hitRate: Math.round(hitRate * 100) + '%',
            entries: totalEntries,
            evictions: stats.evictions
          }
        }
      } catch (error) {
        return {
          name: 'Cache',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    // Circuit breakers health
    this.registerCheck('circuit_breakers', async () => {
      try {
        const manager = CircuitBreakerManager.getInstance()
        const stats = manager.getAllStats()

        let openCircuits = 0
        let halfOpenCircuits = 0

        for (const [, stat] of Object.entries(stats)) {
          if (stat.state === 'OPEN') openCircuits++
          if (stat.state === 'HALF_OPEN') halfOpenCircuits++
        }

        const status = openCircuits === 0 ? 'healthy' : openCircuits <= 2 ? 'degraded' : 'unhealthy'

        return {
          name: 'Circuit Breakers',
          status,
          details: {
            totalCircuits: Object.keys(stats).length,
            openCircuits,
            halfOpenCircuits
          }
        }
      } catch (error) {
        return {
          name: 'Circuit Breakers',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    // Event bus health
    this.registerCheck('event_bus', async () => {
      const start = Date.now()
      try {
        let responded = false

        // Test event roundtrip
        const testPromise = new Promise<void>(resolve => {
          const unsubscribe = this.eventBus.on('health:test:response', () => {
            responded = true
            unsubscribe()
            resolve()
          })

          this.eventBus.emit('health:test:request', {}, 'health-check')

          // Timeout after 100ms
          setTimeout(() => {
            unsubscribe()
            resolve()
          }, 100)
        })

        await testPromise

        return {
          name: 'Event Bus',
          status: responded ? 'healthy' : 'degraded',
          responseTime: Date.now() - start
        }
      } catch (error) {
        return {
          name: 'Event Bus',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })
  }

  /**
   * Register a custom health check
   */
  registerCheck(name: string, check: () => Promise<ComponentHealth>): void {
    this.checks.set(name, check)
  }

  /**
   * Unregister a health check
   */
  unregisterCheck(name: string): void {
    this.checks.delete(name)
  }

  /**
   * Perform health check
   */
  async check(config: HealthCheckConfig = {}): Promise<HealthCheckResult> {
    const {
      includeDetails = true,
      timeout = 5000,
      components = Array.from(this.checks.keys())
    } = config

    const results: Record<string, ComponentHealth> = {}
    const checkPromises: Promise<void>[] = []

    for (const component of components) {
      const checkFn = this.checks.get(component)
      if (!checkFn) continue

      const promise = Promise.race([
        checkFn(),
        new Promise<ComponentHealth>(resolve =>
          setTimeout(
            () =>
              resolve({
                name: component,
                status: 'unhealthy',
                error: 'Health check timeout'
              }),
            timeout
          )
        )
      ]).then(result => {
        results[component] = includeDetails
          ? result
          : {
              name: result.name,
              status: result.status
            }
        return
      })

      checkPromises.push(promise)
    }

    await Promise.all(checkPromises)

    const summary = {
      totalChecks: Object.keys(results).length,
      healthyChecks: 0,
      degradedChecks: 0,
      unhealthyChecks: 0
    }

    for (const check of Object.values(results)) {
      if (check.status === 'healthy') summary.healthyChecks++
      else if (check.status === 'degraded') summary.degradedChecks++
      else summary.unhealthyChecks++
    }

    const overallStatus =
      summary.unhealthyChecks > 0
        ? 'unhealthy'
        : summary.degradedChecks > 0
          ? 'degraded'
          : 'healthy'

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: Date.now(),
      checks: results,
      summary
    }

    this.lastCheck = result

    // Emit health check event
    this.eventBus.emit('health:check:completed', { result }, 'health-check')

    // Log if unhealthy
    if (overallStatus === 'unhealthy') {
      logger.error('Health check failed', { result })
    } else if (overallStatus === 'degraded') {
      logger.warn('Health check degraded', { result })
    }

    return result
  }

  /**
   * Get last health check result
   */
  getLastCheck(): HealthCheckResult | null {
    return this.lastCheck
  }

  private intervalId?: NodeJS.Timeout

  /**
   * Start periodic health checks
   */
  startPeriodicChecks(interval: number = this.checkInterval): void {
    this.stopPeriodicChecks()

    this.intervalId = setInterval(async () => {
      await this.check()
    }, interval)
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }
  }

  /**
   * Get health status (for quick checks)
   */
  async getStatus(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    // Use cached result if recent (< 30 seconds)
    if (this.lastCheck && Date.now() - this.lastCheck.timestamp < 30000) {
      return this.lastCheck.status
    }

    const result = await this.check({ includeDetails: false })
    return result.status
  }
}

/**
 * Health check middleware for Hono
 */
export function createHealthCheckMiddleware(healthService: HealthCheckService) {
  return async (ctx: Context) => {
    const path = new URL(ctx.req.url).pathname

    if (path === '/health') {
      // Quick health check
      const status = await healthService.getStatus()
      return ctx.json(
        {
          status,
          timestamp: Date.now()
        },
        status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503
      )
    }

    if (path === '/health/detailed') {
      // Detailed health check
      const result = await healthService.check()
      return ctx.json(
        result,
        result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503
      )
    }

    if (path === '/health/live') {
      // Liveness probe (is the service running?)
      return ctx.text('OK', 200)
    }

    if (path === '/health/ready') {
      // Readiness probe (is the service ready to handle requests?)
      const status = await healthService.getStatus()
      return ctx.text(
        status === 'unhealthy' ? 'NOT READY' : 'READY',
        status === 'unhealthy' ? 503 : 200
      )
    }

    // Path not handled, continue to next middleware
    return
  }
}
