/**
 * Type-Safe Service Client for Remote Bindings
 *
 * Provides type-safe RPC calls to remote Cloudflare Workers
 * Includes retry logic, circuit breaker, and middleware support
 *
 * @module services/remote-bindings/service-client
 */

import type { ILogger } from '../../core/interfaces/logger'

import type {
  CircuitBreakerConfig,
  CircuitState,
  ClientMiddleware,
  Fetcher,
  MethodParams,
  MethodResult,
  RpcRequest,
  RpcResponse,
  ServiceBinding,
  ServiceClientConfig,
  ServiceMethodRegistry,
  TracingContext
} from './types'

/**
 * Circuit breaker implementation
 */
class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failureCount = 0
  private lastFailureTime?: number
  private successCount = 0
  private readonly config: Required<CircuitBreakerConfig>

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeout: config.resetTimeout ?? 60000, // 1 minute
      halfOpenCalls: config.halfOpenCalls ?? 3,
      onOpen: config.onOpen ?? (() => {}),
      onClose: config.onClose ?? (() => {}),
      onHalfOpen: config.onHalfOpen ?? (() => {})
    }
  }

  async execute<T>(serviceName: string, operation: () => Promise<T>): Promise<T> {
    // Check if circuit should transition from open to half-open
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - (this.lastFailureTime ?? 0)
      if (timeSinceLastFailure > this.config.resetTimeout) {
        this.transitionTo('half-open', serviceName)
      } else {
        throw new Error(`Circuit breaker is open for service: ${serviceName}`)
      }
    }

    try {
      const result = await operation()
      this.onSuccess(serviceName)
      return result
    } catch (error) {
      this.onFailure(serviceName)
      throw error
    }
  }

  private onSuccess(serviceName: string): void {
    if (this.state === 'half-open') {
      this.successCount++
      if (this.successCount >= this.config.halfOpenCalls) {
        this.transitionTo('closed', serviceName)
      }
    } else if (this.state === 'closed') {
      this.failureCount = 0
    }
  }

  private onFailure(serviceName: string): void {
    this.lastFailureTime = Date.now()

    if (this.state === 'half-open') {
      this.transitionTo('open', serviceName)
    } else if (this.state === 'closed') {
      this.failureCount++
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionTo('open', serviceName)
      }
    }
  }

  private transitionTo(newState: CircuitState, serviceName: string): void {
    this.state = newState

    if (newState === 'open') {
      this.config.onOpen(serviceName)
    } else if (newState === 'closed') {
      this.failureCount = 0
      this.successCount = 0
      this.config.onClose(serviceName)
    } else if (newState === 'half-open') {
      this.successCount = 0
      this.config.onHalfOpen(serviceName)
    }
  }

  getState(): CircuitState {
    return this.state
  }
}

/**
 * Type-safe service client implementation
 */
export class ServiceClient<T extends ServiceMethodRegistry = ServiceMethodRegistry>
  implements ServiceBinding<T>
{
  private readonly binding: Fetcher
  private readonly timeout: number
  private readonly retries: number
  private readonly retryDelay: number
  private readonly logger?: ILogger
  private readonly middleware: ClientMiddleware[]
  private readonly circuitBreaker: CircuitBreaker
  private requestCounter = 0

  constructor(config: ServiceClientConfig) {
    this.binding = config.binding as Fetcher
    this.timeout = config.timeout ?? 30000 // 30 seconds
    this.retries = config.retries ?? 3
    this.retryDelay = config.retryDelay ?? 1000 // 1 second
    this.logger = config.logger
    this.middleware = config.middleware ?? []

    this.circuitBreaker = new CircuitBreaker({
      onOpen: service => {
        this.logger?.warn('Circuit breaker opened', { service })
      },
      onClose: service => {
        this.logger?.info('Circuit breaker closed', { service })
      },
      onHalfOpen: service => {
        this.logger?.info('Circuit breaker half-open', { service })
      }
    })
  }

  /**
   * Call a remote service method
   */
  async call<M extends keyof T>(
    method: M,
    params: MethodParams<T, M>
  ): Promise<MethodResult<T, M>> {
    const request: RpcRequest<M & string, MethodParams<T, M>> = {
      id: this.generateRequestId(),
      method: method as M & string,
      params,
      timestamp: Date.now()
    }

    const response = await this.executeWithRetry(request)

    if (response.error) {
      throw new Error(response.error.message)
    }

    return response.result as MethodResult<T, M>
  }

  /**
   * Call with metadata for additional context
   */
  async callWithMetadata<M extends keyof T>(
    method: M,
    params: MethodParams<T, M>,
    metadata: Record<string, unknown>
  ): Promise<{
    result: MethodResult<T, M>
    metadata: Record<string, unknown>
  }> {
    const request: RpcRequest<M & string, MethodParams<T, M>> = {
      id: this.generateRequestId(),
      method: method as M & string,
      params,
      metadata,
      timestamp: Date.now()
    }

    const response = await this.executeWithRetry(request)

    if (response.error) {
      throw new Error(response.error.message)
    }

    return {
      result: response.result as MethodResult<T, M>,
      metadata: response.metadata ?? {}
    }
  }

  /**
   * Batch multiple calls for efficiency
   */
  async batch<M extends keyof T>(
    calls: Array<{
      method: M
      params: MethodParams<T, M>
    }>
  ): Promise<Array<MethodResult<T, M>>> {
    const requests = calls.map(call => ({
      id: this.generateRequestId(),
      method: call.method as string,
      params: call.params,
      timestamp: Date.now()
    }))

    const batchRequest: RpcRequest<'batch', typeof requests> = {
      id: this.generateRequestId(),
      method: 'batch',
      params: requests,
      timestamp: Date.now()
    }

    const response = await this.executeWithRetry(batchRequest)

    if (response.error) {
      throw new Error(response.error.message)
    }

    return response.result as Array<MethodResult<T, M>>
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry(request: RpcRequest): Promise<RpcResponse> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        // Apply circuit breaker
        return await this.circuitBreaker.execute('service', () => this.executeRequest(request))
      } catch (error) {
        lastError = error as Error

        this.logger?.warn('Request failed, retrying...', {
          attempt,
          method: request.method,
          error: lastError.message
        })

        if (attempt < this.retries) {
          // Exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError ?? new Error('Request failed after retries')
  }

  /**
   * Execute single request
   */
  private async executeRequest(request: RpcRequest): Promise<RpcResponse> {
    const startTime = Date.now()

    // Apply request middleware
    let processedRequest = request
    for (const mw of this.middleware) {
      if (mw.beforeRequest) {
        processedRequest = await mw.beforeRequest(processedRequest)
      }
    }

    // Create HTTP request
    const httpRequest = new Request('https://rpc.internal/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': processedRequest.id,
        'X-RPC-Method': processedRequest.method
      },
      body: JSON.stringify(processedRequest)
    })

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${this.timeout}ms`))
      }, this.timeout)
    })

    try {
      // Race between request and timeout
      const httpResponse = (await Promise.race([
        this.binding.fetch(httpRequest),
        timeoutPromise
      ])) as Response

      if (!httpResponse.ok) {
        throw new Error(`HTTP ${httpResponse.status}: ${httpResponse.statusText}`)
      }

      let response: RpcResponse = await httpResponse.json()

      // Add duration
      response.duration = Date.now() - startTime

      // Apply response middleware
      for (const mw of this.middleware) {
        if (mw.afterResponse) {
          response = await mw.afterResponse(response)
        }
      }

      this.logger?.debug('RPC call completed', {
        method: request.method,
        duration: response.duration
      })

      return response
    } catch (error) {
      // Apply error middleware
      let processedError = error as Error
      for (const mw of this.middleware) {
        if (mw.onError) {
          processedError = await mw.onError(processedError)
        }
      }

      this.logger?.error('RPC call failed', {
        method: request.method,
        error: processedError.message,
        duration: Date.now() - startTime
      })

      throw processedError
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    this.requestCounter++
    return `req-${Date.now()}-${this.requestCounter}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(): CircuitState {
    return this.circuitBreaker.getState()
  }

  /**
   * Create tracing context for distributed tracing
   */
  createTracingContext(): TracingContext {
    return {
      traceId: this.generateTraceId(),
      spanId: this.generateSpanId(),
      flags: 1, // Sampled
      baggage: {}
    }
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * Generate span ID
   */
  private generateSpanId(): string {
    const bytes = new Uint8Array(8)
    crypto.getRandomValues(bytes)
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
}

/**
 * Create a typed service client
 */
export function createServiceClient<T extends ServiceMethodRegistry>(
  config: ServiceClientConfig
): ServiceClient<T> {
  return new ServiceClient<T>(config)
}

/**
 * Authentication middleware
 */
export class AuthMiddleware implements ClientMiddleware {
  name = 'auth'

  constructor(private token: string) {}

  async beforeRequest(request: RpcRequest): Promise<RpcRequest> {
    return {
      ...request,
      metadata: {
        ...request.metadata,
        authorization: `Bearer ${this.token}`
      }
    }
  }
}

/**
 * Logging middleware
 */
export class LoggingMiddleware implements ClientMiddleware {
  name = 'logging'

  constructor(private logger: ILogger) {}

  async beforeRequest(request: RpcRequest): Promise<RpcRequest> {
    this.logger.debug('Sending RPC request', {
      id: request.id,
      method: request.method
    })
    return request
  }

  async afterResponse(response: RpcResponse): Promise<RpcResponse> {
    this.logger.debug('Received RPC response', {
      id: response.id,
      duration: response.duration,
      hasError: !!response.error
    })
    return response
  }

  async onError(error: Error): Promise<Error> {
    this.logger.error('RPC error', { error: error.message })
    return error
  }
}

/**
 * Retry middleware with custom logic
 */
export class RetryMiddleware implements ClientMiddleware {
  name = 'retry'

  constructor(private shouldRetry: (error: Error) => boolean) {}

  async onError(error: Error): Promise<Error> {
    if (!this.shouldRetry(error)) {
      // Mark error as non-retryable
      ;(error as Error & { nonRetryable?: boolean }).nonRetryable = true
    }
    return error
  }
}
