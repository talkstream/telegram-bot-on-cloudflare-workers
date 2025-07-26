/**
 * Performance monitoring middleware for Hono
 */

import type { Context, Next } from 'hono';

import type {
  IPerformanceMonitor,
  PerformanceMiddlewareConfig,
  IRequestMetrics,
} from '../core/interfaces/performance';
import { PerformanceMonitor } from '../core/services/performance-monitor';

/**
 * Default paths to skip monitoring
 */
const DEFAULT_SKIP_PATHS = ['/health', '/metrics', '/favicon.ico'];

/**
 * Performance monitoring middleware
 * Tracks request metrics including duration, status codes, and custom metrics
 *
 * @example
 * ```typescript
 * // Basic usage
 * app.use('*', performanceMonitoring());
 *
 * // With custom configuration
 * app.use('*', performanceMonitoring({
 *   detailed: true,
 *   skipPaths: ['/health', '/internal'],
 *   tagGenerator: (c) => ({
 *     route: c.req.routePath,
 *     method: c.req.method,
 *     env: c.env.ENVIRONMENT,
 *   })
 * }));
 * ```
 */
export function performanceMonitoring(config: PerformanceMiddlewareConfig = {}) {
  const monitor = config.monitor || new PerformanceMonitor();
  const detailed = config.detailed || false;
  const skipPaths = [...DEFAULT_SKIP_PATHS, ...(config.skipPaths || [])];
  const sampleRate = config.sampleRate ?? 1;

  return async (c: Context, next: Next) => {
    // Skip monitoring for excluded paths
    if (skipPaths.some((path) => c.req.path.startsWith(path))) {
      await next();
      return;
    }

    // Sample rate check
    if (sampleRate < 1 && Math.random() > sampleRate) {
      await next();
      return;
    }

    // Generate metric name and tags
    const metricName = config.metricNameGenerator ? config.metricNameGenerator(c) : 'http.request';

    const tags = config.tagGenerator
      ? config.tagGenerator(c)
      : {
          method: c.req.method,
          path: c.req.path,
        };

    // Start timing
    const timer = monitor.startTimer(`${metricName}.duration`, tags);

    // Track request count
    monitor.increment(`${metricName}.count`, 1, tags);

    try {
      // Execute handler
      await next();

      // Record response metrics
      const duration = timer.end({
        ...tags,
        status: c.res.status.toString(),
        status_group: `${Math.floor(c.res.status / 100)}xx`,
      });

      // Record status code distribution
      monitor.increment(`${metricName}.status.${c.res.status}`, 1, tags);

      // Record error metric for 5xx status codes
      if (c.res.status >= 500) {
        monitor.increment(`${metricName}.error`, 1, tags);
      }

      // Record detailed metrics if enabled
      if (detailed) {
        recordDetailedMetrics(c, monitor, metricName, tags, duration);
      }
    } catch (error) {
      // Record error metrics
      timer.end({
        ...tags,
        status: '500',
        status_group: '5xx',
        error: 'true',
      });

      monitor.increment(`${metricName}.error`, 1, tags);
      monitor.increment(`${metricName}.status.500`, 1, tags);

      throw error;
    }
  };
}

/**
 * Record detailed request metrics
 */
function recordDetailedMetrics(
  c: Context,
  monitor: IPerformanceMonitor,
  metricName: string,
  tags: Record<string, string>,
  duration: number,
): void {
  // Response size
  const contentLength = c.res.headers.get('content-length');
  if (contentLength) {
    monitor.histogram(`${metricName}.response_size`, parseInt(contentLength), tags);
  }

  // Request size
  const requestLength = c.req.header('content-length');
  if (requestLength) {
    monitor.histogram(`${metricName}.request_size`, parseInt(requestLength), tags);
  }

  // User agent tracking
  const userAgent = c.req.header('user-agent');
  if (userAgent) {
    const uaTags = { ...tags, user_agent: parseUserAgent(userAgent) };
    monitor.increment(`${metricName}.user_agent`, 1, uaTags);
  }

  // Latency buckets
  const latencyBucket = getLatencyBucket(duration);
  monitor.increment(`${metricName}.latency_bucket.${latencyBucket}`, 1, tags);
}

/**
 * Parse user agent to get browser/client type
 */
function parseUserAgent(ua: string): string {
  if (ua.includes('Chrome')) return 'chrome';
  if (ua.includes('Firefox')) return 'firefox';
  if (ua.includes('Safari')) return 'safari';
  if (ua.includes('Edge')) return 'edge';
  if (ua.includes('bot') || ua.includes('Bot')) return 'bot';
  if (ua.includes('curl')) return 'curl';
  if (ua.includes('Postman')) return 'postman';
  return 'other';
}

/**
 * Get latency bucket for histogram
 */
function getLatencyBucket(duration: number): string {
  if (duration < 10) return '<10ms';
  if (duration < 50) return '10-50ms';
  if (duration < 100) return '50-100ms';
  if (duration < 250) return '100-250ms';
  if (duration < 500) return '250-500ms';
  if (duration < 1000) return '500-1000ms';
  if (duration < 5000) return '1-5s';
  return '>5s';
}

/**
 * Export request metrics for external consumption
 */
export async function exportRequestMetrics(
  c: Context,
  monitor: IPerformanceMonitor,
): Promise<IRequestMetrics> {
  const startTime = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const userAgent = c.req.header('user-agent');
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for');

  // Wait for response to be ready
  await c.res.blob();

  const duration = Date.now() - startTime;
  const statusCode = c.res.status;
  const error = statusCode >= 400;

  const metrics: IRequestMetrics = {
    duration,
    statusCode,
    method,
    path,
    userAgent,
    ip,
    error,
    tags: {
      environment: c.env?.ENVIRONMENT || 'development',
      region: c.req.header('cf-ipcountry') || 'unknown',
    },
  };

  // Record in monitor
  monitor.timing('request.duration', duration, metrics.tags);
  monitor.increment(`request.status.${statusCode}`, 1, metrics.tags);

  return metrics;
}

/**
 * Metrics endpoint handler
 * Provides a simple metrics endpoint for monitoring
 */
export function metricsEndpoint(monitor: IPerformanceMonitor) {
  return async (c: Context) => {
    // Flush metrics before responding
    await monitor.flush();

    // Return basic health metrics
    return c.json({
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime ? process.uptime() : 'N/A',
      memory: process.memoryUsage ? process.memoryUsage() : 'N/A',
      env: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        WORKER_ENV: c.env?.ENVIRONMENT || 'unknown',
      },
    });
  };
}
