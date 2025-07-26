/**
 * Durable Objects interfaces for the wireframe platform
 * Provides abstractions for real-time stateful computing at the edge
 */

/**
 * Base interface for all Durable Objects
 */
export interface IDurableObject {
  /**
   * Initialize the Durable Object
   */
  initialize?(): Promise<void>;

  /**
   * Handle HTTP requests to the Durable Object
   */
  fetch(request: Request): Promise<Response>;

  /**
   * Clean up resources when the object is being evicted
   */
  cleanup?(): Promise<void>;
}

/**
 * Durable Object state interface
 */
export interface IDurableObjectState {
  /**
   * Get a value from storage
   */
  get<T = unknown>(key: string): Promise<T | undefined>;

  /**
   * Get multiple values from storage
   */
  get<T = unknown>(keys: string[]): Promise<Map<string, T>>;

  /**
   * Set a value in storage
   */
  put<T = unknown>(key: string, value: T): Promise<void>;

  /**
   * Set multiple values in storage
   */
  put<T = unknown>(entries: Record<string, T>): Promise<void>;

  /**
   * Delete a value from storage
   */
  delete(key: string): Promise<boolean>;

  /**
   * Delete multiple values from storage
   */
  delete(keys: string[]): Promise<number>;

  /**
   * List keys in storage
   */
  list<T = unknown>(options?: DurableObjectListOptions): Promise<Map<string, T>>;

  /**
   * Get storage for transactions
   */
  storage: DurableObjectStorage;

  /**
   * Block until all async operations are complete
   */
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
}

/**
 * Options for listing keys
 */
export interface DurableObjectListOptions {
  start?: string;
  startAfter?: string;
  end?: string;
  prefix?: string;
  reverse?: boolean;
  limit?: number;
}

/**
 * Durable Object storage interface
 */
export interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  get<T = unknown>(keys: string[]): Promise<Map<string, T>>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  put<T = unknown>(entries: Record<string, T>): Promise<void>;
  delete(key: string): Promise<boolean>;
  delete(keys: string[]): Promise<number>;
  list<T = unknown>(options?: DurableObjectListOptions): Promise<Map<string, T>>;
  transaction<T>(closure: (txn: DurableObjectTransaction) => Promise<T>): Promise<T>;
  deleteAll(): Promise<void>;
  sync(): Promise<void>;
}

/**
 * Durable Object transaction interface
 */
export interface DurableObjectTransaction {
  get<T = unknown>(key: string): Promise<T | undefined>;
  get<T = unknown>(keys: string[]): Promise<Map<string, T>>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  put<T = unknown>(entries: Record<string, T>): Promise<void>;
  delete(key: string): Promise<boolean>;
  delete(keys: string[]): Promise<number>;
  rollback(): void;
}

/**
 * WebSocket connection handler
 */
export interface IWebSocketHandler {
  /**
   * Handle new WebSocket connection
   */
  handleConnect(ws: WebSocket, request: Request): void | Promise<void>;

  /**
   * Handle WebSocket message
   */
  handleMessage(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void>;

  /**
   * Handle WebSocket close
   */
  handleClose(ws: WebSocket, code: number, reason: string): void | Promise<void>;

  /**
   * Handle WebSocket error
   */
  handleError(ws: WebSocket, error: Error): void | Promise<void>;
}

/**
 * Room-based Durable Object for real-time collaboration
 */
export interface IRoomDurableObject extends IDurableObject {
  /**
   * Join a room
   */
  join(userId: string, metadata?: Record<string, unknown>): Promise<void>;

  /**
   * Leave a room
   */
  leave(userId: string): Promise<void>;

  /**
   * Broadcast message to all connections
   */
  broadcast(message: unknown, excludeUserId?: string): Promise<void>;

  /**
   * Send message to specific user
   */
  sendToUser(userId: string, message: unknown): Promise<void>;

  /**
   * Get current room state
   */
  getState(): Promise<unknown>;

  /**
   * Update room state
   */
  updateState(updates: Record<string, unknown>): Promise<void>;
}

/**
 * Counter Durable Object for distributed counting
 */
export interface ICounterDurableObject extends IDurableObject {
  /**
   * Increment counter
   */
  increment(amount?: number): Promise<number>;

  /**
   * Decrement counter
   */
  decrement(amount?: number): Promise<number>;

  /**
   * Get current value
   */
  getValue(): Promise<number>;

  /**
   * Reset counter
   */
  reset(): Promise<void>;
}

/**
 * Rate limiter Durable Object
 */
export interface IRateLimiterDurableObject extends IDurableObject {
  /**
   * Check if request is allowed
   */
  checkLimit(key: string, limit: number, window: number): Promise<boolean>;

  /**
   * Get current usage
   */
  getUsage(key: string): Promise<{ count: number; resetAt: number }>;

  /**
   * Reset limits for a key
   */
  resetKey(key: string): Promise<void>;
}

/**
 * Session Durable Object for user sessions
 */
export interface ISessionDurableObject extends IDurableObject {
  /**
   * Get session data
   */
  getSession(): Promise<Record<string, unknown>>;

  /**
   * Update session data
   */
  updateSession(data: Record<string, unknown>): Promise<void>;

  /**
   * Delete session
   */
  deleteSession(): Promise<void>;

  /**
   * Extend session TTL
   */
  touch(): Promise<void>;
}

/**
 * Durable Object namespace stub
 */
export interface DurableObjectNamespace {
  /**
   * Get Durable Object stub by ID
   */
  get(id: DurableObjectId): DurableObjectStub;

  /**
   * Create new unique ID
   */
  newUniqueId(): DurableObjectId;

  /**
   * Create ID from string
   */
  idFromString(hexString: string): DurableObjectId;

  /**
   * Create ID from name
   */
  idFromName(name: string): DurableObjectId;
}

/**
 * Durable Object ID
 */
export interface DurableObjectId {
  toString(): string;
  equals(other: DurableObjectId): boolean;
}

/**
 * Durable Object stub for remote calls
 */
export interface DurableObjectStub {
  /**
   * Send HTTP request to Durable Object
   */
  fetch(request: RequestInfo, init?: RequestInit): Promise<Response>;

  /**
   * Get the ID of this Durable Object
   */
  id: DurableObjectId;
}

/**
 * Configuration for Durable Objects
 */
export interface DurableObjectConfig {
  /**
   * Class name for the Durable Object
   */
  className: string;

  /**
   * Script name where the class is defined
   */
  scriptName?: string;

  /**
   * Environment where the Durable Object runs
   */
  environment?: string;
}

/**
 * Factory for creating Durable Objects
 */
export interface IDurableObjectFactory {
  /**
   * Create a new Durable Object instance
   */
  create<T extends IDurableObject>(state: IDurableObjectState, env: unknown): T;
}
