/**
 * Base analytics service implementation
 */

import type {
  IAnalyticsService,
  IAnalyticsDataPoint,
  IAnalyticsQueryOptions,
  IAnalyticsResult,
  IAnalyticsBatchOptions,
  IAnalyticsEvent,
  AnalyticsEventType,
} from '../../interfaces/analytics';
import type { EventBus } from '../../events/event-bus';

/**
 * Base analytics service with common functionality
 */
export abstract class BaseAnalyticsService implements IAnalyticsService {
  protected batchQueue: IAnalyticsDataPoint[] = [];
  protected batchOptions: Required<IAnalyticsBatchOptions>;
  protected flushTimer?: NodeJS.Timeout;
  protected eventBus?: EventBus;

  constructor(options: IAnalyticsBatchOptions = {}, eventBus?: EventBus) {
    this.batchOptions = {
      maxBatchSize: options.maxBatchSize || 1000,
      flushInterval: options.flushInterval || 10000, // 10 seconds
      retryOnFailure: options.retryOnFailure !== false,
      maxRetries: options.maxRetries || 3,
    };
    this.eventBus = eventBus;

    // Start batch timer
    if (this.batchOptions.flushInterval > 0) {
      this.startBatchTimer();
    }
  }

  /**
   * Write a single data point
   */
  async write(dataPoint: IAnalyticsDataPoint): Promise<void> {
    // Add timestamp if not provided
    if (!dataPoint.timestamp) {
      dataPoint.timestamp = Date.now();
    }

    // Validate data point
    this.validateDataPoint(dataPoint);

    // Add to batch queue
    this.batchQueue.push(dataPoint);

    // Check if batch is full
    if (this.batchQueue.length >= this.batchOptions.maxBatchSize) {
      await this.flush();
    }

    // Emit success event
    this.emitEvent({
      type: 'analytics:write:success',
      timestamp: Date.now(),
      metric: dataPoint.metric,
      count: 1,
    });
  }

  /**
   * Write multiple data points
   */
  async writeBatch(dataPoints: IAnalyticsDataPoint[]): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate all data points
      for (const dataPoint of dataPoints) {
        if (!dataPoint.timestamp) {
          dataPoint.timestamp = Date.now();
        }
        this.validateDataPoint(dataPoint);
      }

      // Write with retries
      await this.writeWithRetry(dataPoints);

      // Emit success event
      this.emitEvent({
        type: 'analytics:batch:flushed',
        timestamp: Date.now(),
        count: dataPoints.length,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      // Emit error event
      this.emitEvent({
        type: 'analytics:write:error',
        timestamp: Date.now(),
        error: error as Error,
        count: dataPoints.length,
      });

      throw error;
    }
  }

  /**
   * Query analytics data
   */
  abstract query(options: IAnalyticsQueryOptions): Promise<IAnalyticsResult>;

  /**
   * Flush pending writes
   */
  async flush(): Promise<void> {
    if (this.batchQueue.length === 0) {
      return;
    }

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    await this.writeBatch(batch);
  }

  /**
   * Destroy service and cleanup
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Flush remaining data
    this.flush().catch((error) => {
      console.error('Failed to flush analytics on destroy:', error);
    });
  }

  /**
   * Validate data point
   */
  protected validateDataPoint(dataPoint: IAnalyticsDataPoint): void {
    if (!dataPoint.metric || typeof dataPoint.metric !== 'string') {
      throw new Error('Invalid metric name');
    }

    if (typeof dataPoint.value !== 'number' || isNaN(dataPoint.value)) {
      throw new Error('Invalid metric value');
    }

    if (
      dataPoint.timestamp &&
      (dataPoint.timestamp < 0 || dataPoint.timestamp > Date.now() + 3600000)
    ) {
      throw new Error('Invalid timestamp');
    }

    // Validate dimensions
    if (dataPoint.dimensions) {
      for (const [key, value] of Object.entries(dataPoint.dimensions)) {
        if (typeof key !== 'string') {
          throw new Error('Dimension key must be a string');
        }
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
          throw new Error(`Invalid dimension value for ${key}`);
        }
      }
    }
  }

  /**
   * Write with retry logic
   */
  protected async writeWithRetry(dataPoints: IAnalyticsDataPoint[]): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.batchOptions.maxRetries; attempt++) {
      try {
        await this.doWrite(dataPoints);
        return;
      } catch (error) {
        lastError = error as Error;

        if (!this.batchOptions.retryOnFailure || attempt === this.batchOptions.maxRetries) {
          throw error;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Actual write implementation (to be overridden)
   */
  protected abstract doWrite(dataPoints: IAnalyticsDataPoint[]): Promise<void>;

  /**
   * Start batch timer
   */
  protected startBatchTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        console.error('Failed to flush analytics batch:', error);
      });
    }, this.batchOptions.flushInterval);
  }

  /**
   * Emit analytics event
   */
  protected emitEvent(event: Omit<IAnalyticsEvent, 'type'> & { type: AnalyticsEventType }): void {
    if (this.eventBus) {
      this.eventBus.emit(event.type, event, 'analytics-service');
    }
  }

  /**
   * Helper to aggregate data points
   */
  protected aggregateDataPoints(
    dataPoints: Array<{ timestamp: number; value: number; dimensions?: Record<string, unknown> }>,
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count',
  ): number {
    if (dataPoints.length === 0) return 0;

    switch (aggregation) {
      case 'sum':
        return dataPoints.reduce((sum, dp) => sum + dp.value, 0);

      case 'avg':
        return dataPoints.reduce((sum, dp) => sum + dp.value, 0) / dataPoints.length;

      case 'min':
        return Math.min(...dataPoints.map((dp) => dp.value));

      case 'max':
        return Math.max(...dataPoints.map((dp) => dp.value));

      case 'count':
        return dataPoints.length;

      default:
        return 0;
    }
  }

  /**
   * Helper to group data by time buckets
   */
  protected groupByTime(
    dataPoints: Array<{ timestamp: number; value: number }>,
    granularity: 'minute' | 'hour' | 'day' | 'week' | 'month',
  ): Map<number, Array<{ timestamp: number; value: number }>> {
    const buckets = new Map<number, Array<{ timestamp: number; value: number }>>();

    for (const point of dataPoints) {
      const bucket = this.getTimeBucket(point.timestamp, granularity);
      const existing = buckets.get(bucket) || [];
      existing.push(point);
      buckets.set(bucket, existing);
    }

    return buckets;
  }

  /**
   * Get time bucket for a timestamp
   */
  protected getTimeBucket(timestamp: number, granularity: string): number {
    const date = new Date(timestamp);

    switch (granularity) {
      case 'minute':
        date.setSeconds(0, 0);
        break;

      case 'hour':
        date.setMinutes(0, 0, 0);
        break;

      case 'day':
        date.setHours(0, 0, 0, 0);
        break;

      case 'week':
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - date.getDay());
        break;

      case 'month':
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        break;
    }

    return date.getTime();
  }
}
