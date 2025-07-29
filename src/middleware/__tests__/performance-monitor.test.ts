import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  PerformanceMonitor,
  TrackPerformance,
  getDefaultMonitor,
  resetDefaultMonitor,
} from '../performance-monitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor({
      maxMetricsPerOperation: 5,
      slowOperationThreshold: 100,
      verySlowOperationThreshold: 500,
    });
  });

  describe('Timer', () => {
    it('should measure duration accurately', async () => {
      const timer = monitor.startTimer();

      await new Promise((resolve) => setTimeout(resolve, 50));

      const duration = timer.stop();
      expect(duration).toBeGreaterThanOrEqual(45);
      expect(duration).toBeLessThan(100);
    });

    it('should return same duration on multiple stops', () => {
      const timer = monitor.startTimer();

      const duration1 = timer.stop();
      const duration2 = timer.stop();

      expect(duration1).toBe(duration2);
    });

    it('should track elapsed time before stopping', async () => {
      const timer = monitor.startTimer();

      await new Promise((resolve) => setTimeout(resolve, 30));
      const elapsed1 = timer.elapsed();

      await new Promise((resolve) => setTimeout(resolve, 20));
      const elapsed2 = timer.elapsed();

      expect(elapsed2).toBeGreaterThan(elapsed1);
      expect(elapsed2).toBeGreaterThanOrEqual(45);
    });
  });

  describe('Operation Tracking', () => {
    it('should track successful operations', async () => {
      const result = await monitor.trackOperation(
        'test-operation',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 'success';
        },
        { userId: '123' },
      );

      expect(result).toBe('success');

      const stats = monitor.getStats('test-operation');
      expect(stats).toBeTruthy();
      expect(stats!.count).toBe(1);
      expect(stats!.successCount).toBe(1);
      expect(stats!.errorCount).toBe(0);
    });

    it('should track failed operations', async () => {
      await expect(
        monitor.trackOperation('failing-operation', async () => {
          throw new Error('Test error');
        }),
      ).rejects.toThrow('Test error');

      const stats = monitor.getStats('failing-operation');
      expect(stats!.count).toBe(1);
      expect(stats!.successCount).toBe(0);
      expect(stats!.errorCount).toBe(1);
    });

    it('should track synchronous operations', async () => {
      const result = await monitor.trackOperation('sync-operation', () => 42);

      expect(result).toBe(42);
      const stats = monitor.getStats('sync-operation');
      expect(stats!.count).toBe(1);
    });

    it('should handle slow operations', async () => {
      const logger = {
        warn: vi.fn(),
        error: vi.fn(),
      };

      const slowMonitor = new PerformanceMonitor({
        logger,
        slowOperationThreshold: 50,
        verySlowOperationThreshold: 100,
      });

      // Slow operation
      await slowMonitor.trackOperation('slow-op', async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Slow operation detected',
        expect.objectContaining({
          operation: 'slow-op',
        }),
      );

      // Very slow operation
      await slowMonitor.trackOperation('very-slow-op', async () => {
        await new Promise((resolve) => setTimeout(resolve, 110));
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Very slow operation detected',
        expect.objectContaining({
          operation: 'very-slow-op',
        }),
      );
    });
  });

  describe('Statistics', () => {
    it('should calculate correct statistics', async () => {
      // Track multiple operations with different durations
      const durations = [10, 20, 30, 40, 50];

      for (const duration of durations) {
        await monitor.trackOperation('stats-test', async () => {
          await new Promise((resolve) => setTimeout(resolve, duration));
        });
      }

      const stats = monitor.getStats('stats-test');
      expect(stats).toBeTruthy();
      expect(stats!.count).toBe(5);
      expect(stats!.minDuration).toBeGreaterThanOrEqual(10);
      expect(stats!.maxDuration).toBeGreaterThanOrEqual(50);
      expect(stats!.avgDuration).toBeGreaterThanOrEqual(30);
      expect(stats!.p50).toBeGreaterThanOrEqual(30);
      expect(stats!.p95).toBeGreaterThanOrEqual(50);
    });

    it('should return all stats when no operation specified', async () => {
      await monitor.trackOperation('op1', () => Promise.resolve());
      await monitor.trackOperation('op2', () => Promise.resolve());

      const allStats = monitor.getStats();
      expect(Array.isArray(allStats)).toBe(true);
      expect(allStats).toHaveLength(2);
      expect(allStats!.map((s) => s.operation).sort()).toEqual(['op1', 'op2']);
    });

    it('should return null for non-existent operation', () => {
      const stats = monitor.getStats('non-existent');
      expect(stats).toBeNull();
    });

    it('should respect max metrics limit', async () => {
      // Track more operations than the limit
      for (let i = 0; i < 10; i++) {
        await monitor.trackOperation('limited-op', () => Promise.resolve(i));
      }

      const recentMetrics = monitor.getRecentMetrics('limited-op');
      expect(recentMetrics).toHaveLength(5); // maxMetricsPerOperation = 5
    });
  });

  describe('Metric Management', () => {
    it('should clear metrics for specific operation', async () => {
      await monitor.trackOperation('op1', () => Promise.resolve());
      await monitor.trackOperation('op2', () => Promise.resolve());

      monitor.clear('op1');

      expect(monitor.getStats('op1')).toBeNull();
      expect(monitor.getStats('op2')).toBeTruthy();
    });

    it('should clear all metrics', async () => {
      await monitor.trackOperation('op1', () => Promise.resolve());
      await monitor.trackOperation('op2', () => Promise.resolve());

      monitor.clear();

      expect(monitor.getStats()).toEqual([]);
    });

    it('should export metrics', async () => {
      await monitor.trackOperation('export-test', () => Promise.resolve('data'));

      const exported = monitor.exportMetrics();
      expect(exported).toBeInstanceOf(Map);
      expect(exported.has('export-test')).toBe(true);
      expect(exported.get('export-test')).toHaveLength(1);
    });
  });

  describe('Scoped Monitor', () => {
    it('should prefix operations', async () => {
      const scoped = monitor.scope('api');

      await scoped.trackOperation('users', () => Promise.resolve());

      const stats = monitor.getStats('api.users');
      expect(stats).toBeTruthy();
      expect(stats!.operation).toBe('api.users');
    });

    it('should filter scoped stats', async () => {
      const apiScope = monitor.scope('api');
      const dbScope = monitor.scope('db');

      await apiScope.trackOperation('users', () => Promise.resolve());
      await dbScope.trackOperation('query', () => Promise.resolve());

      const apiStats = apiScope.getStats();
      expect(Array.isArray(apiStats)).toBe(true);
      expect(apiStats).toHaveLength(1);
      expect(apiStats![0].operation).toBe('api.users');
    });
  });

  describe('TrackPerformance Decorator', () => {
    it('should track method performance', async () => {
      // Clear any existing default monitor
      resetDefaultMonitor();

      class TestService {
        @TrackPerformance()
        async fetchData() {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 'data';
        }

        @TrackPerformance('custom-operation')
        async customMethod() {
          return 'custom';
        }
      }

      const service = new TestService();
      const defaultMon = getDefaultMonitor();

      const result = await service.fetchData();
      expect(result).toBe('data');

      const stats = defaultMon.getStats('TestService.fetchData');
      expect(stats).toBeTruthy();
      expect(stats!.count).toBe(1);

      await service.customMethod();
      const customStats = defaultMon.getStats('custom-operation');
      expect(customStats).toBeTruthy();
    });
  });

  describe('Custom Handlers', () => {
    it('should call custom slow operation handler', async () => {
      const slowHandler = vi.fn();

      const customMonitor = new PerformanceMonitor({
        slowOperationThreshold: 50,
        onSlowOperation: slowHandler,
      });

      await customMonitor.trackOperation('slow', async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
      });

      expect(slowHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'slow',
          duration: expect.any(Number),
        }),
      );
    });

    it('should handle errors in custom handler', async () => {
      const logger = { error: vi.fn(), warn: vi.fn() };
      const errorHandler = vi.fn().mockRejectedValue(new Error('Handler error'));

      const customMonitor = new PerformanceMonitor({
        logger,
        slowOperationThreshold: 10,
        onSlowOperation: errorHandler,
      });

      await customMonitor.trackOperation('test', async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });

      // Wait for async error handling
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(logger.error).toHaveBeenCalledWith(
        'Error in slow operation handler',
        expect.any(Object),
      );
    });
  });
});
