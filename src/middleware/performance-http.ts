/**
 * HTTP Performance Monitoring Middleware
 * Adapters for various web frameworks
 */

import { PerformanceMonitor, type PerformanceMonitorConfig } from './performance-monitor';

export interface HttpMetrics {
  path: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: number;
  userAgent?: string;
  ip?: string;
  headers?: Record<string, string>;
}

/**
 * Create Express/Connect middleware
 */
export function createExpressMiddleware(
  monitor?: PerformanceMonitor,
  config?: PerformanceMonitorConfig,
) {
  const perfMonitor = monitor || new PerformanceMonitor(config);

  return (req: any, res: any, next: any) => {
    const timer = perfMonitor.startTimer();
    const operation = `${req.method} ${req.path || req.url}`;

    // Capture original end method
    const originalEnd = res.end;

    res.end = function (...args: any[]) {
      const duration = timer.stop();

      // Restore original method
      res.end = originalEnd;

      // Call original method
      const result = originalEnd.apply(res, args);

      // Record metrics
      perfMonitor.recordMetric({
        operation,
        duration,
        success: res.statusCode < 400,
        timestamp: Date.now(),
        metadata: {
          path: req.path || req.url,
          method: req.method,
          statusCode: res.statusCode,
          userAgent: req.headers['user-agent'],
          ip: req.ip || req.connection?.remoteAddress,
        },
      });

      // Add performance headers
      if (!res.headersSent) {
        res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
      }

      return result;
    };

    next();
  };
}

/**
 * Create Hono middleware
 */
export function createHonoMiddleware(
  monitor?: PerformanceMonitor,
  config?: PerformanceMonitorConfig,
) {
  const perfMonitor = monitor || new PerformanceMonitor(config);

  return async (c: any, next: any) => {
    const timer = perfMonitor.startTimer();
    const operation = `${c.req.method} ${c.req.path}`;

    try {
      await next();
    } finally {
      const duration = timer.stop();

      perfMonitor.recordMetric({
        operation,
        duration,
        success: c.res.status < 400,
        timestamp: Date.now(),
        metadata: {
          path: c.req.path,
          method: c.req.method,
          statusCode: c.res.status,
          userAgent: c.req.header('user-agent'),
          ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
        },
      });

      // Add performance headers
      c.header('X-Response-Time', `${duration.toFixed(2)}ms`);
    }
  };
}

/**
 * Create Koa middleware
 */
export function createKoaMiddleware(
  monitor?: PerformanceMonitor,
  config?: PerformanceMonitorConfig,
) {
  const perfMonitor = monitor || new PerformanceMonitor(config);

  return async (ctx: any, next: any) => {
    const timer = perfMonitor.startTimer();
    const operation = `${ctx.method} ${ctx.path}`;

    try {
      await next();
    } finally {
      const duration = timer.stop();

      perfMonitor.recordMetric({
        operation,
        duration,
        success: ctx.status < 400,
        timestamp: Date.now(),
        metadata: {
          path: ctx.path,
          method: ctx.method,
          statusCode: ctx.status,
          userAgent: ctx.headers['user-agent'],
          ip: ctx.ip,
        },
      });

      // Add performance headers
      ctx.set('X-Response-Time', `${duration.toFixed(2)}ms`);
    }
  };
}

/**
 * Create Fastify plugin
 */
export function createFastifyPlugin(
  monitor?: PerformanceMonitor,
  config?: PerformanceMonitorConfig,
) {
  const perfMonitor = monitor || new PerformanceMonitor(config);

  return async function performancePlugin(fastify: any) {
    fastify.addHook('onRequest', async (request: any) => {
      request.performanceTimer = perfMonitor.startTimer();
    });

    fastify.addHook('onResponse', async (request: any, reply: any) => {
      if (request.performanceTimer) {
        const duration = request.performanceTimer.stop();
        const operation = `${request.method} ${request.routerPath || request.url}`;

        perfMonitor.recordMetric({
          operation,
          duration,
          success: reply.statusCode < 400,
          timestamp: Date.now(),
          metadata: {
            path: request.url,
            method: request.method,
            statusCode: reply.statusCode,
            userAgent: request.headers['user-agent'],
            ip: request.ip,
          },
        });
      }
    });
  };
}

/**
 * Create performance stats endpoint handler
 */
export function createStatsHandler(monitor?: PerformanceMonitor) {
  const perfMonitor = monitor || new PerformanceMonitor();

  return (_req: any, res: any) => {
    const stats = perfMonitor.getStats();

    const response = {
      status: 'ok',
      timestamp: Date.now(),
      stats: stats || [],
      summary: calculateSummary(stats),
    };

    if (typeof res === 'object' && res !== null) {
      if (typeof res.json === 'function') {
        // Express-like
        res.json(response);
        return;
      } else if (typeof res.end === 'function') {
        // Node.js raw
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(response));
        return;
      }
    }

    // Return for custom handling
    return response;
  };
}

/**
 * Calculate summary statistics
 */
function calculateSummary(stats: any): any {
  if (!stats || !Array.isArray(stats) || stats.length === 0) {
    return null;
  }

  const totalRequests = stats.reduce((sum, stat) => sum + stat.count, 0);
  const totalErrors = stats.reduce((sum, stat) => sum + stat.errorCount, 0);
  const avgDuration =
    stats.reduce((sum, stat) => sum + stat.avgDuration * stat.count, 0) / totalRequests;

  const slowestOperation = stats.reduce(
    (slowest, stat) => (stat.maxDuration > (slowest?.maxDuration || 0) ? stat : slowest),
    null,
  );

  const busiestOperation = stats.reduce(
    (busiest, stat) => (stat.count > (busiest?.count || 0) ? stat : busiest),
    null,
  );

  return {
    totalRequests,
    totalErrors,
    errorRate: totalErrors / totalRequests,
    avgDuration: Math.round(avgDuration),
    slowestOperation: slowestOperation?.operation,
    slowestDuration: slowestOperation?.maxDuration,
    busiestOperation: busiestOperation?.operation,
    busiestCount: busiestOperation?.count,
  };
}

/**
 * Memory monitoring utilities
 */
export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

export function getMemoryMetrics(): MemoryMetrics {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024),
    };
  }

  // Fallback for browser environments
  if (typeof performance !== 'undefined' && 'memory' in performance) {
    const memory = (performance as any).memory;
    return {
      heapUsed: Math.round(memory.usedJSHeapSize / 1024 / 1024),
      heapTotal: Math.round(memory.totalJSHeapSize / 1024 / 1024),
      external: 0,
      rss: 0,
    };
  }

  return {
    heapUsed: 0,
    heapTotal: 0,
    external: 0,
    rss: 0,
  };
}
