/**
 * Tests for MemoryAnalyticsService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { MemoryAnalyticsService } from '../memory-analytics-service';
import type { IAnalyticsDataPoint } from '../../../interfaces/analytics';

describe('MemoryAnalyticsService', () => {
  let service: MemoryAnalyticsService;

  beforeEach(() => {
    service = new MemoryAnalyticsService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
  });

  describe('write', () => {
    it('should write single data point', async () => {
      const dataPoint: IAnalyticsDataPoint = {
        metric: 'test.metric',
        value: 42,
        dimensions: { env: 'test' },
      };

      await service.write(dataPoint);

      const result = await service.query({
        startTime: new Date(Date.now() - 60000),
        endTime: new Date(Date.now() + 60000),
        metrics: ['test.metric'],
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].values['test.metric']).toBe(42);
    });

    it('should add timestamp if not provided', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      await service.write({
        metric: 'test.metric',
        value: 1,
      });

      const result = await service.query({
        startTime: new Date(now - 1000),
        endTime: new Date(now + 1000),
        metrics: ['test.metric'],
      });

      expect(result.data[0].timestamp).toBe(now);
    });

    it('should validate data points', async () => {
      await expect(
        service.write({
          metric: '',
          value: 1,
        }),
      ).rejects.toThrow('Invalid metric name');

      await expect(
        service.write({
          metric: 'test',
          value: NaN,
        }),
      ).rejects.toThrow('Invalid metric value');
    });
  });

  describe('writeBatch', () => {
    it('should write multiple data points', async () => {
      const dataPoints: IAnalyticsDataPoint[] = [
        { metric: 'metric1', value: 1 },
        { metric: 'metric2', value: 2 },
        { metric: 'metric1', value: 3 },
      ];

      await service.writeBatch(dataPoints);

      const result = await service.query({
        startTime: new Date(Date.now() - 60000),
        endTime: new Date(Date.now() + 60000),
        metrics: ['metric1', 'metric2'],
      });

      expect(result.data).toHaveLength(3);
      expect(result.metadata.totalPoints).toBe(3);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      // Add test data
      const now = Date.now();
      await service.writeBatch([
        { metric: 'api.requests', value: 1, timestamp: now - 5000, dimensions: { status: 200 } },
        { metric: 'api.requests', value: 1, timestamp: now - 4000, dimensions: { status: 404 } },
        { metric: 'api.requests', value: 1, timestamp: now - 3000, dimensions: { status: 200 } },
        { metric: 'api.latency', value: 100, timestamp: now - 5000 },
        { metric: 'api.latency', value: 150, timestamp: now - 3000 },
      ]);
    });

    it('should filter by time range', async () => {
      const now = Date.now();

      const result = await service.query({
        startTime: new Date(now - 4500),
        endTime: new Date(now),
        metrics: ['api.requests'],
      });

      expect(result.data).toHaveLength(2);
    });

    it('should filter by metrics', async () => {
      const now = Date.now();

      const result = await service.query({
        startTime: new Date(now - 10000),
        endTime: new Date(now),
        metrics: ['api.latency'],
      });

      expect(result.data).toHaveLength(2);
      expect(result.data.every((d) => 'api.latency' in d.values)).toBe(true);
    });

    it('should filter by dimensions', async () => {
      const now = Date.now();

      const result = await service.query({
        startTime: new Date(now - 10000),
        endTime: new Date(now),
        metrics: ['api.requests'],
        filters: { status: 200 },
      });

      expect(result.data).toHaveLength(2);
      expect(result.data.every((d) => d.dimensions?.status === 200)).toBe(true);
    });

    it('should support array filters', async () => {
      const now = Date.now();

      const result = await service.query({
        startTime: new Date(now - 10000),
        endTime: new Date(now),
        metrics: ['api.requests'],
        filters: { status: [200, 404] },
      });

      expect(result.data).toHaveLength(3);
    });

    it('should group by time granularity', async () => {
      const now = Date.now();

      const result = await service.query({
        startTime: new Date(now - 10000),
        endTime: new Date(now),
        metrics: ['api.requests'],
        granularity: 'minute',
        aggregation: 'sum',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].values['api.requests']).toBe(3);
    });

    it('should group by dimensions', async () => {
      const now = Date.now();

      const result = await service.query({
        startTime: new Date(now - 10000),
        endTime: new Date(now),
        metrics: ['api.requests'],
        groupBy: ['status'],
        aggregation: 'count',
      });

      expect(result.data).toHaveLength(2);

      const status200 = result.data.find((d) => d.dimensions?.status === '200');
      const status404 = result.data.find((d) => d.dimensions?.status === '404');

      expect(status200?.values['api.requests']).toBe(2);
      expect(status404?.values['api.requests']).toBe(1);
    });
  });

  describe('stream', () => {
    it('should stream real-time data', async () => {
      const received: IAnalyticsDataPoint[] = [];

      const { stop } = service.stream(['test.metric'], (dataPoint) => {
        received.push(dataPoint);
      });

      await service.write({ metric: 'test.metric', value: 1 });
      await service.write({ metric: 'other.metric', value: 2 });
      await service.write({ metric: 'test.metric', value: 3 });

      expect(received).toHaveLength(2);
      expect(received[0].value).toBe(1);
      expect(received[1].value).toBe(3);

      stop();

      await service.write({ metric: 'test.metric', value: 4 });
      expect(received).toHaveLength(2);
    });
  });

  describe('createMetric', () => {
    it('should create custom metric', async () => {
      await service.createMetric('custom.metric', {
        description: 'Test metric',
        unit: 'requests',
        retentionDays: 7,
      });

      const metrics = await service.listMetrics();
      const custom = metrics.find((m) => m.name === 'custom.metric');

      expect(custom).toBeDefined();
      expect(custom?.description).toBe('Test metric');
      expect(custom?.unit).toBe('requests');
    });
  });

  describe('retention', () => {
    it('should apply retention policy', async () => {
      await service.createMetric('temp.metric', {
        retentionDays: 1,
      });

      const now = Date.now();

      await service.writeBatch([
        { metric: 'temp.metric', value: 1, timestamp: now - 2 * 24 * 60 * 60 * 1000 }, // 2 days old
        { metric: 'temp.metric', value: 2, timestamp: now - 12 * 60 * 60 * 1000 }, // 12 hours old
      ]);

      // Trigger retention cleanup
      vi.advanceTimersByTime(60 * 60 * 1000);

      const result = await service.query({
        startTime: new Date(now - 3 * 24 * 60 * 60 * 1000),
        endTime: new Date(now),
        metrics: ['temp.metric'],
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].values['temp.metric']).toBe(2);
    });
  });

  describe('export', () => {
    beforeEach(async () => {
      await service.writeBatch([
        { metric: 'test.metric', value: 1, timestamp: 1000, dimensions: { env: 'prod' } },
        { metric: 'test.metric', value: 2, timestamp: 2000, dimensions: { env: 'dev' } },
      ]);
    });

    it('should export as JSON', async () => {
      const json = await service.export(
        {
          startTime: new Date(0),
          endTime: new Date(3000),
          metrics: ['test.metric'],
        },
        'json',
      );

      const parsed = JSON.parse(json);
      expect(parsed.data).toHaveLength(2);
      expect(parsed.metadata).toBeDefined();
    });

    it('should export as CSV', async () => {
      const csv = await service.export(
        {
          startTime: new Date(0),
          endTime: new Date(3000),
          metrics: ['test.metric'],
          groupBy: ['env'],
        },
        'csv',
      );

      const lines = csv.split('\n');
      expect(lines[0]).toBe('timestamp,test.metric,env');
      expect(lines).toHaveLength(3); // header + 2 data rows
    });
  });

  describe('aggregations', () => {
    beforeEach(async () => {
      await service.writeBatch([
        { metric: 'test', value: 10, timestamp: 1000 },
        { metric: 'test', value: 20, timestamp: 2000 },
        { metric: 'test', value: 30, timestamp: 3000 },
      ]);
    });

    it('should aggregate with sum', async () => {
      const result = await service.query({
        startTime: new Date(0),
        endTime: new Date(4000),
        metrics: ['test'],
        granularity: 'hour',
        aggregation: 'sum',
      });

      expect(result.data[0].values['test']).toBe(60);
    });

    it('should aggregate with avg', async () => {
      const result = await service.query({
        startTime: new Date(0),
        endTime: new Date(4000),
        metrics: ['test'],
        granularity: 'hour',
        aggregation: 'avg',
      });

      expect(result.data[0].values['test']).toBe(20);
    });

    it('should aggregate with min', async () => {
      const result = await service.query({
        startTime: new Date(0),
        endTime: new Date(4000),
        metrics: ['test'],
        granularity: 'hour',
        aggregation: 'min',
      });

      expect(result.data[0].values['test']).toBe(10);
    });

    it('should aggregate with max', async () => {
      const result = await service.query({
        startTime: new Date(0),
        endTime: new Date(4000),
        metrics: ['test'],
        granularity: 'hour',
        aggregation: 'max',
      });

      expect(result.data[0].values['test']).toBe(30);
    });

    it('should aggregate with count', async () => {
      const result = await service.query({
        startTime: new Date(0),
        endTime: new Date(4000),
        metrics: ['test'],
        granularity: 'hour',
        aggregation: 'count',
      });

      expect(result.data[0].values['test']).toBe(3);
    });
  });
});
