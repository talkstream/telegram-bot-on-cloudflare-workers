/**
 * HTTP Performance Monitoring Middleware
 * Adapters for various web frameworks
 */

import type { Context, Next } from 'hono'

import {
  PerformanceMonitor,
  type OperationStats,
  type PerformanceMonitorConfig
} from './performance-monitor'

// Express/Connect types
interface ExpressRequest {
  method: string
  path?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  ip?: string
  connection?: { remoteAddress?: string }
}

interface ExpressResponse {
  end: (...args: unknown[]) => unknown
  statusCode: number
  headersSent: boolean
  setHeader: (name: string, value: string) => void
  json: (data: unknown) => void
}

type ExpressNext = () => void

// Koa types
interface KoaContext {
  method: string
  path: string
  status: number
  headers: Record<string, string | string[] | undefined>
  ip: string
  request: {
    header: Record<string, string | string[] | undefined>
    ip: string
  }
  set: (field: string, value: string) => void
}

type KoaNext = () => Promise<void>

// Fastify types
interface FastifyInstance {
  addHook: (
    name: string,
    handler: (request: FastifyRequest, reply?: FastifyReply) => Promise<void>
  ) => void
}

interface FastifyRequest {
  method: string
  url: string
  routerPath?: string
  headers: Record<string, string | string[] | undefined>
  ip: string
  performanceTimer?: { stop: () => number }
}

interface FastifyReply {
  statusCode: number
}

export interface HttpMetrics {
  path: string
  method: string
  statusCode: number
  duration: number
  timestamp: number
  userAgent?: string
  ip?: string
  headers?: Record<string, string>
}

interface SummaryStats {
  totalRequests: number
  totalErrors: number
  errorRate: number
  avgDuration: number
  slowestOperation?: string
  slowestDuration?: number
  busiestOperation?: string
  busiestCount?: number
}

interface PerformanceMemory {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

interface PerformanceWithMemory extends Performance {
  memory: PerformanceMemory
}

/**
 * Create Express/Connect middleware
 */
export function createExpressMiddleware(
  monitor?: PerformanceMonitor,
  config?: PerformanceMonitorConfig
) {
  const perfMonitor = monitor || new PerformanceMonitor(config)

  return (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
    const timer = perfMonitor.startTimer()
    const operation = `${req.method} ${req.path || req.url}`

    // Capture original end method
    const originalEnd = res.end

    res.end = function (...args: unknown[]) {
      const duration = timer.stop()

      // Restore original method
      res.end = originalEnd

      // Call original method
      const result = originalEnd.apply(res, args)

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
          ip: req.ip || req.connection?.remoteAddress
        }
      })

      // Add performance headers
      if (!res.headersSent) {
        res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`)
      }

      return result
    }

    next()
  }
}

/**
 * Create Hono middleware
 */
export function createHonoMiddleware(
  monitor?: PerformanceMonitor,
  config?: PerformanceMonitorConfig
) {
  const perfMonitor = monitor || new PerformanceMonitor(config)

  return async (c: Context, next: Next) => {
    const timer = perfMonitor.startTimer()
    const operation = `${c.req.method} ${c.req.path}`

    try {
      await next()
    } finally {
      const duration = timer.stop()

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
          ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
        }
      })

      // Add performance headers
      c.header('X-Response-Time', `${duration.toFixed(2)}ms`)
    }
  }
}

/**
 * Create Koa middleware
 */
export function createKoaMiddleware(
  monitor?: PerformanceMonitor,
  config?: PerformanceMonitorConfig
) {
  const perfMonitor = monitor || new PerformanceMonitor(config)

  return async (ctx: KoaContext, next: KoaNext) => {
    const timer = perfMonitor.startTimer()
    const operation = `${ctx.method} ${ctx.path}`

    try {
      await next()
    } finally {
      const duration = timer.stop()

      perfMonitor.recordMetric({
        operation,
        duration,
        success: ctx.status < 400,
        timestamp: Date.now(),
        metadata: {
          path: ctx.path,
          method: ctx.method,
          statusCode: ctx.status,
          userAgent: ctx.request.header['user-agent'],
          ip: ctx.request.ip
        }
      })

      // Add performance headers
      ctx.set('X-Response-Time', `${duration.toFixed(2)}ms`)
    }
  }
}

/**
 * Create Fastify plugin
 */
export function createFastifyPlugin(
  monitor?: PerformanceMonitor,
  config?: PerformanceMonitorConfig
) {
  const perfMonitor = monitor || new PerformanceMonitor(config)

  return async function performancePlugin(fastify: FastifyInstance) {
    fastify.addHook('onRequest', async (request: FastifyRequest) => {
      request.performanceTimer = perfMonitor.startTimer()
    })

    fastify.addHook('onResponse', async (request: FastifyRequest, reply?: FastifyReply) => {
      if (request.performanceTimer) {
        const duration = request.performanceTimer.stop()
        const operation = `${request.method} ${request.routerPath || request.url}`

        perfMonitor.recordMetric({
          operation,
          duration,
          success: reply ? reply.statusCode < 400 : false,
          timestamp: Date.now(),
          metadata: {
            path: request.url,
            method: request.method,
            statusCode: reply?.statusCode ?? 0,
            userAgent: request.headers['user-agent'],
            ip: request.ip
          }
        })
      }
    })
  }
}

/**
 * Create performance stats endpoint handler
 */
export function createStatsHandler(monitor?: PerformanceMonitor) {
  const perfMonitor = monitor || new PerformanceMonitor()

  return (_req: unknown, res: ExpressResponse) => {
    const stats = perfMonitor.getStats()

    const response = {
      status: 'ok',
      timestamp: Date.now(),
      stats: stats || [],
      summary: calculateSummary(stats)
    }

    if (typeof res === 'object' && res !== null) {
      if (typeof res.json === 'function') {
        // Express-like
        res.json(response)
        return
      } else if (typeof res.end === 'function') {
        // Node.js raw
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(response))
        return
      }
    }

    // Return for custom handling
    return response
  }
}

/**
 * Calculate summary statistics
 */
function calculateSummary(stats: OperationStats | OperationStats[] | null): SummaryStats | null {
  if (!stats) {
    return null
  }

  const statsArray = Array.isArray(stats) ? stats : [stats]
  if (statsArray.length === 0) {
    return null
  }

  const totalRequests = statsArray.reduce((sum, stat) => sum + stat.count, 0)
  const totalErrors = statsArray.reduce((sum, stat) => sum + stat.errorCount, 0)
  const avgDuration =
    statsArray.reduce((sum, stat) => sum + stat.avgDuration * stat.count, 0) / totalRequests

  const slowestOperation = statsArray.reduce<OperationStats | null>(
    (slowest, stat) => (stat.maxDuration > (slowest?.maxDuration || 0) ? stat : slowest),
    null
  )

  const busiestOperation = statsArray.reduce<OperationStats | null>(
    (busiest, stat) => (stat.count > (busiest?.count || 0) ? stat : busiest),
    null
  )

  return {
    totalRequests,
    totalErrors,
    errorRate: totalErrors / totalRequests,
    avgDuration: Math.round(avgDuration),
    slowestOperation: slowestOperation?.operation,
    slowestDuration: slowestOperation?.maxDuration,
    busiestOperation: busiestOperation?.operation,
    busiestCount: busiestOperation?.count
  }
}

/**
 * Memory monitoring utilities
 */
export interface MemoryMetrics {
  heapUsed: number
  heapTotal: number
  external: number
  rss: number
}

export function getMemoryMetrics(): MemoryMetrics {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage()
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024)
    }
  }

  // Fallback for browser environments
  if (typeof performance !== 'undefined' && 'memory' in performance) {
    const memory = (performance as PerformanceWithMemory).memory
    return {
      heapUsed: Math.round(memory.usedJSHeapSize / 1024 / 1024),
      heapTotal: Math.round(memory.totalJSHeapSize / 1024 / 1024),
      external: 0,
      rss: 0
    }
  }

  return {
    heapUsed: 0,
    heapTotal: 0,
    external: 0,
    rss: 0
  }
}
