/**
 * Analytics tracking middleware
 */

import type { Context, Next } from 'hono';

import type { IAnalyticsService } from '../core/interfaces/analytics';
import type { EventBus } from '../core/events/event-bus';
import { AnalyticsFactory } from '../core/services/analytics';

interface AnalyticsTrackerOptions {
  /**
   * Analytics service instance or provider name
   */
  analyticsService?: IAnalyticsService | string;

  /**
   * Environment for Cloudflare Analytics
   */
  env?: Record<string, unknown>;

  /**
   * Dataset name for Cloudflare Analytics
   */
  datasetName?: string;

  /**
   * Metrics prefix
   */
  metricsPrefix?: string;

  /**
   * Routes to exclude from tracking
   */
  excludeRoutes?: string[] | RegExp | ((path: string) => boolean);

  /**
   * Custom dimension extractors
   */
  dimensions?: {
    [key: string]: (c: Context) => string | number | boolean | undefined;
  };

  /**
   * Track response time
   */
  trackResponseTime?: boolean;

  /**
   * Track request size
   */
  trackRequestSize?: boolean;

  /**
   * Track response size
   */
  trackResponseSize?: boolean;

  /**
   * Track errors
   */
  trackErrors?: boolean;

  /**
   * Track user actions
   */
  trackUserActions?: boolean;

  /**
   * Event bus for notifications
   */
  eventBus?: EventBus;

  /**
   * Sample rate (0-1)
   */
  sampleRate?: number;
}

/**
 * Create analytics tracking middleware
 */
export function createAnalyticsTracker(options: AnalyticsTrackerOptions = {}) {
  // Get analytics service
  const analyticsService =
    typeof options.analyticsService === 'string'
      ? AnalyticsFactory.getAnalyticsService(options.analyticsService, {
          env: options.env,
          datasetName: options.datasetName,
          eventBus: options.eventBus,
        })
      : options.analyticsService ||
        AnalyticsFactory.createAutoDetect({
          env: options.env,
          datasetName: options.datasetName,
          eventBus: options.eventBus,
        });

  const metricsPrefix = options.metricsPrefix || 'api';
  const sampleRate = options.sampleRate ?? 1;

  const shouldTrack = (path: string): boolean => {
    if (!options.excludeRoutes) return true;

    if (Array.isArray(options.excludeRoutes)) {
      return !options.excludeRoutes.includes(path);
    }

    if (options.excludeRoutes instanceof RegExp) {
      return !options.excludeRoutes.test(path);
    }

    if (typeof options.excludeRoutes === 'function') {
      return !options.excludeRoutes(path);
    }

    return true;
  };

  const shouldSample = (): boolean => {
    return Math.random() < sampleRate;
  };

  const extractDimensions = (c: Context): Record<string, string | number | boolean> => {
    const dimensions: Record<string, string | number | boolean> = {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
    };

    // Add custom dimensions
    if (options.dimensions) {
      for (const [key, extractor] of Object.entries(options.dimensions)) {
        try {
          const value = extractor(c);
          if (value !== undefined) {
            dimensions[key] = value;
          }
        } catch (error) {
          console.error(`Failed to extract dimension ${key}:`, error);
        }
      }
    }

    // Add user ID if available
    const userId = c.get('userId');
    if (userId) {
      dimensions.userId = userId;
    }

    // Add environment
    const env = c.get('env');
    if (env) {
      dimensions.env = env;
    }

    return dimensions;
  };

  return async function analyticsTracker(c: Context, next: Next) {
    const path = c.req.path;

    // Check if we should track this request
    if (!shouldTrack(path) || !shouldSample()) {
      return next();
    }

    const startTime = Date.now();
    let requestSize = 0;
    let responseSize = 0;
    let error: Error | undefined;

    try {
      // Track request size
      if (options.trackRequestSize !== false) {
        const contentLength = c.req.header('content-length');
        if (contentLength) {
          requestSize = parseInt(contentLength, 10);
        }
      }

      // Execute handler
      await next();

      // Track response size
      if (options.trackResponseSize !== false) {
        const responseLength = c.res.headers.get('content-length');
        if (responseLength) {
          responseSize = parseInt(responseLength, 10);
        }
      }
    } catch (err) {
      error = err as Error;
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      const dimensions = extractDimensions(c);

      // Track request count
      await analyticsService.write({
        metric: `${metricsPrefix}.request_count`,
        value: 1,
        dimensions,
      });

      // Track response time
      if (options.trackResponseTime !== false) {
        await analyticsService.write({
          metric: `${metricsPrefix}.response_time`,
          value: duration,
          dimensions,
        });
      }

      // Track request size
      if (options.trackRequestSize !== false && requestSize > 0) {
        await analyticsService.write({
          metric: `${metricsPrefix}.request_size`,
          value: requestSize,
          dimensions,
        });
      }

      // Track response size
      if (options.trackResponseSize !== false && responseSize > 0) {
        await analyticsService.write({
          metric: `${metricsPrefix}.response_size`,
          value: responseSize,
          dimensions,
        });
      }

      // Track errors
      if (options.trackErrors !== false && (error || c.res.status >= 400)) {
        await analyticsService.write({
          metric: `${metricsPrefix}.error_count`,
          value: 1,
          dimensions: {
            ...dimensions,
            errorType: error ? error.name : 'HTTPError',
            errorMessage: error ? error.message : `HTTP ${c.res.status}`,
          },
        });
      }

      // Track status codes
      await analyticsService.write({
        metric: `${metricsPrefix}.status_${Math.floor(c.res.status / 100)}xx`,
        value: 1,
        dimensions,
      });
    }
  };
}

/**
 * Track custom user action
 */
export async function trackUserAction(
  analyticsService: IAnalyticsService,
  action: string,
  value: number = 1,
  dimensions?: Record<string, string | number | boolean>,
): Promise<void> {
  await analyticsService.write({
    metric: `user.action.${action}`,
    value,
    dimensions,
  });
}

/**
 * Track custom business metric
 */
export async function trackBusinessMetric(
  analyticsService: IAnalyticsService,
  metric: string,
  value: number,
  dimensions?: Record<string, string | number | boolean>,
): Promise<void> {
  await analyticsService.write({
    metric: `business.${metric}`,
    value,
    dimensions,
  });
}

/**
 * Create performance tracker
 */
export function createPerformanceTracker(analyticsService: IAnalyticsService, operation: string) {
  const startTime = Date.now();

  return {
    complete: async (dimensions?: Record<string, string | number | boolean>) => {
      const duration = Date.now() - startTime;

      await analyticsService.write({
        metric: `performance.${operation}`,
        value: duration,
        dimensions: {
          ...dimensions,
          success: true,
        },
      });
    },

    fail: async (error: Error, dimensions?: Record<string, string | number | boolean>) => {
      const duration = Date.now() - startTime;

      await analyticsService.write({
        metric: `performance.${operation}`,
        value: duration,
        dimensions: {
          ...dimensions,
          success: false,
          errorType: error.name,
          errorMessage: error.message,
        },
      });
    },
  };
}
