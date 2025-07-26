/**
 * Analytics interfaces for the platform
 */

/**
 * Analytics data point
 */
export interface IAnalyticsDataPoint {
  /**
   * Metric name (e.g., "api_request", "user_action")
   */
  metric: string;

  /**
   * Numeric value
   */
  value: number;

  /**
   * Timestamp (defaults to current time)
   */
  timestamp?: number;

  /**
   * Optional dimensions/labels
   */
  dimensions?: Record<string, string | number | boolean>;

  /**
   * Optional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Analytics query options
 */
export interface IAnalyticsQueryOptions {
  /**
   * Start time (inclusive)
   */
  startTime: Date;

  /**
   * End time (exclusive)
   */
  endTime: Date;

  /**
   * Metrics to query
   */
  metrics: string[];

  /**
   * Dimension filters
   */
  filters?: Record<string, string | number | boolean | string[]>;

  /**
   * Group by dimensions
   */
  groupBy?: string[];

  /**
   * Time granularity (e.g., "minute", "hour", "day")
   */
  granularity?: 'minute' | 'hour' | 'day' | 'week' | 'month';

  /**
   * Result limit
   */
  limit?: number;

  /**
   * Aggregation function
   */
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

/**
 * Analytics query result
 */
export interface IAnalyticsResult {
  /**
   * Time series data
   */
  data: Array<{
    timestamp: number;
    values: Record<string, number>;
    dimensions?: Record<string, string | number | boolean>;
  }>;

  /**
   * Query metadata
   */
  metadata: {
    startTime: number;
    endTime: number;
    granularity?: string;
    totalPoints: number;
  };
}

/**
 * Batch write options
 */
export interface IAnalyticsBatchOptions {
  /**
   * Max batch size
   */
  maxBatchSize?: number;

  /**
   * Flush interval (ms)
   */
  flushInterval?: number;

  /**
   * Retry failed writes
   */
  retryOnFailure?: boolean;

  /**
   * Max retries
   */
  maxRetries?: number;
}

/**
 * Analytics service interface
 */
export interface IAnalyticsService {
  /**
   * Write a single data point
   */
  write(dataPoint: IAnalyticsDataPoint): Promise<void>;

  /**
   * Write multiple data points
   */
  writeBatch(dataPoints: IAnalyticsDataPoint[]): Promise<void>;

  /**
   * Query analytics data
   */
  query(options: IAnalyticsQueryOptions): Promise<IAnalyticsResult>;

  /**
   * Flush any pending writes
   */
  flush(): Promise<void>;
}

/**
 * Advanced analytics service interface
 */
export interface IAdvancedAnalyticsService extends IAnalyticsService {
  /**
   * Real-time streaming
   */
  stream(
    metrics: string[],
    callback: (dataPoint: IAnalyticsDataPoint) => void,
  ): { stop: () => void };

  /**
   * Create custom metrics
   */
  createMetric(name: string, config: IMetricConfig): Promise<void>;

  /**
   * Delete old data
   */
  deleteData(metric: string, beforeDate: Date): Promise<void>;

  /**
   * Export data
   */
  export(options: IAnalyticsQueryOptions, format: 'csv' | 'json'): Promise<string>;

  /**
   * Get available metrics
   */
  listMetrics(): Promise<IMetricInfo[]>;
}

/**
 * Metric configuration
 */
export interface IMetricConfig {
  /**
   * Metric description
   */
  description?: string;

  /**
   * Metric unit (e.g., "requests", "ms", "bytes")
   */
  unit?: string;

  /**
   * Retention period (days)
   */
  retentionDays?: number;

  /**
   * Allowed dimensions
   */
  dimensions?: string[];

  /**
   * Aggregation rules
   */
  aggregations?: Array<{
    interval: 'minute' | 'hour' | 'day';
    function: 'sum' | 'avg' | 'min' | 'max';
  }>;
}

/**
 * Metric information
 */
export interface IMetricInfo {
  name: string;
  description?: string;
  unit?: string;
  firstSeen: number;
  lastSeen: number;
  dataPoints: number;
  dimensions: string[];
}

/**
 * Analytics provider interface
 */
export interface IAnalyticsProvider {
  /**
   * Provider name
   */
  name: string;

  /**
   * Check if provider is available
   */
  isAvailable(): boolean;

  /**
   * Get analytics service instance
   */
  getAnalyticsService(): IAnalyticsService;
}

/**
 * Analytics event types
 */
export type AnalyticsEventType =
  | 'analytics:write:success'
  | 'analytics:write:error'
  | 'analytics:batch:flushed'
  | 'analytics:query:success'
  | 'analytics:query:error';

/**
 * Analytics event
 */
export interface IAnalyticsEvent {
  type: AnalyticsEventType;
  timestamp: number;
  metric?: string;
  count?: number;
  error?: Error;
  duration?: number;
}
