/**
 * Service Handler for Processing RPC Requests
 *
 * Implements the server-side of RPC calls with type safety
 * Includes middleware support, error handling, and metrics
 *
 * @module services/remote-bindings/service-handler
 */

import type { ILogger } from '../../core/interfaces/logger'
import { FieldMapper } from '../../lib/field-mapper'

import type {
  MetricsCollector,
  RpcError,
  RpcRequest,
  RpcResponse,
  ServiceContext,
  ServiceDefinition,
  ServiceMethodRegistry,
  ServiceMetrics,
  ServiceMiddleware
} from './types'

/**
 * Metrics collector implementation
 */
class SimpleMetricsCollector implements MetricsCollector {
  private metrics = {
    calls: 0,
    successes: 0,
    failures: 0,
    retries: 0,
    latencies: [] as number[],
    errors: new Map<string, number>()
  }

  // Create mapper for ServiceMetrics (initialized in method)
  private metricsMapper: ReturnType<typeof this.createMetricsMapper> | null = null

  recordLatency(_service: string, _method: string, duration: number): void {
    this.metrics.latencies.push(duration)
    // Keep only last 1000 latencies
    if (this.metrics.latencies.length > 1000) {
      this.metrics.latencies.shift()
    }
  }

  recordSuccess(_service: string, _method: string): void {
    this.metrics.calls++
    this.metrics.successes++
  }

  recordFailure(_service: string, method: string, error: Error): void {
    this.metrics.calls++
    this.metrics.failures++

    const errorKey = `${method}:${error.message}`
    const count = this.metrics.errors.get(errorKey) ?? 0
    this.metrics.errors.set(errorKey, count + 1)
  }

  recordRetry(_service: string, _method: string): void {
    this.metrics.retries++
  }

  private createMetricsMapper() {
    type MetricsType = {
      calls: number
      successes: number
      failures: number
      retries: number
      latencies: number[]
      errors: Map<string, number>
    }

    type MetricsInput = {
      metrics: MetricsType
      latencies: number[]
      p95Index: number
      p99Index: number
    }

    return FieldMapper.create<MetricsInput, ServiceMetrics>()
      .map(src => src.metrics.calls, 'calls')
      .map(src => src.metrics.successes, 'successes')
      .map(src => src.metrics.failures, 'failures')
      .map(src => src.metrics.retries, 'retries')
      .compute('avgLatency', src =>
        src.latencies.length > 0
          ? src.latencies.reduce((a, b) => a + b, 0) / src.latencies.length
          : 0
      )
      .compute('p95Latency', src => src.latencies[src.p95Index] ?? 0)
      .compute('p99Latency', src => src.latencies[src.p99Index] ?? 0)
      .compute('errorRate', src =>
        src.metrics.calls > 0 ? src.metrics.failures / src.metrics.calls : 0
      )
      .build()
  }

  getMetrics(): ServiceMetrics {
    if (!this.metricsMapper) {
      this.metricsMapper = this.createMetricsMapper()
    }

    const latencies = [...this.metrics.latencies].sort((a, b) => a - b)
    const p95Index = Math.floor(latencies.length * 0.95)
    const p99Index = Math.floor(latencies.length * 0.99)

    // Use FieldMapper for consistent transformation
    return this.metricsMapper({
      metrics: this.metrics,
      latencies,
      p95Index,
      p99Index
    })
  }

  reset(): void {
    this.metrics = {
      calls: 0,
      successes: 0,
      failures: 0,
      retries: 0,
      latencies: [],
      errors: new Map()
    }
  }
}

/**
 * Service handler for processing RPC requests
 */
export class ServiceHandler<T extends ServiceMethodRegistry = ServiceMethodRegistry> {
  private readonly definition: ServiceDefinition<T>
  private readonly logger?: ILogger
  private readonly middleware: ServiceMiddleware[]
  private readonly metrics: MetricsCollector
  private readonly env: Record<string, unknown>

  // Create mapper for ServiceContext (initialized on first use)
  private contextMapper: ReturnType<typeof this.createContextMapper> | null = null

  constructor(
    definition: ServiceDefinition<T>,
    options: {
      logger?: ILogger
      env?: Record<string, unknown>
      metrics?: MetricsCollector
    } = {}
  ) {
    this.definition = definition
    this.logger = options.logger
    this.env = options.env ?? {}
    this.middleware = definition.middleware ?? []
    this.metrics = options.metrics ?? new SimpleMetricsCollector()
  }

  /**
   * Handle incoming HTTP request
   */
  async handleRequest(request: Request): Promise<Response> {
    // Parse RPC request from HTTP
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    try {
      const rpcRequest: RpcRequest = await request.json()
      const response = await this.handleRpcRequest(rpcRequest, request)

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': rpcRequest.id
        }
      })
    } catch (error) {
      const err = error as Error
      this.logger?.error('Failed to handle request', { error: err.message })

      return new Response(
        JSON.stringify({
          error: {
            code: -32603,
            message: 'Internal error',
            data: err.message
          }
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  }

  /**
   * Handle RPC request
   */
  async handleRpcRequest(request: RpcRequest, httpRequest?: Request): Promise<RpcResponse> {
    const startTime = Date.now()
    const context = this.createContext(request, httpRequest)

    this.logger?.debug('Processing RPC request', {
      id: request.id,
      method: request.method
    })

    try {
      // Apply before middleware
      for (const mw of this.middleware) {
        if (mw.beforeCall) {
          await mw.beforeCall(request, context)
        }
      }

      // Handle batch requests
      if (request.method === 'batch' && Array.isArray(request.params)) {
        const results = await this.handleBatch(request.params as RpcRequest[], context)

        // Extract just the results for batch response
        const batchResults = results.map(r => r.result)

        // Record success for batch
        this.metrics.recordSuccess(this.definition.name, request.method)
        this.metrics.recordLatency(this.definition.name, request.method, Date.now() - startTime)

        return this.createResponse(request.id, batchResults, undefined, startTime)
      }

      // Find and execute method handler
      const handler = this.definition.methods[request.method as keyof T]
      if (!handler) {
        throw new Error(`Method not found: ${request.method}`)
      }

      const result = await handler(request.params, context)

      // Record success
      this.metrics.recordSuccess(this.definition.name, request.method)
      this.metrics.recordLatency(this.definition.name, request.method, Date.now() - startTime)

      const response = this.createResponse(request.id, result, undefined, startTime)

      // Apply after middleware
      for (const mw of this.middleware) {
        if (mw.afterCall) {
          await mw.afterCall(request, response, context)
        }
      }

      return response
    } catch (error) {
      const err = error as Error

      // Record failure
      this.metrics.recordFailure(this.definition.name, request.method, err)

      // Apply error middleware
      let rpcError: RpcError | undefined
      for (const mw of this.middleware) {
        if (mw.onError) {
          const result = await mw.onError(request, err, context)
          if (result) {
            rpcError = result
            break
          }
        }
      }

      if (!rpcError) {
        rpcError = {
          code: -32603,
          message: err.message,
          data: {
            stack: err.stack,
            name: err.name
          }
        }
      }

      this.logger?.error('RPC method failed', {
        id: request.id,
        method: request.method,
        error: err.message
      })

      return this.createResponse(request.id, undefined, rpcError, startTime)
    }
  }

  /**
   * Handle batch of requests
   */
  private async handleBatch(
    requests: RpcRequest[],
    _context: ServiceContext
  ): Promise<RpcResponse[]> {
    const results = await Promise.allSettled(requests.map(req => this.handleRpcRequest(req)))

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return this.createResponse(
          requests[index]?.id ?? 'unknown',
          undefined,
          {
            code: -32603,
            message: result.reason?.message ?? 'Unknown error'
          },
          Date.now()
        )
      }
    })
  }

  private createContextMapper() {
    type ContextInput = {
      request: RpcRequest
      httpRequest?: Request
      waitUntilPromises: Promise<unknown>[]
    }

    return FieldMapper.create<ContextInput, ServiceContext>()
      .compute('requestId', src => src.request.id)
      .compute('method', src => src.request.method)
      .compute('metadata', src => this.mergeMetadata(src.request.metadata, src.httpRequest) ?? {})
      .compute('env', () => this.env)
      .compute('logger', () => this.logger)
      .compute('waitUntil', src => (promise: Promise<unknown>) => {
        src.waitUntilPromises.push(promise)
      })
      .build()
  }

  /**
   * Create service context
   */
  private createContext(request: RpcRequest, httpRequest?: Request): ServiceContext {
    if (!this.contextMapper) {
      this.contextMapper = this.createContextMapper()
    }

    const waitUntilPromises: Promise<unknown>[] = []

    // Use FieldMapper for consistent transformation
    return this.contextMapper({
      request,
      httpRequest,
      waitUntilPromises
    })
  }

  private mergeMetadata(
    requestMetadata?: Record<string, unknown>,
    httpRequest?: Request
  ): Record<string, unknown> {
    const base = requestMetadata ?? {}

    if (!httpRequest) {
      return base
    }

    return {
      ...base,
      headers: Object.fromEntries(httpRequest.headers.entries()),
      url: httpRequest.url
    }
  }

  /**
   * Create RPC response
   */
  private createResponse(
    id: string,
    result?: unknown,
    error?: RpcError,
    startTime?: number
  ): RpcResponse {
    return {
      id,
      result,
      error,
      timestamp: Date.now(),
      duration: startTime ? Date.now() - startTime : undefined,
      metadata: {
        service: this.definition.name,
        version: this.definition.version
      }
    }
  }

  /**
   * Get service metrics
   */
  getMetrics(): ServiceMetrics {
    return this.metrics.getMetrics()
  }

  /**
   * Export service definition for discovery
   */
  exportDefinition(): {
    name: string
    version: string
    methods: string[]
  } {
    return {
      name: this.definition.name,
      version: this.definition.version,
      methods: Object.keys(this.definition.methods)
    }
  }
}

/**
 * Create a typed service handler
 */
export function createServiceHandler<T extends ServiceMethodRegistry>(
  definition: ServiceDefinition<T>,
  options?: {
    logger?: ILogger
    env?: Record<string, unknown>
    metrics?: MetricsCollector
  }
): ServiceHandler<T> {
  return new ServiceHandler<T>(definition, options)
}

/**
 * Rate limiting middleware
 */
export class RateLimitMiddleware implements ServiceMiddleware {
  name = 'rateLimit'
  private requests = new Map<string, number[]>()

  constructor(
    private limit: number,
    private window: number // milliseconds
  ) {}

  async beforeCall(_request: RpcRequest, context: ServiceContext): Promise<void> {
    const clientId = this.getClientId(context)
    const now = Date.now()

    // Get existing requests for this client
    const clientRequests = this.requests.get(clientId) ?? []

    // Filter out old requests outside the window
    const recentRequests = clientRequests.filter(time => now - time < this.window)

    // Check rate limit
    if (recentRequests.length >= this.limit) {
      throw new Error(`Rate limit exceeded: ${this.limit} requests per ${this.window}ms`)
    }

    // Add current request
    recentRequests.push(now)
    this.requests.set(clientId, recentRequests)

    // Clean up old entries periodically
    if (Math.random() < 0.01) {
      // 1% chance
      this.cleanup()
    }
  }

  private getClientId(context: ServiceContext): string {
    // Use IP or auth token as client identifier
    return (context.metadata.clientId as string) ?? (context.metadata.ip as string) ?? 'unknown'
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [clientId, requests] of this.requests) {
      const recent = requests.filter(time => now - time < this.window)
      if (recent.length === 0) {
        this.requests.delete(clientId)
      } else {
        this.requests.set(clientId, recent)
      }
    }
  }
}

/**
 * Validation middleware
 */
export class ValidationMiddleware implements ServiceMiddleware {
  name = 'validation'

  constructor(private validators: Map<string, (params: unknown) => boolean>) {}

  async beforeCall(request: RpcRequest, _context: ServiceContext): Promise<void> {
    const validator = this.validators.get(request.method)
    if (validator && !validator(request.params)) {
      throw new Error(`Invalid parameters for method: ${request.method}`)
    }
  }
}

/**
 * Caching middleware
 */
export class CachingMiddleware implements ServiceMiddleware {
  name = 'caching'
  private cache = new Map<string, { result: unknown; expires: number }>()

  constructor(
    private ttl: number, // milliseconds
    private cacheable: Set<string>
  ) {}

  async beforeCall(request: RpcRequest, _context: ServiceContext): Promise<void> {
    if (!this.cacheable.has(request.method)) {
      return
    }

    const cacheKey = this.getCacheKey(request)
    const cached = this.cache.get(cacheKey)

    if (cached && cached.expires > Date.now()) {
      // Return cached result by throwing special error
      throw {
        cached: true,
        result: cached.result
      }
    }
  }

  async afterCall(
    request: RpcRequest,
    response: RpcResponse,
    _context: ServiceContext
  ): Promise<void> {
    if (!this.cacheable.has(request.method) || response.error) {
      return
    }

    const cacheKey = this.getCacheKey(request)
    this.cache.set(cacheKey, {
      result: response.result,
      expires: Date.now() + this.ttl
    })

    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
      // 1% chance
      this.cleanup()
    }
  }

  private getCacheKey(request: RpcRequest): string {
    return `${request.method}:${JSON.stringify(request.params)}`
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, value] of this.cache) {
      if (value.expires < now) {
        this.cache.delete(key)
      }
    }
  }
}
