/**
 * Health Check System Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HealthCheckService } from '../health-check'

import { TieredCache } from '@/core/cache/tiered-cache'
import { EventBus } from '@/core/events/event-bus'
import type { ICloudPlatformConnector } from '@/core/interfaces/cloud-platform'
import { CircuitBreakerManager } from '@/core/resilience/circuit-breaker-manager'

describe('HealthCheckService', () => {
  let service: HealthCheckService
  let eventBus: EventBus
  let mockPlatform: ICloudPlatformConnector

  beforeEach(() => {
    eventBus = new EventBus()

    // Set up event bus responder for health checks
    eventBus.on('health:test:request', () => {
      eventBus.emit('health:test:response', {})
    })

    // Create mock platform
    mockPlatform = {
      getKeyValueStore: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue(null)
      }),
      getDatabaseStore: vi.fn().mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ 1: 1 })
        })
      }),
      getObjectStore: vi.fn(),
      getEnv: vi.fn().mockReturnValue({}),
      getResourceConstraints: vi.fn().mockReturnValue({
        maxCpuTime: 10,
        maxMemory: 128,
        maxStorageKeys: 1000,
        maxDatabaseRows: 100000,
        environment: 'test'
      })
    } as ICloudPlatformConnector

    service = new HealthCheckService(eventBus, mockPlatform)

    // Reset singletons
    CircuitBreakerManager['instance'] = undefined
    TieredCache['instance'] = undefined
  })

  afterEach(() => {
    service.stopPeriodicChecks()
  })

  describe('check', () => {
    it('should perform health check for all components', async () => {
      const result = await service.check()

      expect(result.status).toBeDefined()
      expect(result.timestamp).toBeGreaterThan(0)
      expect(result.checks).toBeDefined()
      expect(result.summary.totalChecks).toBeGreaterThan(0)
    })

    it('should return healthy status when all checks pass', async () => {
      const result = await service.check()

      expect(result.status).toBe('healthy')
      expect(result.summary.healthyChecks).toBe(result.summary.totalChecks)
    })

    it('should return unhealthy status when platform check fails', async () => {
      mockPlatform.getKeyValueStore = vi.fn().mockImplementation(() => {
        throw new Error('KV not available')
      })

      const result = await service.check()

      expect(result.status).toBe('unhealthy')
      expect(result.checks.platform.status).toBe('unhealthy')
      expect(result.checks.platform.error).toBe('KV not available')
    })

    it('should return unhealthy status when database check fails', async () => {
      mockPlatform.getDatabaseStore = vi.fn().mockImplementation(() => {
        throw new Error('DB connection failed')
      })

      const result = await service.check()

      expect(result.status).toBe('unhealthy')
      expect(result.checks.database.status).toBe('unhealthy')
      expect(result.checks.database.error).toBe('DB connection failed')
    })

    it('should respect timeout configuration', async () => {
      // Make platform check slow
      mockPlatform.getKeyValueStore = vi.fn().mockImplementation(() => ({
        get: () => new Promise(resolve => setTimeout(resolve, 1000))
      }))

      const result = await service.check({ timeout: 100 })

      expect(result.checks.platform.status).toBe('unhealthy')
      expect(result.checks.platform.error).toBe('Health check timeout')
    })

    it('should filter components when specified', async () => {
      const result = await service.check({ components: ['platform', 'database'] })

      expect(result.checks.platform).toBeDefined()
      expect(result.checks.database).toBeDefined()
      expect(result.checks.cache).toBeUndefined()
    })

    it('should exclude details when includeDetails is false', async () => {
      const result = await service.check({ includeDetails: false })

      for (const check of Object.values(result.checks)) {
        expect(check.name).toBeDefined()
        expect(check.status).toBeDefined()
        expect(check.details).toBeUndefined()
      }
    })
  })

  describe('cache health check', () => {
    it('should return healthy when cache hit rate is good', async () => {
      const cache = TieredCache.getInstance()

      // Simulate good hit rate
      await cache.set('test1', 'value1')
      await cache.get('test1') // hit
      await cache.get('test1') // hit
      await cache.get('test2') // miss

      const result = await service.check({ components: ['cache'] })

      expect(result.checks.cache.status).toBe('healthy')
      expect(result.checks.cache.details?.hitRate).toBe('67%')
    })

    it('should return degraded when cache hit rate is moderate', async () => {
      const cache = TieredCache.getInstance()

      // Simulate moderate hit rate
      await cache.get('test1') // miss
      await cache.get('test2') // miss
      await cache.set('test3', 'value3')
      await cache.get('test3') // hit

      const result = await service.check({ components: ['cache'] })

      expect(result.checks.cache.status).toBe('degraded')
    })
  })

  describe('circuit breaker health check', () => {
    it('should return healthy when no circuits are open', async () => {
      const manager = CircuitBreakerManager.getInstance()
      manager.register({
        service: 'test-service',
        failureThreshold: 3,
        failureWindow: 60000,
        recoveryTimeout: 30000
      })

      const result = await service.check({ components: ['circuit_breakers'] })

      expect(result.checks.circuit_breakers.status).toBe('healthy')
      expect(result.checks.circuit_breakers.details?.openCircuits).toBe(0)
    })

    it('should return degraded when few circuits are open', async () => {
      const manager = CircuitBreakerManager.getInstance()
      manager.register({
        service: 'test-service',
        failureThreshold: 1,
        failureWindow: 60000,
        recoveryTimeout: 30000
      })

      const breaker = manager.get('test-service')

      // Force circuit to open
      try {
        await breaker?.execute(async () => {
          throw new Error('Service error')
        })
      } catch {
        // Expected to fail to open the circuit
      }

      const result = await service.check({ components: ['circuit_breakers'] })

      expect(result.checks.circuit_breakers.status).toBe('degraded')
      expect(result.checks.circuit_breakers.details?.openCircuits).toBe(1)
    })
  })

  describe('event bus health check', () => {
    it('should return healthy when event bus responds', async () => {
      // Set up event bus responder
      eventBus.on('health:test:request', () => {
        eventBus.emit('health:test:response', {})
      })

      const result = await service.check({ components: ['event_bus'] })

      expect(result.checks.event_bus.status).toBe('healthy')
    })

    it('should return degraded when event bus does not respond', async () => {
      // Remove the responder that was set up in beforeEach
      eventBus.off('health:test:request')

      const result = await service.check({ components: ['event_bus'] })

      expect(result.checks.event_bus.status).toBe('degraded')
    })
  })

  describe('custom health checks', () => {
    it('should register and execute custom health check', async () => {
      service.registerCheck('custom', async () => ({
        name: 'Custom Service',
        status: 'healthy',
        responseTime: 10,
        details: { version: '1.0.0' }
      }))

      const result = await service.check({ components: ['custom'] })

      expect(result.checks.custom).toBeDefined()
      expect(result.checks.custom.status).toBe('healthy')
      expect(result.checks.custom.details?.version).toBe('1.0.0')
    })

    it('should unregister custom health check', async () => {
      service.registerCheck('custom', async () => ({
        name: 'Custom',
        status: 'healthy'
      }))

      service.unregisterCheck('custom')

      const result = await service.check({ components: ['custom'] })

      expect(result.checks.custom).toBeUndefined()
    })
  })

  describe('getStatus', () => {
    it('should return cached result if recent', async () => {
      await service.check()

      const checkSpy = vi.spyOn(service, 'check')
      const status = await service.getStatus()

      expect(status).toBe('healthy')
      expect(checkSpy).not.toHaveBeenCalled()
    })

    it('should perform new check if cache is stale', async () => {
      await service.check()

      // Make last check appear old
      const lastCheck = service.getLastCheck()
      if (lastCheck) {
        lastCheck.timestamp = Date.now() - 40000 // 40 seconds ago
      }

      const checkSpy = vi.spyOn(service, 'check')
      const status = await service.getStatus()

      expect(status).toBe('healthy')
      expect(checkSpy).toHaveBeenCalled()
    })
  })

  describe('periodic checks', () => {
    it('should start periodic health checks', async () => {
      const checkSpy = vi.spyOn(service, 'check')

      service.startPeriodicChecks(100) // 100ms interval for testing

      await new Promise(resolve => setTimeout(resolve, 250))

      expect(checkSpy).toHaveBeenCalledTimes(2)

      service.stopPeriodicChecks()
    })

    it('should stop periodic health checks', async () => {
      const checkSpy = vi.spyOn(service, 'check')

      service.startPeriodicChecks(100)
      await new Promise(resolve => setTimeout(resolve, 150))

      service.stopPeriodicChecks()

      const callCount = checkSpy.mock.calls.length
      await new Promise(resolve => setTimeout(resolve, 200))

      expect(checkSpy.mock.calls.length).toBe(callCount)
    })
  })

  describe('event emission', () => {
    it('should emit health check completed event', async () => {
      const eventSpy = vi.fn()
      eventBus.on('health:check:completed', eventSpy)

      await service.check()

      expect(eventSpy).toHaveBeenCalledOnce()
      const callArg = eventSpy.mock.calls[0][0]
      expect(callArg).toHaveProperty('type', 'health:check:completed')
      expect(callArg).toHaveProperty('payload')
      expect(callArg.payload).toHaveProperty('result')
      expect(callArg.payload.result).toHaveProperty('status')
      expect(callArg.payload.result).toHaveProperty('timestamp')
      expect(callArg.payload.result).toHaveProperty('checks')
      expect(callArg.payload.result).toHaveProperty('summary')
    })
  })
})
