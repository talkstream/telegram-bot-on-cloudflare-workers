/**
 * Remote Bindings Type System
 *
 * Type-safe service-to-service communication for Cloudflare Workers
 * Supports Service Bindings, Durable Objects, and RPC calls
 *
 * @module services/remote-bindings/types
 */

import type { ILogger } from '../../core/interfaces/logger'

/**
 * Base request/response types for RPC calls
 */
export interface RpcRequest<TMethod extends string = string, TParams = unknown> {
  id: string
  method: TMethod
  params: TParams
  metadata?: Record<string, unknown>
  timestamp: number
}

export interface RpcResponse<TResult = unknown> {
  id: string
  result?: TResult
  error?: RpcError
  metadata?: Record<string, unknown>
  timestamp: number
  duration?: number
}

export interface RpcError {
  code: number
  message: string
  data?: unknown
}

/**
 * Service method registry for type-safe RPC
 */
export interface ServiceMethodRegistry {
  [method: string]: {
    params: unknown
    result: unknown
  }
}

/**
 * Extract method names from registry
 */
export type ServiceMethods<T extends ServiceMethodRegistry> = keyof T & string

/**
 * Extract params type for a method
 */
export type MethodParams<T extends ServiceMethodRegistry, M extends keyof T> = T[M]['params']

/**
 * Extract result type for a method
 */
export type MethodResult<T extends ServiceMethodRegistry, M extends keyof T> = T[M]['result']

/**
 * Service binding interface for Cloudflare Workers
 */
export interface ServiceBinding<T extends ServiceMethodRegistry = ServiceMethodRegistry> {
  call<M extends keyof T>(method: M, params: MethodParams<T, M>): Promise<MethodResult<T, M>>

  callWithMetadata<M extends keyof T>(
    method: M,
    params: MethodParams<T, M>,
    metadata: Record<string, unknown>
  ): Promise<{
    result: MethodResult<T, M>
    metadata: Record<string, unknown>
  }>

  batch<M extends keyof T>(
    calls: Array<{
      method: M
      params: MethodParams<T, M>
    }>
  ): Promise<Array<MethodResult<T, M>>>
}

/**
 * Durable Object namespace binding
 */
export interface DurableObjectBinding<T extends ServiceMethodRegistry = ServiceMethodRegistry> {
  get(id: DurableObjectId | string): DurableObjectStub<T>
  newUniqueId(): DurableObjectId
  idFromName(name: string): DurableObjectId
  idFromString(hexString: string): DurableObjectId
}

/**
 * Durable Object ID interface
 */
export interface DurableObjectId {
  toString(): string
  equals(other: DurableObjectId): boolean
}

/**
 * Durable Object stub for RPC calls
 */
export interface DurableObjectStub<T extends ServiceMethodRegistry = ServiceMethodRegistry> {
  id: DurableObjectId
  name?: string

  call<M extends keyof T>(method: M, params: MethodParams<T, M>): Promise<MethodResult<T, M>>

  fetch(request: Request): Promise<Response>
}

/**
 * Service definition for implementing RPC handlers
 */
export interface ServiceDefinition<T extends ServiceMethodRegistry = ServiceMethodRegistry> {
  name: string
  version: string
  methods: {
    [M in keyof T]: ServiceMethodHandler<MethodParams<T, M>, MethodResult<T, M>>
  }
  middleware?: ServiceMiddleware[]
}

/**
 * Service method handler
 */
export interface ServiceMethodHandler<TParams = unknown, TResult = unknown> {
  (params: TParams, context: ServiceContext): Promise<TResult> | TResult
}

/**
 * Service execution context
 */
export interface ServiceContext {
  requestId: string
  method: string
  metadata: Record<string, unknown>
  env: Record<string, unknown>
  logger?: ILogger
  waitUntil: (promise: Promise<unknown>) => void
}

/**
 * Service middleware for cross-cutting concerns
 */
export interface ServiceMiddleware {
  name: string

  beforeCall?(request: RpcRequest, context: ServiceContext): Promise<void> | void

  afterCall?(
    request: RpcRequest,
    response: RpcResponse,
    context: ServiceContext
  ): Promise<void> | void

  onError?(
    request: RpcRequest,
    error: Error,
    context: ServiceContext
  ): Promise<RpcError | void> | RpcError | void
}

/**
 * Service client configuration
 */
export interface ServiceClientConfig {
  binding: Fetcher | DurableObjectNamespace
  timeout?: number
  retries?: number
  retryDelay?: number
  logger?: ILogger
  middleware?: ClientMiddleware[]
}

/**
 * Client middleware for request/response transformation
 */
export interface ClientMiddleware {
  name: string

  beforeRequest?(request: RpcRequest): Promise<RpcRequest> | RpcRequest

  afterResponse?(response: RpcResponse): Promise<RpcResponse> | RpcResponse

  onError?(error: Error): Promise<Error> | Error
}

/**
 * Service discovery interface
 */
export interface ServiceDiscovery {
  register(service: ServiceRegistration): Promise<void>
  discover(name: string): Promise<ServiceInfo | null>
  list(): Promise<ServiceInfo[]>
  health(name: string): Promise<HealthStatus>
}

/**
 * Service registration data
 */
export interface ServiceRegistration {
  name: string
  version: string
  url?: string
  binding?: string
  methods: string[]
  metadata?: Record<string, unknown>
}

/**
 * Service information
 */
export interface ServiceInfo extends ServiceRegistration {
  id: string
  registeredAt: Date
  lastHealthCheck?: Date
  status: 'active' | 'inactive' | 'unhealthy'
}

/**
 * Health check status
 */
export interface HealthStatus {
  healthy: boolean
  latency?: number
  lastCheck: Date
  details?: Record<string, unknown>
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeout: number
  halfOpenCalls: number
  onOpen?: (serviceName: string) => void
  onClose?: (serviceName: string) => void
  onHalfOpen?: (serviceName: string) => void
}

/**
 * Circuit breaker state
 */
export type CircuitState = 'closed' | 'open' | 'half-open'

/**
 * Load balancing strategy
 */
export type LoadBalancingStrategy =
  | 'round-robin'
  | 'random'
  | 'least-connections'
  | 'weighted'
  | 'consistent-hash'

/**
 * Load balancer configuration
 */
export interface LoadBalancerConfig {
  strategy: LoadBalancingStrategy
  healthCheck?: {
    interval: number
    timeout: number
    unhealthyThreshold: number
    healthyThreshold: number
  }
  weights?: Map<string, number>
}

/**
 * Tracing context for distributed tracing
 */
export interface TracingContext {
  traceId: string
  spanId: string
  parentSpanId?: string
  flags: number
  baggage?: Record<string, string>
}

/**
 * Metrics collector interface
 */
export interface MetricsCollector {
  recordLatency(service: string, method: string, duration: number): void
  recordSuccess(service: string, method: string): void
  recordFailure(service: string, method: string, error: Error): void
  recordRetry(service: string, method: string): void
  getMetrics(): ServiceMetrics
}

/**
 * Service metrics
 */
export interface ServiceMetrics {
  calls: number
  successes: number
  failures: number
  retries: number
  avgLatency: number
  p95Latency: number
  p99Latency: number
  errorRate: number
}

/**
 * Type helper for creating typed service bindings
 */
export type TypedServiceBinding<T extends ServiceMethodRegistry> = ServiceBinding<T>

/**
 * Type helper for creating typed Durable Object bindings
 */
export type TypedDurableObjectBinding<T extends ServiceMethodRegistry> = DurableObjectBinding<T>

/**
 * Fetcher interface (Cloudflare Worker binding)
 */
export interface Fetcher {
  fetch(request: Request): Promise<Response>
}
