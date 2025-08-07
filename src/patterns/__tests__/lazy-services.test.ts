import { beforeEach, describe, expect, it } from 'vitest'

import {
  ConditionalServiceContainer,
  createConditionalServiceContainer,
  createServiceContainer,
  LazyServiceContainer
} from '../lazy-services'

// Test service classes
class TestService1 {
  name = 'service1'
  value = Math.random()
}

class TestService2 {
  name = 'service2'
  value = Math.random()
}

class TestService3 {
  name = 'service3'
  value = Math.random()
}

interface TestServices {
  service1: TestService1
  service2: TestService2
  service3: TestService3
}

describe('LazyServiceContainer', () => {
  let container: LazyServiceContainer<TestServices>
  let factoryCalls: Record<string, number>

  beforeEach(() => {
    container = new LazyServiceContainer()
    factoryCalls = { service1: 0, service2: 0, service3: 0 }

    container.register('service1', () => {
      factoryCalls.service1++
      return new TestService1()
    })

    container.register('service2', () => {
      factoryCalls.service2++
      return new TestService2()
    })

    container.register('service3', () => {
      factoryCalls.service3++
      return new TestService3()
    })
  })

  it('should not create services until requested', () => {
    expect(factoryCalls.service1).toBe(0)
    expect(factoryCalls.service2).toBe(0)
    expect(factoryCalls.service3).toBe(0)
  })

  it('should create service on first access', () => {
    const service1 = container.get('service1')

    expect(factoryCalls.service1).toBe(1)
    expect(factoryCalls.service2).toBe(0)
    expect(service1).toBeInstanceOf(TestService1)
    expect(service1.name).toBe('service1')
  })

  it('should reuse service instance', () => {
    const service1a = container.get('service1')
    const service1b = container.get('service1')

    expect(factoryCalls.service1).toBe(1)
    expect(service1a).toBe(service1b)
    expect(service1a.value).toBe(service1b.value)
  })

  it('should handle multiple services independently', () => {
    const s1 = container.get('service1')
    const s2 = container.get('service2')
    const s3 = container.get('service3')

    expect(factoryCalls.service1).toBe(1)
    expect(factoryCalls.service2).toBe(1)
    expect(factoryCalls.service3).toBe(1)

    expect(s1.name).toBe('service1')
    expect(s2.name).toBe('service2')
    expect(s3.name).toBe('service3')
  })

  it('should throw error for unregistered service', () => {
    const badContainer = new LazyServiceContainer<{ unknown: unknown }>()
    expect(() => badContainer.get('unknown')).toThrow('Service unknown not registered')
  })

  it('should check if service is registered', () => {
    expect(container.has('service1')).toBe(true)
    expect(container.has('service2')).toBe(true)
    expect(container.has('service3')).toBe(true)
    expect(container.has('unknown' as keyof TestServices)).toBe(false)
  })

  it('should check if service is initialized', () => {
    expect(container.isInitialized('service1')).toBe(false)

    container.get('service1')

    expect(container.isInitialized('service1')).toBe(true)
    expect(container.isInitialized('service2')).toBe(false)
  })

  it('should handle reset correctly', () => {
    const service1a = container.get('service1')
    expect(factoryCalls.service1).toBe(1)

    container.reset()
    expect(container.isInitialized('service1')).toBe(false)

    const service1b = container.get('service1')
    expect(factoryCalls.service1).toBe(2)
    expect(service1a).not.toBe(service1b)
  })

  it('should clear specific service', () => {
    container.get('service1')
    container.get('service2')

    expect(container.isInitialized('service1')).toBe(true)
    expect(container.isInitialized('service2')).toBe(true)

    container.clear('service1')

    expect(container.isInitialized('service1')).toBe(false)
    expect(container.isInitialized('service2')).toBe(true)
  })

  it('should provide accurate statistics', () => {
    const stats1 = container.getStats()
    expect(stats1.registered).toEqual(['service1', 'service2', 'service3'])
    expect(stats1.initialized).toEqual([])
    expect(stats1.creationTimes).toEqual({})

    container.get('service1')
    container.get('service3')

    const stats2 = container.getStats()
    expect(stats2.registered).toEqual(['service1', 'service2', 'service3'])
    expect(stats2.initialized).toEqual(['service1', 'service3'])
    expect(stats2.creationTimes.service1).toBeGreaterThanOrEqual(0)
    expect(stats2.creationTimes.service3).toBeGreaterThanOrEqual(0)
    expect(stats2.creationTimes.service2).toBeUndefined()
  })

  it('should handle factory errors gracefully', () => {
    const errorContainer = new LazyServiceContainer<{ failing: unknown }>()
    errorContainer.register('failing', () => {
      throw new Error('Factory error')
    })

    expect(() => errorContainer.get('failing')).toThrow('Factory error')
    expect(errorContainer.isInitialized('failing')).toBe(false)
  })
})

describe('ConditionalServiceContainer', () => {
  let container: ConditionalServiceContainer<TestServices>
  let conditions: Record<string, boolean>

  beforeEach(() => {
    container = new ConditionalServiceContainer()
    conditions = { service1: true, service2: false, service3: true }

    container.registerConditional(
      'service1',
      () => new TestService1(),
      () => conditions.service1
    )

    container.registerConditional(
      'service2',
      () => new TestService2(),
      () => conditions.service2
    )

    container.registerConditional(
      'service3',
      () => new TestService3(),
      async () => {
        // Simulate async condition check
        await new Promise(resolve => setTimeout(resolve, 10))
        return conditions.service3
      }
    )
  })

  it('should return service when condition is true', async () => {
    const service1 = await container.getConditional('service1')
    expect(service1).toBeInstanceOf(TestService1)
  })

  it('should return null when condition is false', async () => {
    const service2 = await container.getConditional('service2')
    expect(service2).toBeNull()
  })

  it('should handle async conditions', async () => {
    const service3 = await container.getConditional('service3')
    expect(service3).toBeInstanceOf(TestService3)

    // The service is cached, but getConditional still checks the condition
    conditions.service3 = false
    const service3Again = await container.getConditional('service3')
    expect(service3Again).toBeNull() // Condition is false, so returns null
  })

  it('should check service availability', async () => {
    expect(await container.isAvailable('service1')).toBe(true)
    expect(await container.isAvailable('service2')).toBe(false)
    expect(await container.isAvailable('service3')).toBe(true)
  })

  it('should use regular get for non-conditional services', () => {
    container.register('regular' as keyof TestServices, () => ({ name: 'regular' }))

    const service = container.get('regular' as keyof TestServices)
    expect(service.name).toBe('regular')
  })

  it('should respect condition changes after reset', async () => {
    const s1 = await container.getConditional('service1')
    expect(s1).toBeInstanceOf(TestService1)

    conditions.service1 = false
    container.reset()

    const s1Again = await container.getConditional('service1')
    expect(s1Again).toBeNull()
  })
})

describe('Factory Functions', () => {
  it('should create typed service container', () => {
    const container = createServiceContainer<TestServices>()

    container.register('service1', () => new TestService1())
    const service = container.get('service1')

    expect(service).toBeInstanceOf(TestService1)
  })

  it('should create typed conditional container', async () => {
    const container = createConditionalServiceContainer<TestServices>()

    container.registerConditional(
      'service1',
      () => new TestService1(),
      () => true
    )

    const service = await container.getConditional('service1')
    expect(service).toBeInstanceOf(TestService1)
  })
})

describe('Performance Characteristics', () => {
  it('should have minimal overhead for lazy initialization', () => {
    const container = new LazyServiceContainer<{ heavy: { data: number[] } }>()
    let initTime = 0

    container.register('heavy', () => {
      const start = Date.now()
      // Simulate heavy initialization
      const data = new Array(1000000).fill(0).map((_, i) => i)
      initTime = Date.now() - start
      return { data }
    })

    // Container creation should be instant
    const stats1 = container.getStats()
    expect(stats1.initialized).toEqual([])

    // Service creation happens on first access
    const service = container.get('heavy')
    expect(service.data.length).toBe(1000000)
    expect(initTime).toBeGreaterThan(0)

    // Subsequent access is instant
    const start = Date.now()
    const service2 = container.get('heavy')
    const accessTime = Date.now() - start

    expect(service2).toBe(service)
    expect(accessTime).toBeLessThan(5) // Should be near instant
  })
})
