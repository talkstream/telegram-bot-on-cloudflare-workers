import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import type { IMetric, IMonitoringProvider } from '../../interfaces/performance';
import {
  PerformanceMonitor,
  ConsoleMonitoringProvider,
  CloudflareAnalyticsProvider,
  StatsDProvider,
} from '../performance-monitor';

// Mock monitoring provider
class MockProvider implements IMonitoringProvider {
  name = 'mock';
  sentMetrics: IMetric[] = [];
  available = true;

  async send(metrics: IMetric[]): Promise<void> {
    this.sentMetrics.push(...metrics);
  }

  isAvailable(): boolean {
    return this.available;
  }
}

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  let mockProvider: MockProvider;

  beforeEach(() => {
    vi.useFakeTimers();
    mockProvider = new MockProvider();
    monitor = new PerformanceMonitor({
      providers: [mockProvider],
      flushInterval: 1000,
      maxBufferSize: 10,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('metric recording', () => {
    it('should record counter metrics', () => {
      monitor.increment('test.counter', 1, { env: 'test' });
      monitor.increment('test.counter', 2);

      expect(mockProvider.sentMetrics).toHaveLength(0);
    });

    it('should record gauge metrics', () => {
      monitor.gauge('test.gauge', 42, { env: 'test' });

      expect(mockProvider.sentMetrics).toHaveLength(0);
    });

    it('should record timing metrics', () => {
      monitor.timing('test.timing', 123, { env: 'test' });

      expect(mockProvider.sentMetrics).toHaveLength(0);
    });

    it('should record histogram metrics', () => {
      monitor.histogram('test.histogram', 999, { env: 'test' });

      expect(mockProvider.sentMetrics).toHaveLength(0);
    });
  });

  describe('timer functionality', () => {
    it('should measure elapsed time', async () => {
      const timer = monitor.startTimer('test.timer');

      vi.advanceTimersByTime(50);
      const elapsed = timer.elapsed();

      expect(elapsed).toBeGreaterThanOrEqual(50);
      expect(elapsed).toBeLessThan(100);
    });

    it('should record timing when ended', async () => {
      const timer = monitor.startTimer('test.timer', { env: 'test' });

      vi.advanceTimersByTime(100);
      const duration = timer.end({ status: 'success' });

      expect(duration).toBe(100);

      await monitor.flush();

      const timingMetric = mockProvider.sentMetrics.find(
        (m) => m.name === 'test.timer' && m.type === 'timing',
      );

      expect(timingMetric).toBeDefined();
      expect(timingMetric?.value).toBe(100);
      expect(timingMetric?.tags).toEqual({ env: 'test', status: 'success' });
    });

    it('should only record timing once', async () => {
      const timer = monitor.startTimer('test.timer');

      timer.end();
      timer.end(); // Second call should be ignored

      await monitor.flush();

      const timingMetrics = mockProvider.sentMetrics.filter((m) => m.name === 'test.timer');

      expect(timingMetrics).toHaveLength(1);
    });
  });

  describe('flushing', () => {
    it('should flush metrics manually', async () => {
      monitor.increment('test.counter', 1);
      monitor.gauge('test.gauge', 42);

      await monitor.flush();

      expect(mockProvider.sentMetrics).toHaveLength(2);
      expect(mockProvider.sentMetrics[0]).toMatchObject({
        name: 'test.counter',
        type: 'counter',
        value: 1,
      });
      expect(mockProvider.sentMetrics[1]).toMatchObject({
        name: 'test.gauge',
        type: 'gauge',
        value: 42,
      });
    });

    it('should auto-flush when buffer is full', async () => {
      // Create a monitor without auto-flush interval
      const localMonitor = new PerformanceMonitor({
        providers: [mockProvider],
        flushInterval: 0, // Disable interval-based flushing
        maxBufferSize: 10,
      });

      // maxBufferSize is 10
      for (let i = 0; i < 10; i++) {
        localMonitor.increment('test.counter', i);
      }

      // Give time for the auto-flush promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockProvider.sentMetrics).toHaveLength(10);
    });

    it('should auto-flush on interval', async () => {
      monitor.increment('test.counter', 1);

      // Advance time to trigger interval flush
      vi.advanceTimersByTime(1000);

      // Give time for the flush promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockProvider.sentMetrics).toHaveLength(1);
    });

    it('should not send to unavailable providers', async () => {
      mockProvider.available = false;
      monitor.increment('test.counter', 1);

      await monitor.flush();

      expect(mockProvider.sentMetrics).toHaveLength(0);
    });
  });

  describe('default tags', () => {
    it('should apply default tags to all metrics', async () => {
      monitor = new PerformanceMonitor({
        providers: [mockProvider],
        defaultTags: { app: 'test-app', version: '1.0.0' },
      });

      monitor.increment('test.counter', 1, { env: 'test' });
      monitor.gauge('test.gauge', 42);

      await monitor.flush();

      expect(mockProvider.sentMetrics[0].tags).toEqual({
        app: 'test-app',
        version: '1.0.0',
        env: 'test',
      });

      expect(mockProvider.sentMetrics[1].tags).toEqual({
        app: 'test-app',
        version: '1.0.0',
      });
    });
  });

  describe('stop functionality', () => {
    it('should stop auto-flush and flush remaining metrics', async () => {
      monitor.increment('test.counter', 1);

      await monitor.stop();

      expect(mockProvider.sentMetrics).toHaveLength(1);

      // Add more metrics after stop
      monitor.increment('test.counter', 2);

      // Advance time - should not trigger auto-flush
      vi.advanceTimersByTime(2000);

      // Should still only have the first metric
      expect(mockProvider.sentMetrics).toHaveLength(1);
    });
  });
});

describe('ConsoleMonitoringProvider', () => {
  it('should log metrics to console', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const provider = new ConsoleMonitoringProvider();

    const metrics: IMetric[] = [{ name: 'test.metric', type: 'counter', value: 1 }];

    await provider.send(metrics);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[ConsoleMonitoringProvider] Metrics:',
      expect.any(String),
    );

    consoleSpy.mockRestore();
  });

  it('should always be available', () => {
    const provider = new ConsoleMonitoringProvider();
    expect(provider.isAvailable()).toBe(true);
  });
});

describe('CloudflareAnalyticsProvider', () => {
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should send metrics to Cloudflare Analytics Engine', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      statusText: 'OK',
    });

    const provider = new CloudflareAnalyticsProvider('account123', 'token123', 'metrics');

    const metrics: IMetric[] = [
      {
        name: 'test.metric',
        type: 'counter',
        value: 1,
        tags: { env: 'test' },
        timestamp: 1234567890,
      },
    ];

    await provider.send(metrics);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/account123/analytics_engine/sql',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataset: 'metrics',
          data: [
            {
              timestamp: 1234567890,
              metric_name: 'test.metric',
              metric_type: 'counter',
              metric_value: 1,
              env: 'test',
            },
          ],
        }),
      },
    );
  });

  it('should throw error on failed request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
    });

    const provider = new CloudflareAnalyticsProvider('account123', 'token123', 'metrics');

    await expect(provider.send([])).rejects.toThrow(
      'Failed to send metrics to Cloudflare: Bad Request',
    );
  });

  it('should be available when configured', () => {
    const provider = new CloudflareAnalyticsProvider('account123', 'token123', 'metrics');
    expect(provider.isAvailable()).toBe(true);
  });

  it('should not be available when missing config', () => {
    const provider = new CloudflareAnalyticsProvider('', '', '');
    expect(provider.isAvailable()).toBe(false);
  });
});

describe('StatsDProvider', () => {
  it('should format metrics in StatsD format', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const provider = new StatsDProvider('localhost', 8125, 'myapp');

    const metrics: IMetric[] = [
      { name: 'counter', type: 'counter', value: 5, tags: { env: 'test' } },
      { name: 'gauge', type: 'gauge', value: 42 },
      { name: 'timing', type: 'timing', value: 123, tags: { route: '/api' } },
      { name: 'histogram', type: 'histogram', value: 999 },
    ];

    await provider.send(metrics);

    expect(consoleSpy).toHaveBeenCalledWith('[StatsDProvider] Would send metrics:', [
      'myapp.counter:5|c|#env:test',
      'myapp.gauge:42|g',
      'myapp.timing:123|ms|#route:/api',
      'myapp.histogram:999|h',
    ]);

    consoleSpy.mockRestore();
  });

  it('should work without prefix', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const provider = new StatsDProvider('localhost', 8125);

    const metrics: IMetric[] = [{ name: 'test.metric', type: 'counter', value: 1 }];

    await provider.send(metrics);

    expect(consoleSpy).toHaveBeenCalledWith('[StatsDProvider] Would send metrics:', [
      'test.metric:1|c',
    ]);

    consoleSpy.mockRestore();
  });

  it('should be available when configured', () => {
    const provider = new StatsDProvider('localhost', 8125);
    expect(provider.isAvailable()).toBe(true);
  });
});
