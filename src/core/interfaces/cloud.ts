import type { Connector } from './connector.js'

/**
 * Cloud connector interface for cloud platform providers
 */
export interface CloudConnector extends Connector {
  /**
   * Deploy application
   */
  deploy(config: DeployConfig): Promise<DeployResult>

  /**
   * Rollback deployment
   */
  rollback(deploymentId: string): Promise<void>

  /**
   * Get deployment status
   */
  getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus>

  /**
   * List deployments
   */
  listDeployments(options?: ListOptions): Promise<Deployment[]>

  /**
   * Get storage adapter
   */
  getStorage(): StorageAdapter

  /**
   * Get database adapter
   */
  getDatabase(): DatabaseAdapter

  /**
   * Get secrets adapter
   */
  getSecrets(): SecretsAdapter

  /**
   * Get queue adapter
   */
  getQueue(): QueueAdapter

  /**
   * Get logs
   */
  getLogs(options?: LogOptions): AsyncIterator<LogEntry>

  /**
   * Get metrics
   */
  getMetrics(options?: MetricOptions): Promise<Metrics>

  /**
   * Estimate costs
   */
  estimateCost(usage: ResourceUsage): Cost

  /**
   * Get cloud-specific capabilities
   */
  getCloudCapabilities(): CloudCapabilities
}

export interface DeployConfig {
  /**
   * Application name
   */
  name: string

  /**
   * Environment (production, staging, etc.)
   */
  environment: string

  /**
   * Source code location
   */
  source: {
    type: 'git' | 'local' | 'archive'
    url?: string
    path?: string
    branch?: string
    commit?: string
  }

  /**
   * Build configuration
   */
  build?: {
    command?: string
    output_directory?: string
    environment?: Record<string, string>
  }

  /**
   * Runtime configuration
   */
  runtime: {
    type: string // 'nodejs', 'python', 'go', etc.
    version?: string
    entry_point?: string
  }

  /**
   * Environment variables
   */
  env?: Record<string, string>

  /**
   * Secrets to inject
   */
  secrets?: string[]

  /**
   * Scaling configuration
   */
  scaling?: {
    min_instances?: number
    max_instances?: number
    target_cpu?: number
    target_memory?: number
  }

  /**
   * Resource limits
   */
  resources?: {
    cpu?: string // '1', '0.5', etc.
    memory?: string // '512MB', '1GB', etc.
    timeout?: number // seconds
  }

  /**
   * Network configuration
   */
  network?: {
    domains?: string[]
    routes?: Route[]
    cors?: CorsConfig
  }

  /**
   * Additional cloud-specific config
   */
  [key: string]: unknown
}

export interface DeployResult {
  deployment_id: string
  url?: string
  status: DeploymentStatus
  created_at: Date
  metadata?: Record<string, unknown>
}

export interface DeploymentStatus {
  state: DeploymentState
  message?: string
  progress?: number
  started_at?: Date
  completed_at?: Date
  error?: DeploymentError
}

export enum DeploymentState {
  PENDING = 'pending',
  BUILDING = 'building',
  DEPLOYING = 'deploying',
  ACTIVE = 'active',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface DeploymentError {
  code: string
  message: string
  details?: unknown
}

export interface Deployment {
  id: string
  name: string
  environment: string
  version?: string
  status: DeploymentStatus
  url?: string
  created_at: Date
  updated_at?: Date
  metadata?: Record<string, unknown>
}

export interface Route {
  path: string
  methods?: string[]
  handler?: string
  middleware?: string[]
}

export interface CorsConfig {
  origins?: string[]
  methods?: string[]
  headers?: string[]
  credentials?: boolean
  max_age?: number
}

/**
 * Storage adapter interface
 */
export interface StorageAdapter {
  /**
   * Upload file
   */
  upload(key: string, data: Buffer | ReadableStream, options?: UploadOptions): Promise<UploadResult>

  /**
   * Download file
   */
  download(key: string): Promise<Buffer>

  /**
   * Stream download
   */
  streamDownload(key: string): Promise<ReadableStream>

  /**
   * Delete file
   */
  delete(key: string): Promise<void>

  /**
   * List files
   */
  list(prefix?: string, options?: ListOptions): Promise<StorageObject[]>

  /**
   * Get file metadata
   */
  getMetadata(key: string): Promise<StorageMetadata>

  /**
   * Generate signed URL
   */
  generateSignedUrl(key: string, options?: SignedUrlOptions): Promise<string>
}

export interface UploadOptions {
  content_type?: string
  metadata?: Record<string, string>
  cache_control?: string
  content_encoding?: string
  acl?: 'private' | 'public-read'
}

export interface UploadResult {
  key: string
  etag?: string
  version_id?: string
  location?: string
}

export interface StorageObject {
  key: string
  size: number
  last_modified: Date
  etag?: string
  storage_class?: string
}

export interface StorageMetadata extends StorageObject {
  content_type?: string
  content_encoding?: string
  cache_control?: string
  metadata?: Record<string, string>
}

export interface SignedUrlOptions {
  expires_in: number // seconds
  method?: 'GET' | 'PUT' | 'DELETE'
  content_type?: string
  response_headers?: Record<string, string>
}

/**
 * Database adapter interface
 */
export interface DatabaseAdapter {
  /**
   * Execute query
   */
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>

  /**
   * Execute transaction
   */
  transaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T>

  /**
   * Get database info
   */
  getInfo(): Promise<DatabaseInfo>

  /**
   * Run migrations
   */
  migrate(migrations: Migration[]): Promise<void>
}

export interface QueryResult<T> {
  rows: T[]
  affected_rows?: number
  last_insert_id?: unknown
  metadata?: Record<string, unknown>
}

export interface Transaction {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>
  commit(): Promise<void>
  rollback(): Promise<void>
}

export interface DatabaseInfo {
  type: string
  version?: string
  size?: number
  tables?: number
  indexes?: number
}

export interface Migration {
  version: string
  name: string
  up: string
  down?: string
}

/**
 * Secrets adapter interface
 */
export interface SecretsAdapter {
  /**
   * Get secret value
   */
  get(key: string): Promise<string | null>

  /**
   * Set secret value
   */
  set(key: string, value: string): Promise<void>

  /**
   * Delete secret
   */
  delete(key: string): Promise<void>

  /**
   * List secrets
   */
  list(prefix?: string): Promise<SecretInfo[]>

  /**
   * Bulk operations
   */
  bulk(operations: SecretOperation[]): Promise<void>
}

export interface SecretInfo {
  name: string
  created_at?: Date
  updated_at?: Date
  version?: string
}

export interface SecretOperation {
  type: 'set' | 'delete'
  key: string
  value?: string
}

/**
 * Queue adapter interface
 */
export interface QueueAdapter {
  /**
   * Send message to queue
   */
  send(queue: string, message: unknown, options?: QueueOptions): Promise<string>

  /**
   * Send batch of messages
   */
  sendBatch(queue: string, messages: unknown[], options?: QueueOptions): Promise<string[]>

  /**
   * Receive messages
   */
  receive(queue: string, options?: ReceiveOptions): Promise<QueueMessage[]>

  /**
   * Delete message
   */
  delete(queue: string, messageId: string): Promise<void>

  /**
   * Create queue
   */
  createQueue?(name: string, options?: CreateQueueOptions): Promise<void>

  /**
   * Delete queue
   */
  deleteQueue?(name: string): Promise<void>
}

export interface QueueOptions {
  delay?: number // seconds
  priority?: number
  ttl?: number // seconds
}

export interface ReceiveOptions {
  max_messages?: number
  wait_time?: number // seconds
  visibility_timeout?: number // seconds
}

export interface QueueMessage {
  id: string
  body: unknown
  attributes?: Record<string, unknown>
  received_at: Date
}

export interface CreateQueueOptions {
  message_retention?: number // seconds
  visibility_timeout?: number // seconds
  max_message_size?: number // bytes
}

/**
 * Logging interfaces
 */
export interface LogOptions {
  start_time?: Date
  end_time?: Date
  level?: LogLevel
  source?: string
  limit?: number
  filter?: string
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface LogEntry {
  timestamp: Date
  level: LogLevel
  message: string
  source?: string
  trace_id?: string
  span_id?: string
  metadata?: Record<string, unknown>
}

/**
 * Metrics interfaces
 */
export interface MetricOptions {
  start_time: Date
  end_time: Date
  metrics: string[]
  aggregation?: AggregationType
  interval?: number // seconds
  filters?: Record<string, string>
}

export enum AggregationType {
  SUM = 'sum',
  AVG = 'avg',
  MIN = 'min',
  MAX = 'max',
  COUNT = 'count',
  P50 = 'p50',
  P90 = 'p90',
  P95 = 'p95',
  P99 = 'p99'
}

export interface Metrics {
  series: MetricSeries[]
  metadata?: Record<string, unknown>
}

export interface MetricSeries {
  name: string
  points: MetricPoint[]
  unit?: string
  aggregation?: AggregationType
}

export interface MetricPoint {
  timestamp: Date
  value: number
  tags?: Record<string, string>
}

/**
 * Cost estimation
 */
export interface ResourceUsage {
  compute?: {
    cpu_hours?: number
    memory_gb_hours?: number
    requests?: number
  }
  storage?: {
    gb_months?: number
    read_operations?: number
    write_operations?: number
  }
  network?: {
    egress_gb?: number
    ingress_gb?: number
  }
  database?: {
    read_units?: number
    write_units?: number
    storage_gb?: number
  }
}

export interface Cost {
  amount: number
  currency: string
  breakdown?: Record<string, number>
  period?: {
    start: Date
    end: Date
  }
}

export interface ListOptions {
  limit?: number
  offset?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  filters?: Record<string, unknown>
}

export interface CloudCapabilities {
  /**
   * Supported regions
   */
  regions: string[]

  /**
   * Supported runtimes
   */
  runtimes: RuntimeInfo[]

  /**
   * Available services
   */
  services: string[]

  /**
   * Resource limits
   */
  limits: {
    max_cpu?: string
    max_memory?: string
    max_timeout?: number
    max_env_vars?: number
    max_secrets?: number
  }

  /**
   * Pricing model
   */
  pricing: {
    model: 'pay-per-use' | 'subscription' | 'hybrid'
    free_tier?: unknown
    calculator_url?: string
  }

  /**
   * Compliance certifications
   */
  compliance?: string[]

  /**
   * Custom capabilities
   */
  custom?: Record<string, unknown>
}

export interface RuntimeInfo {
  name: string
  versions: string[]
  deprecated?: string[]
  default_version?: string
}
