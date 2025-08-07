/**
 * EventBus performance tests
 */

/* eslint-disable no-console */

import { beforeEach, describe, expect, it } from 'vitest'

import { EventBus, type Event } from '../../core/events/event-bus'

describe('EventBus Performance', () => {
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = new EventBus({ async: false, debug: false })
  })

  it('should handle high-frequency events efficiently', async () => {
    const eventCount = 10000
    const receivedEvents: Event[] = []

    // Subscribe to events
    eventBus.on('test:event', event => {
      receivedEvents.push(event)
    })

    const startTime = performance.now()

    // Emit many events
    for (let i = 0; i < eventCount; i++) {
      eventBus.emit('test:event', { index: i }, 'performance-test')
    }

    const endTime = performance.now()
    const duration = endTime - startTime

    expect(receivedEvents).toHaveLength(eventCount)
    expect(duration).toBeLessThan(1000) // Should process 10k events in less than 1 second

    console.log(`Processed ${eventCount} events in ${duration.toFixed(2)}ms`)
    console.log(`Average: ${(duration / eventCount).toFixed(3)}ms per event`)
  })

  it('should handle multiple subscribers efficiently', () => {
    const subscriberCount = 100
    const eventCount = 1000
    const counters = new Map<number, number>()

    // Create many subscribers
    for (let i = 0; i < subscriberCount; i++) {
      counters.set(i, 0)
      eventBus.on('test:broadcast', () => {
        counters.set(i, (counters.get(i) || 0) + 1)
      })
    }

    const startTime = performance.now()

    // Emit events
    for (let i = 0; i < eventCount; i++) {
      eventBus.emit('test:broadcast', { index: i }, 'broadcast-test')
    }

    const endTime = performance.now()
    const duration = endTime - startTime

    // Verify all subscribers received all events
    counters.forEach(count => {
      expect(count).toBe(eventCount)
    })

    const totalOperations = subscriberCount * eventCount
    console.log(`Processed ${totalOperations} operations in ${duration.toFixed(2)}ms`)
    console.log(`Average: ${(duration / totalOperations).toFixed(3)}ms per operation`)
  })

  it('should maintain performance with event history', () => {
    const eventCount = 5000

    const startTime = performance.now()

    // Emit many events (history will be maintained)
    for (let i = 0; i < eventCount; i++) {
      eventBus.emit('test:history', { index: i }, 'history-test', { timestamp: Date.now() })
    }

    const endTime = performance.now()
    const emitDuration = endTime - startTime

    // Test history retrieval performance
    const historyStartTime = performance.now()
    const history = eventBus.getHistory({ type: 'test:history', limit: 100 })
    const historyEndTime = performance.now()
    const historyDuration = historyEndTime - historyStartTime

    expect(history).toHaveLength(100)
    expect(emitDuration).toBeLessThan(500) // Emit should be fast
    expect(historyDuration).toBeLessThan(10) // History retrieval should be very fast

    console.log(`Emit duration: ${emitDuration.toFixed(2)}ms`)
    console.log(`History retrieval: ${historyDuration.toFixed(2)}ms`)
  })

  it('should handle wildcard listeners efficiently', () => {
    const eventTypes = ['user:login', 'user:logout', 'user:update', 'user:delete']
    const eventsPerType = 1000
    let wildcardCounter = 0
    const typeCounters = new Map<string, number>()

    // Wildcard listener
    eventBus.onAny(() => {
      wildcardCounter++
    })

    // Type-specific listeners
    eventTypes.forEach(type => {
      typeCounters.set(type, 0)
      eventBus.on(type, () => {
        typeCounters.set(type, (typeCounters.get(type) || 0) + 1)
      })
    })

    const startTime = performance.now()

    // Emit events
    eventTypes.forEach(type => {
      for (let i = 0; i < eventsPerType; i++) {
        eventBus.emit(type, { index: i }, 'wildcard-test')
      }
    })

    const endTime = performance.now()
    const duration = endTime - startTime

    expect(wildcardCounter).toBe(eventTypes.length * eventsPerType)
    eventTypes.forEach(type => {
      expect(typeCounters.get(type)).toBe(eventsPerType)
    })

    console.log(
      `Processed ${wildcardCounter} events across ${eventTypes.length} types in ${duration.toFixed(2)}ms`
    )
  })

  it('should handle scoped event buses efficiently', () => {
    const scopedBus = eventBus.scope('module')
    const eventCount = 1000
    let counter = 0

    scopedBus.on('action', () => {
      counter++
    })

    const startTime = performance.now()

    for (let i = 0; i < eventCount; i++) {
      scopedBus.emit('action', { index: i }, 'scoped-test')
    }

    const endTime = performance.now()
    const duration = endTime - startTime

    expect(counter).toBe(eventCount)
    expect(duration).toBeLessThan(100)

    console.log(`Scoped events: ${duration.toFixed(2)}ms for ${eventCount} events`)
  })

  it('should measure async vs sync performance', async () => {
    const eventCount = 1000

    // Test sync performance
    const syncBus = new EventBus({ async: false })
    let syncCounter = 0

    syncBus.on('test', () => {
      syncCounter++
    })

    const syncStartTime = performance.now()
    for (let i = 0; i < eventCount; i++) {
      syncBus.emit('test', { index: i }, 'sync-test')
    }
    const syncEndTime = performance.now()
    const syncDuration = syncEndTime - syncStartTime

    // Test async performance
    const asyncBus = new EventBus({ async: true })
    let asyncCounter = 0

    asyncBus.on('test', () => {
      asyncCounter++
    })

    const asyncStartTime = performance.now()
    for (let i = 0; i < eventCount; i++) {
      asyncBus.emit('test', { index: i }, 'async-test')
    }
    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 100))
    const asyncEndTime = performance.now()
    const asyncDuration = asyncEndTime - asyncStartTime

    expect(syncCounter).toBe(eventCount)
    expect(asyncCounter).toBe(eventCount)

    console.log(`Sync: ${syncDuration.toFixed(2)}ms, Async: ${asyncDuration.toFixed(2)}ms`)
    console.log(
      `Sync is ${(asyncDuration / syncDuration).toFixed(2)}x faster for immediate processing`
    )
  })
})
