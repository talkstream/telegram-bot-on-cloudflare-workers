/**
 * In-memory analytics implementation for testing
 */

import type {
  IAnalyticsDataPoint,
  IAnalyticsQueryOptions,
  IAnalyticsResult,
  IAnalyticsBatchOptions,
  IAdvancedAnalyticsService,
  IMetricConfig,
  IMetricInfo,
} from '../../interfaces/analytics';
import type { EventBus } from '../../events/event-bus';

import { BaseAnalyticsService } from './base-analytics-service';

/**
 * In-memory analytics service for testing
 */
export class MemoryAnalyticsService
  extends BaseAnalyticsService
  implements IAdvancedAnalyticsService
{
  private dataPoints: IAnalyticsDataPoint[] = [];
  private metrics = new Map<string, IMetricConfig & { firstSeen: number; lastSeen: number }>();
  private streamCallbacks = new Map<string, Set<(dataPoint: IAnalyticsDataPoint) => void>>();
  private retentionTimer?: NodeJS.Timeout;

  constructor(options?: IAnalyticsBatchOptions, eventBus?: EventBus) {
    super(options, eventBus);

    // Start retention cleanup
    this.startRetentionCleanup();
  }

  /**
   * Write data points to memory
   */
  protected async doWrite(dataPoints: IAnalyticsDataPoint[]): Promise<void> {
    for (const point of dataPoints) {
      // Store data point
      this.dataPoints.push(point);

      // Update metric info
      this.updateMetricInfo(point);

      // Trigger streams
      this.triggerStreams(point);

      // Apply retention
      this.applyRetention(point.metric);
    }
  }

  /**
   * Override write to handle immediate storage
   */
  override async write(dataPoint: IAnalyticsDataPoint): Promise<void> {
    await super.write(dataPoint);

    // For memory service, immediately flush single writes for testing
    if (this.batchQueue.length === 1) {
      await this.flush();
    }
  }

  /**
   * Query analytics data
   */
  async query(options: IAnalyticsQueryOptions): Promise<IAnalyticsResult> {
    const startTime = Date.now();

    try {
      // Filter data points
      let filtered = this.dataPoints.filter((point) => {
        // Time range filter
        if (
          point.timestamp! < options.startTime.getTime() ||
          point.timestamp! >= options.endTime.getTime()
        ) {
          return false;
        }

        // Metric filter
        if (!options.metrics.includes(point.metric)) {
          return false;
        }

        // Dimension filters
        if (options.filters) {
          for (const [key, value] of Object.entries(options.filters)) {
            const pointValue = point.dimensions?.[key];

            if (Array.isArray(value)) {
              if (pointValue === undefined) {
                return false;
              }
              // Convert both values to strings for comparison
              const stringValue = String(pointValue);
              const stringArray = value.map((v) => String(v));
              if (!stringArray.includes(stringValue)) {
                return false;
              }
            } else if (pointValue !== value) {
              return false;
            }
          }
        }

        return true;
      });

      // Sort by timestamp
      filtered.sort((a, b) => a.timestamp! - b.timestamp!);

      // Group by time and dimensions
      const grouped = this.groupDataPoints(filtered, options);

      // Build result
      const result: IAnalyticsResult = {
        data: grouped,
        metadata: {
          startTime: options.startTime.getTime(),
          endTime: options.endTime.getTime(),
          granularity: options.granularity,
          totalPoints: filtered.length,
        },
      };

      // Emit success event
      this.emitEvent({
        type: 'analytics:query:success',
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        count: result.data.length,
      });

      return result;
    } catch (error) {
      // Emit error event
      this.emitEvent({
        type: 'analytics:query:error',
        timestamp: Date.now(),
        error: error as Error,
      });

      throw error;
    }
  }

  /**
   * Real-time streaming
   */
  stream(
    metrics: string[],
    callback: (dataPoint: IAnalyticsDataPoint) => void,
  ): { stop: () => void } {
    // Register callback for each metric
    for (const metric of metrics) {
      const callbacks = this.streamCallbacks.get(metric) || new Set();
      callbacks.add(callback);
      this.streamCallbacks.set(metric, callbacks);
    }

    // Return stop function
    return {
      stop: () => {
        for (const metric of metrics) {
          const callbacks = this.streamCallbacks.get(metric);
          if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
              this.streamCallbacks.delete(metric);
            }
          }
        }
      },
    };
  }

  /**
   * Create custom metric
   */
  async createMetric(name: string, config: IMetricConfig): Promise<void> {
    this.metrics.set(name, {
      ...config,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    });
  }

  /**
   * Delete old data
   */
  async deleteData(metric: string, beforeDate: Date): Promise<void> {
    const beforeTime = beforeDate.getTime();
    this.dataPoints = this.dataPoints.filter(
      (point) => point.metric !== metric || point.timestamp! >= beforeTime,
    );
  }

  /**
   * Export data
   */
  async export(options: IAnalyticsQueryOptions, format: 'csv' | 'json'): Promise<string> {
    const result = await this.query(options);

    if (format === 'json') {
      return JSON.stringify(result, null, 2);
    }

    // CSV export
    const headers = ['timestamp', ...options.metrics];
    if (options.groupBy) {
      headers.push(...options.groupBy);
    }

    const rows = [headers.join(',')];

    for (const point of result.data) {
      const row: (string | number)[] = [point.timestamp];

      for (const metric of options.metrics) {
        row.push(point.values[metric] || 0);
      }

      if (options.groupBy && point.dimensions) {
        for (const dim of options.groupBy) {
          const dimValue = point.dimensions[dim];
          row.push(dimValue !== undefined ? String(dimValue) : '');
        }
      }

      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * List available metrics
   */
  async listMetrics(): Promise<IMetricInfo[]> {
    const metricStats = new Map<
      string,
      {
        firstSeen: number;
        lastSeen: number;
        count: number;
        dimensions: Set<string>;
      }
    >();

    // Calculate stats from data points
    for (const point of this.dataPoints) {
      const stats = metricStats.get(point.metric) || {
        firstSeen: point.timestamp!,
        lastSeen: point.timestamp!,
        count: 0,
        dimensions: new Set(),
      };

      stats.firstSeen = Math.min(stats.firstSeen, point.timestamp!);
      stats.lastSeen = Math.max(stats.lastSeen, point.timestamp!);
      stats.count++;

      if (point.dimensions) {
        for (const key of Object.keys(point.dimensions)) {
          stats.dimensions.add(key);
        }
      }

      metricStats.set(point.metric, stats);
    }

    // Build result
    const result: IMetricInfo[] = [];

    // Add metrics from stats
    for (const [name, stats] of metricStats) {
      const config = this.metrics.get(name);

      result.push({
        name,
        description: config?.description,
        unit: config?.unit,
        firstSeen: stats.firstSeen,
        lastSeen: stats.lastSeen,
        dataPoints: stats.count,
        dimensions: Array.from(stats.dimensions),
      });
    }

    // Add metrics that have been created but have no data yet
    for (const [name, config] of this.metrics) {
      if (!metricStats.has(name)) {
        result.push({
          name,
          description: config.description,
          unit: config.unit,
          firstSeen: config.firstSeen,
          lastSeen: config.lastSeen,
          dataPoints: 0,
          dimensions: [],
        });
      }
    }

    return result;
  }

  /**
   * Destroy service
   */
  override destroy(): void {
    super.destroy();

    if (this.retentionTimer) {
      clearInterval(this.retentionTimer);
    }

    this.dataPoints = [];
    this.metrics.clear();
    this.streamCallbacks.clear();
  }

  // Helper methods

  private updateMetricInfo(point: IAnalyticsDataPoint): void {
    const existing = this.metrics.get(point.metric);

    if (existing) {
      existing.lastSeen = Math.max(existing.lastSeen, point.timestamp!);
    } else {
      this.metrics.set(point.metric, {
        firstSeen: point.timestamp!,
        lastSeen: point.timestamp!,
      });
    }
  }

  private triggerStreams(point: IAnalyticsDataPoint): void {
    const callbacks = this.streamCallbacks.get(point.metric);

    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(point);
        } catch (error) {
          console.error('Stream callback error:', error);
        }
      }
    }
  }

  private applyRetention(metric: string): void {
    const config = this.metrics.get(metric);

    if (config?.retentionDays) {
      const cutoffTime = Date.now() - config.retentionDays * 24 * 60 * 60 * 1000;

      this.dataPoints = this.dataPoints.filter(
        (point) => point.metric !== metric || point.timestamp! >= cutoffTime,
      );
    }
  }

  private startRetentionCleanup(): void {
    // Run retention cleanup every hour
    this.retentionTimer = setInterval(
      () => {
        for (const [metric] of this.metrics) {
          this.applyRetention(metric);
        }
      },
      60 * 60 * 1000,
    );
  }

  private groupDataPoints(
    dataPoints: IAnalyticsDataPoint[],
    options: IAnalyticsQueryOptions,
  ): Array<{
    timestamp: number;
    values: Record<string, number>;
    dimensions?: Record<string, string | number | boolean>;
  }> {
    const result: Array<{
      timestamp: number;
      values: Record<string, number>;
      dimensions?: Record<string, string | number | boolean>;
    }> = [];

    if (options.granularity) {
      // Group by time buckets
      const buckets = this.groupByTime(
        dataPoints.map((p) => ({ timestamp: p.timestamp!, value: p.value })),
        options.granularity,
      );

      for (const [bucket] of buckets) {
        const values: Record<string, number> = {};

        // Group by metrics
        for (const metric of options.metrics) {
          const metricPoints = dataPoints.filter(
            (p) =>
              p.metric === metric &&
              this.getTimeBucket(p.timestamp!, options.granularity!) === bucket,
          );

          values[metric] = this.aggregateDataPoints(
            metricPoints.map((p) => ({ timestamp: p.timestamp!, value: p.value })),
            options.aggregation || 'sum',
          );
        }

        result.push({ timestamp: bucket, values });
      }
    } else if (options.groupBy && options.groupBy.length > 0) {
      // Group by dimensions
      const groups = new Map<string, IAnalyticsDataPoint[]>();

      for (const point of dataPoints) {
        const groupKey = options.groupBy
          .map((dim) => `${dim}:${point.dimensions?.[dim] || 'null'}`)
          .join('|');

        const group = groups.get(groupKey) || [];
        group.push(point);
        groups.set(groupKey, group);
      }

      for (const [groupKey, groupPoints] of groups) {
        const dimensions: Record<string, string | number | boolean> = {};
        const keyParts = groupKey.split('|');

        options.groupBy.forEach((dim, index) => {
          const keyPart = keyParts[index];
          if (keyPart) {
            const parts = keyPart.split(':');
            const value = parts[1] || '';
            dimensions[dim] = value === 'null' ? '' : value;
          } else {
            dimensions[dim] = '';
          }
        });

        const values: Record<string, number> = {};

        for (const metric of options.metrics) {
          const metricPoints = groupPoints.filter((p) => p.metric === metric);
          if (options.aggregation === 'count') {
            values[metric] = metricPoints.length;
          } else {
            values[metric] = this.aggregateDataPoints(
              metricPoints.map((p) => ({ timestamp: p.timestamp!, value: p.value })),
              options.aggregation || 'sum',
            );
          }
        }

        if (groupPoints.length > 0 && groupPoints[0]) {
          result.push({
            timestamp: groupPoints[0].timestamp!,
            values,
            dimensions,
          });
        }
      }
    } else {
      // No grouping - return individual points
      for (const point of dataPoints) {
        result.push({
          timestamp: point.timestamp!,
          values: { [point.metric]: point.value },
          dimensions: point.dimensions,
        });
      }
    }

    // Apply limit
    if (options.limit && result.length > options.limit) {
      return result.slice(0, options.limit);
    }

    return result;
  }
}
