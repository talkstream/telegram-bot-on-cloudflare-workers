/**
 * Tests for TierOptimizationService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { TierOptimizationService } from '../tier-optimization-service';
import type {
  IOptimizationStrategy,
  IOptimizationContext,
  IOptimizationConfig,
  IOptimizationUtils,
} from '../../../interfaces/tier-optimization';

describe('TierOptimizationService', () => {
  let service: TierOptimizationService;

  beforeEach(() => {
    service = new TierOptimizationService('free');
  });

  describe('tier management', () => {
    it('should return current tier', () => {
      expect(service.getCurrentTier()).toBe('free');
    });

    it('should return correct limits for free tier', () => {
      const limits = service.getTierLimits();
      expect(limits.cpuTime).toBe(10);
      expect(limits.memory).toBe(128);
      expect(limits.subrequests).toBe(50);
    });

    it('should return correct limits for paid tier', () => {
      service = new TierOptimizationService('paid');
      const limits = service.getTierLimits();
      expect(limits.cpuTime).toBe(30000);
      expect(limits.memory).toBe(128);
      expect(limits.subrequests).toBe(1000);
    });

    it('should return correct limits for enterprise tier', () => {
      service = new TierOptimizationService('enterprise');
      const limits = service.getTierLimits();
      expect(limits.cpuTime).toBe(30000);
      expect(limits.memory).toBe(512);
      expect(limits.subrequests).toBe(5000);
    });
  });

  describe('usage tracking', () => {
    it('should track CPU time', () => {
      service.trackUsage('cpuTime', 5);
      const usage = service.getUsage();
      expect(usage.cpuTime).toBeGreaterThanOrEqual(5);
    });

    it('should track memory usage', () => {
      service.trackUsage('memory', 64);
      const usage = service.getUsage();
      expect(usage.memory).toBe(64);
    });

    it('should track maximum memory usage', () => {
      service.trackUsage('memory', 64);
      service.trackUsage('memory', 32);
      service.trackUsage('memory', 96);
      const usage = service.getUsage();
      expect(usage.memory).toBe(96);
    });

    it('should track operations', () => {
      service.trackOperation('kv', 'read', 10);
      service.trackOperation('kv', 'write', 5);
      service.trackOperation('d1', 'read', 20);

      const usage = service.getUsage();
      expect(usage.kvOperations.read).toBe(10);
      expect(usage.kvOperations.write).toBe(5);
      expect(usage.d1Operations.read).toBe(20);
    });

    it('should reset usage', () => {
      service.trackUsage('cpuTime', 5);
      service.trackUsage('memory', 64);
      service.trackOperation('kv', 'read', 10);

      service.resetUsage();

      const usage = service.getUsage();
      expect(usage.memory).toBe(0);
      expect(usage.kvOperations.read).toBe(0);
    });
  });

  describe('limit checking', () => {
    it('should be within limits initially', () => {
      expect(service.isWithinLimits()).toBe(true);
    });

    it('should detect CPU limit exceeded', () => {
      service.trackUsage('cpuTime', 15); // Free tier limit is 10ms
      expect(service.isWithinLimits()).toBe(false);
    });

    it('should detect memory limit exceeded', () => {
      service.trackUsage('memory', 150); // Free tier limit is 128MB
      expect(service.isWithinLimits()).toBe(false);
    });

    it('should detect KV operation limit exceeded', () => {
      service.trackOperation('kv', 'read', 1500); // Free tier limit is 1000
      expect(service.isWithinLimits()).toBe(false);
    });
  });

  describe('optimization strategies', () => {
    it('should apply strategies based on context', async () => {
      const mockStrategy: IOptimizationStrategy = {
        name: 'test-strategy',
        description: 'Test strategy',
        priority: 10,
        shouldApply: vi.fn().mockReturnValue(true),
        apply: vi.fn(),
      };

      service = new TierOptimizationService('free', {}, { strategies: [mockStrategy] });

      await service.optimize({});

      expect(mockStrategy.shouldApply).toHaveBeenCalled();
      expect(mockStrategy.apply).toHaveBeenCalled();
    });

    it('should skip strategies that should not apply', async () => {
      const mockStrategy: IOptimizationStrategy = {
        name: 'test-strategy',
        description: 'Test strategy',
        priority: 10,
        shouldApply: vi.fn().mockReturnValue(false),
        apply: vi.fn(),
      };

      service = new TierOptimizationService('free', {}, { strategies: [mockStrategy] });

      await service.optimize({});

      expect(mockStrategy.shouldApply).toHaveBeenCalled();
      expect(mockStrategy.apply).not.toHaveBeenCalled();
    });

    it('should handle strategy errors gracefully', async () => {
      const mockStrategy: IOptimizationStrategy = {
        name: 'failing-strategy',
        description: 'Failing strategy',
        priority: 10,
        shouldApply: () => true,
        apply: () => {
          throw new Error('Strategy failed');
        },
      };

      service = new TierOptimizationService('free', {}, { strategies: [mockStrategy] });

      // Should not throw
      await expect(service.optimize({})).resolves.not.toThrow();
    });
  });

  describe('recommendations', () => {
    it('should generate CPU usage recommendations', () => {
      service.trackUsage('cpuTime', 9); // 90% of free tier limit

      const recommendations = service.getRecommendations();
      const cpuRec = recommendations.find((r) => r.category === 'cpu');

      expect(cpuRec).toBeDefined();
      expect(cpuRec?.type).toBe('critical');
      expect(cpuRec?.impact).toBe(9);
    });

    it('should generate memory recommendations', () => {
      service.trackUsage('memory', 110); // >80% of free tier limit

      const recommendations = service.getRecommendations();
      const memRec = recommendations.find((r) => r.category === 'memory');

      expect(memRec).toBeDefined();
      expect(memRec?.type).toBe('warning');
    });

    it('should suggest tier upgrade for free tier', () => {
      service.trackUsage('cpuTime', 6); // >50% for free tier

      const recommendations = service.getRecommendations();
      const upgradeRec = recommendations.find((r) => r.category === 'cost');

      expect(upgradeRec).toBeDefined();
      expect(upgradeRec?.message).toContain('Consider upgrading');
    });

    it('should suggest batching when subrequests are high', () => {
      service = new TierOptimizationService('free', { batching: { enabled: false } });
      service.trackUsage('subrequests', 30); // >50% of free tier limit

      const recommendations = service.getRecommendations();
      const batchRec = recommendations.find((r) => r.category === 'network');

      expect(batchRec).toBeDefined();
      expect(batchRec?.message).toContain('Enable request batching');
    });

    it('should sort recommendations by impact', () => {
      service.trackUsage('cpuTime', 9); // Critical
      service.trackUsage('memory', 110); // Warning

      const recommendations = service.getRecommendations();

      expect(recommendations[0].impact).toBeGreaterThanOrEqual(recommendations[1].impact);
    });
  });

  describe('optimization utilities', () => {
    it('should measure CPU time', async () => {
      const context: IOptimizationContext = {
        tier: 'free',
        limits: service.getTierLimits(),
        usage: service.getUsage(),
        config: {
          enabled: true,
          aggressive: false,
          cache: { enabled: true, ttl: 300, swr: 3600 },
          batching: { enabled: false, size: 10, timeout: 100 },
          compression: { enabled: false, threshold: 1024 },
          queries: { cache: false, batch: false, maxComplexity: 100 },
        } as IOptimizationConfig,
        utils: null as unknown as IOptimizationUtils,
      };

      await service.optimize(context);

      // Utils should be created
      expect(context.utils).toBeDefined();

      const { result, cpuTime } = await context.utils.measureCPU(() => {
        return 'test';
      });

      expect(result).toBe('test');
      expect(cpuTime).toBeGreaterThanOrEqual(0);
    });

    it('should batch operations', async () => {
      const context: IOptimizationContext = {
        tier: 'free',
        limits: service.getTierLimits(),
        usage: service.getUsage(),
        config: {
          enabled: true,
          aggressive: false,
          cache: { enabled: true, ttl: 300, swr: 3600 },
          batching: { enabled: false, size: 10, timeout: 100 },
          compression: { enabled: false, threshold: 1024 },
          queries: { cache: false, batch: false, maxComplexity: 100 },
        } as IOptimizationConfig,
        utils: null as unknown as IOptimizationUtils,
      };

      await service.optimize(context);

      const items = [1, 2, 3, 4, 5];
      const processor = vi
        .fn()
        .mockImplementation((batch) => Promise.resolve(batch.map((n: number) => n * 2)));

      const results = await context.utils.batch(items, processor, 2);

      expect(results).toEqual([2, 4, 6, 8, 10]);
      expect(processor).toHaveBeenCalledTimes(3); // 3 batches: [1,2], [3,4], [5]
    });

    it('should defer tasks', async () => {
      const context: IOptimizationContext = {
        tier: 'free',
        limits: service.getTierLimits(),
        usage: service.getUsage(),
        config: {
          enabled: true,
          aggressive: false,
          cache: { enabled: true, ttl: 300, swr: 3600 },
          batching: { enabled: false, size: 10, timeout: 100 },
          compression: { enabled: false, threshold: 1024 },
          queries: { cache: false, batch: false, maxComplexity: 100 },
        } as IOptimizationConfig,
        utils: null as unknown as IOptimizationUtils,
      };

      await service.optimize(context);

      const deferredFn = vi.fn();
      context.utils.defer(deferredFn);

      // Should not be called immediately
      expect(deferredFn).not.toHaveBeenCalled();

      // Should be called after optimization
      await service.optimize(context);
      expect(deferredFn).toHaveBeenCalled();
    });

    it('should calculate remaining resources', async () => {
      service.trackUsage('cpuTime', 5);
      service.trackUsage('memory', 64);
      service.trackUsage('subrequests', 10);

      const context: IOptimizationContext = {
        tier: 'free',
        limits: service.getTierLimits(),
        usage: service.getUsage(),
        config: {
          enabled: true,
          aggressive: false,
          cache: { enabled: true, ttl: 300, swr: 3600 },
          batching: { enabled: false, size: 10, timeout: 100 },
          compression: { enabled: false, threshold: 1024 },
          queries: { cache: false, batch: false, maxComplexity: 100 },
        } as IOptimizationConfig,
        utils: null as unknown as IOptimizationUtils,
      };

      await service.optimize(context);

      const remaining = context.utils.getRemainingResources();

      expect(remaining.cpuTime).toBeLessThanOrEqual(5); // ~5ms remaining
      expect(remaining.memory).toBe(64); // 64MB remaining
      expect(remaining.subrequests).toBe(40); // 40 remaining
    });
  });
});
