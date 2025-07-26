import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';

import type { IPerformanceMonitor, IMetric } from '../../core/interfaces/performance';
import { performanceMonitoring, metricsEndpoint } from '../performance';

// Mock performance monitor
class MockPerformanceMonitor implements IPerformanceMonitor {
  metrics: Array<{ method: string; args: unknown[] }> = [];
  timers: Map<string, { name: string; tags?: Record<string, string> }> = new Map();

  startTimer(name: string, tags?: Record<string, string>) {
    const timerId = Math.random().toString();
    this.timers.set(timerId, { name, tags });
    this.metrics.push({ method: 'startTimer', args: [name, tags] });

    return {
      end: (additionalTags?: Record<string, string>) => {
        const timer = this.timers.get(timerId);
        if (timer) {
          this.metrics.push({
            method: 'timing',
            args: [timer.name, 100, { ...timer.tags, ...additionalTags }],
          });
        }
        return 100;
      },
      elapsed: () => 50,
    };
  }

  recordMetric(metric: IMetric): void {
    this.metrics.push({ method: 'recordMetric', args: [metric] });
  }

  increment(name: string, value?: number, tags?: Record<string, string>): void {
    this.metrics.push({ method: 'increment', args: [name, value, tags] });
  }

  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics.push({ method: 'gauge', args: [name, value, tags] });
  }

  timing(name: string, duration: number, tags?: Record<string, string>): void {
    this.metrics.push({ method: 'timing', args: [name, duration, tags] });
  }

  histogram(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics.push({ method: 'histogram', args: [name, value, tags] });
  }

  async flush(): Promise<void> {
    this.metrics.push({ method: 'flush', args: [] });
  }
}

describe('performanceMonitoring middleware', () => {
  let app: Hono;
  let mockMonitor: MockPerformanceMonitor;

  beforeEach(() => {
    app = new Hono();
    mockMonitor = new MockPerformanceMonitor();
  });

  it('should track basic request metrics', async () => {
    app.use('*', performanceMonitoring({ monitor: mockMonitor }));
    app.get('/test', (c) => c.json({ success: true }));

    const res = await app.request('/test');

    expect(res.status).toBe(200);

    // Check that timer was started
    const startTimerCall = mockMonitor.metrics.find((m) => m.method === 'startTimer');
    expect(startTimerCall).toBeDefined();
    expect(startTimerCall?.args[0]).toBe('http.request.duration');

    // Check that counter was incremented
    const incrementCall = mockMonitor.metrics.find(
      (m) => m.method === 'increment' && m.args[0] === 'http.request.count',
    );
    expect(incrementCall).toBeDefined();
    expect(incrementCall?.args[1]).toBe(1);

    // Check that timing was recorded
    const timingCall = mockMonitor.metrics.find((m) => m.method === 'timing');
    expect(timingCall).toBeDefined();
    expect(timingCall?.args[0]).toBe('http.request.duration');
    expect(timingCall?.args[2]).toMatchObject({
      method: 'GET',
      status: '200',
      status_group: '2xx',
    });

    // Check status counter
    const statusCall = mockMonitor.metrics.find(
      (m) => m.method === 'increment' && m.args[0] === 'http.request.status.200',
    );
    expect(statusCall).toBeDefined();
  });

  it('should skip monitoring for excluded paths', async () => {
    app.use('*', performanceMonitoring({ monitor: mockMonitor }));
    app.get('/health', (c) => c.text('OK'));

    await app.request('/health');

    expect(mockMonitor.metrics).toHaveLength(0);
  });

  it('should use custom skip paths', async () => {
    app.use(
      '*',
      performanceMonitoring({
        monitor: mockMonitor,
        skipPaths: ['/internal'],
      }),
    );
    app.get('/internal/status', (c) => c.text('OK'));

    await app.request('/internal/status');

    expect(mockMonitor.metrics).toHaveLength(0);
  });

  it('should track error metrics', async () => {
    // Setup error handler first
    app.onError((err, c) => {
      return c.text('Error', 500);
    });

    app.use('*', performanceMonitoring({ monitor: mockMonitor }));
    app.get('/error', () => {
      throw new Error('Test error');
    });

    const res = await app.request('/error');
    expect(res.status).toBe(500);

    // Check error increment
    const errorCall = mockMonitor.metrics.find(
      (m) => m.method === 'increment' && m.args[0] === 'http.request.error',
    );
    expect(errorCall).toBeDefined();

    // Check 500 status increment
    const status500Call = mockMonitor.metrics.find(
      (m) => m.method === 'increment' && m.args[0] === 'http.request.status.500',
    );
    expect(status500Call).toBeDefined();

    // Check timing with error tags
    const timingCall = mockMonitor.metrics.find((m) => m.method === 'timing');
    expect(timingCall?.args[2]).toMatchObject({
      status: '500',
      status_group: '5xx',
    });
  });

  it('should use custom metric name generator', async () => {
    app.use(
      '*',
      performanceMonitoring({
        monitor: mockMonitor,
        metricNameGenerator: (c) => `api.${c.req.method.toLowerCase()}`,
      }),
    );
    app.post('/users', (c) => c.json({ created: true }));

    await app.request('/users', { method: 'POST' });

    const timerCall = mockMonitor.metrics.find((m) => m.method === 'startTimer');
    expect(timerCall?.args[0]).toBe('api.post.duration');

    const countCall = mockMonitor.metrics.find(
      (m) => m.method === 'increment' && (m.args[0] as string).includes('count'),
    );
    expect(countCall?.args[0]).toBe('api.post.count');
  });

  it('should use custom tag generator', async () => {
    app.use(
      '*',
      performanceMonitoring({
        monitor: mockMonitor,
        tagGenerator: (_c) => ({
          custom: 'tag',
          env: 'test',
        }),
      }),
    );
    app.get('/test', (c) => c.text('OK'));

    await app.request('/test');

    const incrementCall = mockMonitor.metrics.find(
      (m) => m.method === 'increment' && m.args[0] === 'http.request.count',
    );
    expect(incrementCall?.args[2]).toEqual({
      custom: 'tag',
      env: 'test',
    });
  });

  it('should respect sample rate', async () => {
    // Mock Math.random to control sampling
    const randomSpy = vi.spyOn(Math, 'random');

    app.use(
      '*',
      performanceMonitoring({
        monitor: mockMonitor,
        sampleRate: 0.5,
      }),
    );
    app.get('/test', (c) => c.text('OK'));

    // Should track (random < 0.5)
    randomSpy.mockReturnValue(0.3);
    await app.request('/test');
    const metricsCount = mockMonitor.metrics.length;
    expect(metricsCount).toBeGreaterThan(0);

    // Should skip (random > 0.5)
    mockMonitor.metrics = [];
    randomSpy.mockReturnValue(0.7);
    await app.request('/test');
    expect(mockMonitor.metrics).toHaveLength(0);

    randomSpy.mockRestore();
  });

  describe('detailed metrics', () => {
    beforeEach(() => {
      app.use(
        '*',
        performanceMonitoring({
          monitor: mockMonitor,
          detailed: true,
        }),
      );
    });

    it('should track response size', async () => {
      app.get('/data', (c) => {
        c.header('content-length', '1024');
        return c.json({ data: 'x'.repeat(1000) });
      });

      await app.request('/data');

      const histogramCall = mockMonitor.metrics.find(
        (m) => m.method === 'histogram' && m.args[0] === 'http.request.response_size',
      );
      expect(histogramCall).toBeDefined();
      expect(histogramCall?.args[1]).toBe(1024);
    });

    it('should track request size', async () => {
      app.post('/upload', (c) => c.text('OK'));

      await app.request('/upload', {
        method: 'POST',
        headers: { 'content-length': '2048' },
        body: 'x'.repeat(2048),
      });

      const histogramCall = mockMonitor.metrics.find(
        (m) => m.method === 'histogram' && m.args[0] === 'http.request.request_size',
      );
      expect(histogramCall).toBeDefined();
      expect(histogramCall?.args[1]).toBe(2048);
    });

    it('should track user agent', async () => {
      app.get('/test', (c) => c.text('OK'));

      await app.request('/test', {
        headers: { 'user-agent': 'Mozilla/5.0 Chrome/91.0' },
      });

      const uaCall = mockMonitor.metrics.find(
        (m) => m.method === 'increment' && m.args[0] === 'http.request.user_agent',
      );
      expect(uaCall).toBeDefined();
      expect(uaCall?.args[2]).toMatchObject({
        user_agent: 'chrome',
      });
    });

    it('should track latency buckets', async () => {
      app.get('/test', (c) => c.text('OK'));

      await app.request('/test');

      const bucketCall = mockMonitor.metrics.find(
        (m) => m.method === 'increment' && (m.args[0] as string).includes('latency_bucket'),
      );
      expect(bucketCall).toBeDefined();
      // Mock timer returns 100ms, which falls in 100-250ms bucket
      expect(bucketCall?.args[0]).toBe('http.request.latency_bucket.100-250ms');
    });
  });
});

describe('metricsEndpoint', () => {
  it('should return metrics data', async () => {
    const mockMonitor = new MockPerformanceMonitor();
    const app = new Hono();

    app.get('/metrics', metricsEndpoint(mockMonitor));

    const res = await app.request('/metrics');
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({
      status: 'ok',
      timestamp: expect.any(Number),
    });

    // Check that flush was called
    const flushCall = mockMonitor.metrics.find((m) => m.method === 'flush');
    expect(flushCall).toBeDefined();
  });

  it('should include environment info', async () => {
    const mockMonitor = new MockPerformanceMonitor();
    const app = new Hono<{ Bindings: { ENVIRONMENT: string } }>();

    app.get('/metrics', metricsEndpoint(mockMonitor));

    const res = await app.request('/metrics', {}, {
      ENVIRONMENT: 'production',
    } as { ENVIRONMENT: string });
    const data = await res.json();

    expect(data.env).toMatchObject({
      WORKER_ENV: 'production',
    });
  });
});

describe('user agent parsing', () => {
  let app: Hono;
  let mockMonitor: MockPerformanceMonitor;

  beforeEach(() => {
    app = new Hono();
    mockMonitor = new MockPerformanceMonitor();
    app.use(
      '*',
      performanceMonitoring({
        monitor: mockMonitor,
        detailed: true,
      }),
    );
    app.get('/test', (c) => c.text('OK'));
  });

  const testCases = [
    { ua: 'Mozilla/5.0 Chrome/91.0', expected: 'chrome' },
    { ua: 'Mozilla/5.0 Firefox/89.0', expected: 'firefox' },
    { ua: 'Mozilla/5.0 Safari/14.0', expected: 'safari' },
    { ua: 'Mozilla/5.0 Edge/91.0', expected: 'edge' },
    { ua: 'Googlebot/2.1', expected: 'bot' },
    { ua: 'curl/7.77.0', expected: 'curl' },
    { ua: 'PostmanRuntime/7.28.0', expected: 'postman' },
    { ua: 'Unknown Browser', expected: 'other' },
  ];

  testCases.forEach(({ ua, expected }) => {
    it(`should parse ${expected} user agent`, async () => {
      await app.request('/test', {
        headers: { 'user-agent': ua },
      });

      const uaCall = mockMonitor.metrics.find(
        (m) => m.method === 'increment' && m.args[0] === 'http.request.user_agent',
      );
      expect(uaCall?.args[2]?.user_agent).toBe(expected);
    });
  });
});
