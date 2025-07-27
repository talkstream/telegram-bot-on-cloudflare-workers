/**
 * Global test cleanup utilities for Vitest
 *
 * This module provides centralized cleanup functions to prevent memory leaks
 * and ensure proper test isolation in the Wireframe test suite.
 */

import { vi, afterEach } from 'vitest';

import { globalEventBus } from '@/core/events/event-bus';
import { resetServices } from '@/core/services/service-container';

// Track all EventBus instances created during tests
const eventBusInstances = new Set<{ destroy: () => void }>();

/**
 * Register an EventBus instance for cleanup
 */
export function registerEventBus(instance: { destroy: () => void }): void {
  eventBusInstances.add(instance);
}

/**
 * Clean up all registered EventBus instances
 */
export function cleanupEventBuses(): void {
  // Destroy all tracked instances
  eventBusInstances.forEach((instance) => {
    try {
      instance.destroy();
    } catch (error) {
      console.warn('Failed to destroy EventBus instance:', error);
    }
  });
  eventBusInstances.clear();

  // Clean up global instance
  try {
    globalEventBus.destroy();
  } catch (error) {
    console.warn('Failed to destroy global EventBus:', error);
  }
}

/**
 * Complete test cleanup routine
 */
export function cleanupTest(): void {
  // Clean up all EventBus instances
  cleanupEventBuses();

  // Reset service container
  resetServices();

  // Clear all mocks
  vi.clearAllMocks();

  // Clear all timers
  vi.clearAllTimers();

  // Restore all mocks
  vi.restoreAllMocks();

  // Force garbage collection if available (V8)
  if (global.gc) {
    global.gc();
  }
}

/**
 * Setup global test hooks for automatic cleanup
 */
export function setupGlobalTestCleanup(): void {
  // Clean up after each test
  afterEach(() => {
    cleanupTest();
  });
}

/**
 * Create a test EventBus instance with automatic cleanup
 */
export async function createTestEventBus(options = {}): Promise<any> {
  const { EventBus } = await import('@/core/events/event-bus');
  const instance = new EventBus({
    ...options,
    enableHistory: false, // Disable history in tests
    debug: false, // Disable debug logging in tests
  });
  registerEventBus(instance);
  return instance;
}
