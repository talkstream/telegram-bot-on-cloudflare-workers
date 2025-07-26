/**
 * Performance monitoring interfaces for the wireframe platform
 */

import type { Context } from 'hono';

/**
 * Metric types for performance monitoring
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timing';

/**
 * Base metric interface
 */
export interface IMetric {
  name: string;
  type: MetricType;
  value: number;
  tags?: Record<string, string>;
  timestamp?: number;
}

/**
 * Performance monitoring service interface
 */
export interface IPerformanceMonitor {
  /**
   * Start a timing measurement
   */
  startTimer(name: string, tags?: Record<string, string>): ITimer;

  /**
   * Record a metric
   */
  recordMetric(metric: IMetric): void;

  /**
   * Increment a counter
   */
  increment(name: string, value?: number, tags?: Record<string, string>): void;

  /**
   * Set a gauge value
   */
  gauge(name: string, value: number, tags?: Record<string, string>): void;

  /**
   * Record a timing
   */
  timing(name: string, duration: number, tags?: Record<string, string>): void;

  /**
   * Record a histogram value
   */
  histogram(name: string, value: number, tags?: Record<string, string>): void;

  /**
   * Flush all pending metrics
   */
  flush(): Promise<void>;
}

/**
 * Timer interface for measuring durations
 */
export interface ITimer {
  /**
   * Stop the timer and record the duration
   */
  end(tags?: Record<string, string>): number;

  /**
   * Get elapsed time without stopping
   */
  elapsed(): number;
}

/**
 * Request metrics collected during a request
 */
export interface IRequestMetrics {
  duration: number;
  statusCode: number;
  method: string;
  path: string;
  userAgent?: string;
  ip?: string;
  error?: boolean;
  tags?: Record<string, string>;
}

/**
 * Performance middleware configuration
 */
export interface PerformanceMiddlewareConfig {
  /**
   * Performance monitor instance
   */
  monitor?: IPerformanceMonitor;

  /**
   * Enable detailed metrics
   */
  detailed?: boolean;

  /**
   * Skip metrics for these paths
   */
  skipPaths?: string[];

  /**
   * Custom metric name generator
   */
  metricNameGenerator?: (c: Context) => string;

  /**
   * Custom tag generator
   */
  tagGenerator?: (c: Context) => Record<string, string>;

  /**
   * Sample rate (0-1, where 1 means 100% sampling)
   */
  sampleRate?: number;
}

/**
 * Monitoring provider interface
 */
export interface IMonitoringProvider {
  /**
   * Provider name
   */
  name: string;

  /**
   * Send metrics to the provider
   */
  send(metrics: IMetric[]): Promise<void>;

  /**
   * Check if provider is available
   */
  isAvailable(): boolean;
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceMonitoringConfig {
  /**
   * Monitoring providers
   */
  providers?: IMonitoringProvider[];

  /**
   * Flush interval in milliseconds
   */
  flushInterval?: number;

  /**
   * Maximum metrics buffer size
   */
  maxBufferSize?: number;

  /**
   * Default tags to add to all metrics
   */
  defaultTags?: Record<string, string>;

  /**
   * Enable debug logging
   */
  debug?: boolean;
}
