// Abstract AI Provider Types
// This module defines the core interfaces for the AI provider system

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
  metadata?: Record<string, unknown>
}

export interface CompletionOptions {
  temperature?: number
  maxTokens?: number
  topP?: number
  stopSequences?: string[]
  presencePenalty?: number
  frequencyPenalty?: number
  // Provider-specific options
  providerOptions?: Record<string, unknown>
}

export interface RequestContext {
  userId?: string | number
  sessionId?: string
  locale?: string
  // Additional context for providers
  metadata?: Record<string, unknown>
}

export interface CompletionRequest {
  messages: Message[]
  options?: CompletionOptions
  context?: RequestContext
}

export interface UsageMetrics {
  inputUnits: number
  outputUnits: number
  computeUnits?: number
  totalUnits?: number
  // Provider-specific metrics
  customMetrics?: Record<string, number>
}

export interface ResponseMetadata {
  model?: string
  providerId?: string
  processingTimeMs?: number
  cached?: boolean
  // Provider-specific metadata
  custom?: Record<string, unknown>
}

export interface StreamChunk {
  content: string
  done: boolean
  metadata?: ResponseMetadata
}

export interface CompletionResponse {
  content: string
  usage?: UsageMetrics
  metadata?: ResponseMetadata
}

export interface ProviderCapabilities {
  streaming: boolean
  maxTokens: number
  maxContextLength: number
  supportedOptions: string[]
  supportedModels?: string[]
  customFeatures?: Record<string, unknown>
}

export interface HealthStatus {
  healthy: boolean
  latencyMs?: number
  error?: string
  lastChecked: Date
}

export interface ProviderConfig {
  id: string
  type: string
  enabled?: boolean
  priority?: number
  // Provider-specific configuration
  config?: Record<string, unknown>
}

export interface AIProvider {
  readonly id: string
  readonly displayName: string
  readonly type: string

  // Core methods
  complete(request: CompletionRequest): Promise<CompletionResponse>
  stream?(request: CompletionRequest): AsyncIterator<StreamChunk>

  // Configuration and health
  validateConfig(config: ProviderConfig): Promise<boolean>
  getCapabilities(): ProviderCapabilities
  getHealthStatus(): Promise<HealthStatus>

  // Lifecycle
  initialize?(): Promise<void>
  dispose?(): Promise<void>
}

export interface ProviderInfo {
  id: string
  displayName: string
  type: string
  enabled: boolean
  healthy?: boolean
  capabilities: ProviderCapabilities
}

// Error handling
export type AIErrorCode =
  | 'PROVIDER_ERROR'
  | 'INVALID_REQUEST'
  | 'RATE_LIMIT'
  | 'QUOTA_EXCEEDED'
  | 'AUTHENTICATION_ERROR'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'UNSUPPORTED_FEATURE'
  | 'UNKNOWN_ERROR'

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly code: AIErrorCode,
    public readonly provider: string,
    public readonly retryable: boolean = false,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'AIProviderError'
  }
}

// Cost tracking interfaces
export interface CostEstimate {
  amount: number
  currency: string
  breakdown?: {
    input?: number
    output?: number
    compute?: number
    other?: Record<string, number>
  }
  confidence?: 'high' | 'medium' | 'low'
}

export interface CostFactors {
  inputUnitCost?: number
  outputUnitCost?: number
  computeUnitCost?: number
  customCosts?: Record<string, number>
  currency: string
  lastUpdated: Date
  source?: string
}

export interface CostCalculator {
  calculateCost(usage: UsageMetrics, providerId: string): Promise<CostEstimate | null>
  getCostFactors(providerId: string): Promise<CostFactors | null>
  updateCostFactors(providerId: string, factors: CostFactors): Promise<void>
}

// Provider registry interfaces
export interface ProviderRegistry {
  register(provider: AIProvider): void
  unregister(id: string): boolean
  get(id?: string): AIProvider | null
  list(): ProviderInfo[]
  setDefault(id: string): void
  getDefault(): string | null
  exists(id: string): boolean
}

// Configuration interfaces
export interface AIServiceConfig {
  defaultProvider?: string
  providers?: ProviderConfig[]
  fallbackProviders?: string[]
  costTracking?: {
    enabled: boolean
    calculator?: CostCalculator
  }
  retryPolicy?: {
    maxAttempts: number
    backoffMs: number
    retryableErrors?: AIErrorCode[]
  }
}

// Response wrapper for the AI service
export interface AIResponse {
  content: string
  provider: string
  usage?: UsageMetrics
  cost?: CostEstimate
  metadata?: ResponseMetadata
}

// Options for AI service requests
export interface AIOptions extends CompletionOptions {
  provider?: string
  trackCost?: boolean
  allowFallback?: boolean
}
