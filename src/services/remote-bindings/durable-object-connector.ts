/**
 * Durable Object Connector for State Management
 *
 * Type-safe wrapper for Cloudflare Durable Objects
 * Provides state persistence, WebSocket support, and RPC calls
 *
 * @module services/remote-bindings/durable-object-connector
 */

import type { ILogger } from '../../core/interfaces/logger'

import { ServiceHandler } from './service-handler'
import type {
  DurableObjectBinding,
  DurableObjectId,
  DurableObjectStub,
  MethodParams,
  MethodResult,
  RpcRequest,
  RpcResponse,
  ServiceDefinition,
  ServiceMethodRegistry
} from './types'

/**
 * Base Durable Object class with RPC support
 */
export abstract class TypedDurableObject<T extends ServiceMethodRegistry = ServiceMethodRegistry> {
  protected state: DurableObjectState
  protected env: Record<string, unknown>
  protected logger?: ILogger
  protected serviceHandler: ServiceHandler<T>
  protected websockets = new Set<WebSocket>()

  constructor(state: DurableObjectState, env: Record<string, unknown>) {
    this.state = state
    this.env = env

    // Initialize service handler with object's methods
    this.serviceHandler = new ServiceHandler<T>(this.getServiceDefinition(), {
      env,
      logger: this.logger
    })

    // Block concurrency for consistency
    state.blockConcurrencyWhile(async () => {
      await this.initialize()
    })
  }

  /**
   * Get service definition for RPC handling
   */
  protected abstract getServiceDefinition(): ServiceDefinition<T>

  /**
   * Initialize the Durable Object
   */
  protected async initialize(): Promise<void> {
    // Override in subclass for custom initialization
  }

  /**
   * Handle HTTP requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request)
    }

    // Handle RPC calls
    if (url.pathname === '/rpc' || url.pathname === '/call') {
      return this.serviceHandler.handleRequest(request)
    }

    // Handle custom routes
    return this.handleCustomRequest(request)
  }

  /**
   * Handle custom HTTP requests
   */
  protected async handleCustomRequest(_request: Request): Promise<Response> {
    return new Response('Not found', { status: 404 })
  }

  /**
   * Handle WebSocket upgrade
   */
  protected handleWebSocketUpgrade(_request: Request): Response {
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    this.state.acceptWebSocket(server)
    this.websockets.add(server)

    server.addEventListener('message', (event: MessageEvent) => {
      this.handleWebSocketMessage(server, event)
    })

    server.addEventListener('close', () => {
      this.websockets.delete(server)
    })

    return new Response(null, {
      status: 101,
      webSocket: client
    })
  }

  /**
   * Handle WebSocket messages
   */
  protected async handleWebSocketMessage(ws: WebSocket, event: MessageEvent): Promise<void> {
    try {
      const message = JSON.parse(event.data as string)

      // Handle as RPC request
      if (message.method && message.params) {
        const request: RpcRequest = {
          id: message.id ?? this.generateId(),
          method: message.method,
          params: message.params,
          timestamp: Date.now()
        }

        const response = await this.serviceHandler.handleRpcRequest(request)
        ws.send(JSON.stringify(response))
      }
    } catch (error) {
      const err = error as Error
      this.logger?.error('WebSocket message error', { error: err.message })

      ws.send(
        JSON.stringify({
          error: {
            code: -32700,
            message: 'Parse error'
          }
        })
      )
    }
  }

  /**
   * Broadcast to all connected WebSockets
   */
  protected broadcast(message: unknown): void {
    const data = JSON.stringify(message)

    for (const ws of this.websockets) {
      try {
        ws.send(data)
      } catch (error) {
        this.logger?.error('Broadcast error', { error })
        this.websockets.delete(ws)
      }
    }
  }

  /**
   * Get persistent storage
   */
  protected get storage(): DurableObjectStorage {
    return this.state.storage
  }

  /**
   * Store state with automatic serialization
   */
  protected async setState<K extends string>(key: K, value: unknown): Promise<void> {
    await this.storage.put(key, JSON.stringify(value))
  }

  /**
   * Get state with automatic deserialization
   */
  protected async getState<V = unknown>(key: string): Promise<V | undefined> {
    const value = await this.storage.get(key)
    if (value === undefined) return undefined

    try {
      return JSON.parse(value as string) as V
    } catch {
      return value as V
    }
  }

  /**
   * Delete state
   */
  protected async deleteState(key: string): Promise<void> {
    await this.storage.delete(key)
  }

  /**
   * List all state keys
   */
  protected async listStateKeys(options?: { prefix?: string; limit?: number }): Promise<string[]> {
    const keys: string[] = []
    const list = await this.storage.list(options)

    for (const [key] of list) {
      keys.push(key)
    }

    return keys
  }

  /**
   * Set alarm for scheduled tasks
   */
  protected async setAlarm(delayMs: number): Promise<void> {
    const alarmTime = Date.now() + delayMs
    await this.storage.setAlarm(alarmTime)
  }

  /**
   * Handle alarm trigger
   */
  async alarm(): Promise<void> {
    // Override in subclass
    this.logger?.debug('Alarm triggered')
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * Durable Object client for type-safe interaction
 */
export class DurableObjectClient<T extends ServiceMethodRegistry = ServiceMethodRegistry> {
  private stub: DurableObjectStub<T>
  private logger?: ILogger

  constructor(stub: DurableObjectStub<T>, logger?: ILogger) {
    this.stub = stub
    this.logger = logger
  }

  /**
   * Call a method on the Durable Object
   */
  async call<M extends keyof T>(
    method: M,
    params: MethodParams<T, M>
  ): Promise<MethodResult<T, M>> {
    const request: RpcRequest = {
      id: this.generateRequestId(),
      method: method as string,
      params,
      timestamp: Date.now()
    }

    const httpRequest = new Request('https://do.internal/rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    })

    try {
      const httpResponse = await this.stub.fetch(httpRequest)

      if (!httpResponse.ok) {
        throw new Error(`HTTP ${httpResponse.status}: ${httpResponse.statusText}`)
      }

      const response: RpcResponse = await httpResponse.json()

      if (response.error) {
        throw new Error(response.error.message)
      }

      return response.result as MethodResult<T, M>
    } catch (error) {
      const err = error as Error
      this.logger?.error('Durable Object call failed', {
        method: method as string,
        error: err.message
      })
      throw err
    }
  }

  /**
   * Connect via WebSocket for real-time communication
   */
  async connect(): Promise<DurableObjectWebSocket<T>> {
    const response = await this.stub.fetch(
      new Request('https://do.internal/ws', {
        headers: {
          Upgrade: 'websocket'
        }
      })
    )

    const ws = response.webSocket
    if (!ws) {
      throw new Error('WebSocket upgrade failed')
    }

    return new DurableObjectWebSocket<T>(ws, this.logger)
  }

  /**
   * Get the Durable Object ID
   */
  getId(): DurableObjectId {
    return this.stub.id
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `do-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * WebSocket wrapper for Durable Object communication
 */
export class DurableObjectWebSocket<T extends ServiceMethodRegistry = ServiceMethodRegistry> {
  private ws: WebSocket
  private logger?: ILogger
  private listeners = new Map<string, (response: RpcResponse) => void>()
  private eventHandlers = new Map<string, Set<(data: unknown) => void>>()

  constructor(ws: WebSocket, logger?: ILogger) {
    this.ws = ws
    this.logger = logger

    ws.addEventListener('message', event => {
      this.handleMessage(event)
    })

    ws.addEventListener('error', event => {
      this.logger?.error('WebSocket error', { error: event })
    })
  }

  /**
   * Call a method via WebSocket
   */
  async call<M extends keyof T>(
    method: M,
    params: MethodParams<T, M>
  ): Promise<MethodResult<T, M>> {
    return new Promise((resolve, reject) => {
      const id = this.generateId()

      const timeout = setTimeout(() => {
        this.listeners.delete(id)
        reject(new Error('Request timeout'))
      }, 30000)

      this.listeners.set(id, (response: RpcResponse) => {
        clearTimeout(timeout)
        this.listeners.delete(id)

        if (response.error) {
          reject(new Error(response.error.message))
        } else {
          resolve(response.result as MethodResult<T, M>)
        }
      })

      const request: RpcRequest = {
        id,
        method: method as string,
        params,
        timestamp: Date.now()
      }

      this.ws.send(JSON.stringify(request))
    })
  }

  /**
   * Subscribe to events
   */
  on(event: string, handler: (data: unknown) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)?.add(handler)
  }

  /**
   * Unsubscribe from events
   */
  off(event: string, handler: (data: unknown) => void): void {
    this.eventHandlers.get(event)?.delete(handler)
  }

  /**
   * Close the WebSocket connection
   */
  close(): void {
    this.ws.close()
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data as string)

      // Handle RPC response
      if (data.id && this.listeners.has(data.id)) {
        const listener = this.listeners.get(data.id)
        listener?.(data as RpcResponse)
      }
      // Handle broadcast event
      else if (data.event && data.data) {
        const handlers = this.eventHandlers.get(data.event)
        if (handlers) {
          for (const handler of handlers) {
            handler(data.data)
          }
        }
      }
    } catch (error) {
      this.logger?.error('Failed to parse WebSocket message', { error })
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * Durable Object storage interface
 */
interface DurableObjectStorage {
  get(key: string): Promise<unknown>
  put(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<boolean>
  list(options?: {
    prefix?: string
    limit?: number
    reverse?: boolean
  }): Promise<Map<string, unknown>>
  setAlarm(scheduledTime: number): Promise<void>
  deleteAlarm(): Promise<void>
}

/**
 * Durable Object state interface
 */
interface DurableObjectState {
  id: DurableObjectId
  storage: DurableObjectStorage
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>
  acceptWebSocket(ws: WebSocket): void
}

/**
 * WebSocket pair for upgrade
 */
declare class WebSocketPair {
  0: WebSocket
  1: WebSocket
}

/**
 * Create a typed Durable Object client
 */
export function createDurableObjectClient<T extends ServiceMethodRegistry>(
  binding: DurableObjectBinding<T>,
  id: string | DurableObjectId,
  logger?: ILogger
): DurableObjectClient<T> {
  const objectId = typeof id === 'string' ? binding.idFromName(id) : id

  const stub = binding.get(objectId)
  return new DurableObjectClient<T>(stub, logger)
}
