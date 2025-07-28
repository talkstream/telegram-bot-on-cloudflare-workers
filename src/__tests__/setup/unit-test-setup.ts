/**
 * Lightweight setup for unit tests
 * Minimal mocks without heavy dependencies
 */
import { afterEach, beforeEach, vi } from 'vitest';

// Set test environment
process.env.NODE_ENV = 'test';

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// Setup before each test
beforeEach(() => {
  vi.useFakeTimers();
});
