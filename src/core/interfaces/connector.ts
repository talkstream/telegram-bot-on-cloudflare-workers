/**
 * Base connector interface that all connectors must implement
 */
export interface Connector {
  /**
   * Unique identifier for the connector
   */
  id: string

  /**
   * Display name of the connector
   */
  name: string

  /**
   * Connector version
   */
  version: string

  /**
   * Connector type
   */
  type: ConnectorType

  /**
   * Initialize the connector with configuration
   */
  initialize(config: ConnectorConfig): Promise<void>

  /**
   * Check if the connector is properly configured and ready
   */
  isReady(): boolean

  /**
   * Validate the connector configuration
   */
  validateConfig(config: ConnectorConfig): ValidationResult

  /**
   * Get connector capabilities
   */
  getCapabilities(): ConnectorCapabilities

  /**
   * Get connector health status
   */
  getHealthStatus(): Promise<HealthStatus>

  /**
   * Cleanup resources when connector is destroyed
   */
  destroy(): Promise<void>
}

export enum ConnectorType {
  MESSAGING = 'messaging',
  AI = 'ai',
  CLOUD = 'cloud',
  DATABASE = 'database',
  PAYMENT = 'payment',
  ANALYTICS = 'analytics',
  SECURITY = 'security',
  SESSION = 'session',
  I18N = 'i18n'
}

export interface ConnectorConfig {
  /**
   * Connector-specific configuration
   */
  [key: string]: unknown
}

export interface ValidationResult {
  valid: boolean
  errors?: ValidationError[]
}

export interface ValidationError {
  field: string
  message: string
  code?: string
}

export interface ConnectorCapabilities {
  /**
   * List of supported features
   */
  features: string[]

  /**
   * Rate limits
   */
  rateLimits?: RateLimit[]

  /**
   * Supported file types for uploads
   */
  supportedFileTypes?: string[]

  /**
   * Maximum file size in bytes
   */
  maxFileSize?: number

  /**
   * Custom capabilities
   */
  [key: string]: unknown
}

export interface RateLimit {
  resource: string
  limit: number
  window: number // in seconds
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  message?: string
  details?: Record<string, unknown>
  timestamp: number
}
