/**
 * Platform-agnostic storage interfaces
 * These abstractions allow us to switch between different cloud providers
 */

/**
 * Cloudflare D1 specific metadata for run() operations
 * Provides type safety for database operations
 */
export interface D1RunMeta {
  last_row_id?: number
  changes?: number
  duration?: number
  rows_affected?: number
  rows_read?: number
  rows_written?: number
}

/**
 * Cloudflare D1 specific metadata for all() operations
 */
export interface D1AllMeta {
  duration?: number
  rows_read?: number
  rows_written?: number
}

/**
 * Statement execution result
 */
export interface StatementResult<T = unknown> {
  results: T[]
  meta: {
    duration?: number
    rows_affected?: number
    last_insert_rowid?: string | number
  }
}

/**
 * Query execution options
 */
export interface QueryOptions {
  timeout?: number
  consistency?: 'strong' | 'eventual'
}

/**
 * KV storage options (for backward compatibility)
 */
export interface KVListOptions {
  prefix?: string
  limit?: number
  cursor?: string
}

/**
 * KV list result
 */
export interface KVListResult {
  keys: Array<{ name: string; metadata?: Record<string, unknown> }>
  list_complete: boolean
  cursor?: string
}

/**
 * Key-Value storage interface
 * Implementations: Cloudflare KV, Redis, DynamoDB, etc.
 */
export interface IKeyValueStore {
  /**
   * Get value by key
   */
  get<T = string>(key: string): Promise<T | null>

  /**
   * Get value with metadata
   */
  getWithMetadata<T = string>(
    key: string
  ): Promise<{
    value: T | null
    metadata: Record<string, unknown> | null
  }>

  /**
   * Set value with optional TTL and metadata
   */
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: {
      expirationTtl?: number
      metadata?: Record<string, unknown>
    }
  ): Promise<void>

  /**
   * Delete key
   */
  delete(key: string): Promise<void>

  /**
   * List keys with optional prefix
   */
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string; metadata?: Record<string, unknown> }>
    list_complete: boolean
    cursor?: string
  }>
}

/**
 * Database storage interface
 * Implementations: Cloudflare D1, PostgreSQL, MySQL, SQLite, etc.
 */
export interface IDatabaseStore {
  /**
   * Prepare a SQL statement
   */
  prepare(query: string): IPreparedStatement

  /**
   * Execute raw SQL (for migrations, DDL)
   */
  exec(query: string): Promise<void>

  /**
   * Batch execute multiple statements
   */
  batch<T = unknown>(statements: IPreparedStatement[]): Promise<T[]>
}

/**
 * Prepared statement interface
 */
export interface IPreparedStatement {
  /**
   * Bind parameters to the statement
   */
  bind(...values: unknown[]): IPreparedStatement

  /**
   * Execute and return first result
   */
  first<T = unknown>(colName?: string): Promise<T | null>

  /**
   * Execute and return all results
   * For D1, cast meta to D1AllMeta for type-safe access
   */
  all<T = unknown>(): Promise<{ results: T[]; meta: D1AllMeta | unknown }>

  /**
   * Execute without returning results
   * For D1, cast meta to D1RunMeta for type-safe access
   */
  run(): Promise<{ meta: D1RunMeta | unknown; success?: boolean }>
}

/**
 * Object storage interface
 * Implementations: Cloudflare R2, AWS S3, Google Cloud Storage, etc.
 */
export interface IObjectStore {
  /**
   * Store an object
   */
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: {
      httpMetadata?: {
        contentType?: string
        contentDisposition?: string
        contentEncoding?: string
        contentLanguage?: string
        cacheControl?: string
      }
      customMetadata?: Record<string, string>
    }
  ): Promise<void>

  /**
   * Retrieve an object
   */
  get(key: string): Promise<{
    body: ReadableStream
    httpMetadata?: Record<string, string>
    customMetadata?: Record<string, string>
  } | null>

  /**
   * Get object metadata without body
   */
  head(key: string): Promise<{
    httpMetadata?: Record<string, string>
    customMetadata?: Record<string, string>
  } | null>

  /**
   * Delete an object
   */
  delete(key: string): Promise<void>

  /**
   * List objects with optional prefix
   */
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    objects: Array<{
      key: string
      size: number
      uploaded: Date
    }>
    truncated: boolean
    cursor?: string
  }>
}

/**
 * Cache storage interface
 * For edge caching capabilities
 */
export interface ICacheStore {
  /**
   * Get cached response
   */
  match(request: Request | string): Promise<Response | undefined>

  /**
   * Store response in cache
   */
  put(request: Request | string, response: Response): Promise<void>

  /**
   * Delete from cache
   */
  delete(request: Request | string): Promise<boolean>
}
