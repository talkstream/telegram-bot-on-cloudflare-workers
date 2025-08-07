import { logger } from '../../logger'
import { retryWithTimeout, withTimeout } from '../../timeout-wrapper'
import type {
  AIErrorCode,
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  HealthStatus,
  ProviderCapabilities,
  ProviderConfig,
  StreamChunk
} from '../types'
import { AIProviderError } from '../types'

export interface BaseProviderOptions {
  id: string
  displayName: string
  type: string
  config?: Record<string, unknown>
  tier?: 'free' | 'paid'
}

/**
 * Base adapter class that provides common functionality for all AI providers
 */
export abstract class BaseAIProvider implements AIProvider {
  readonly id: string
  readonly displayName: string
  readonly type: string
  protected config: Record<string, unknown>
  protected tier: 'free' | 'paid'
  protected initialized = false

  constructor(options: BaseProviderOptions) {
    this.id = options.id
    this.displayName = options.displayName
    this.type = options.type
    this.config = options.config || {}
    this.tier = options.tier || 'free'
  }

  // Abstract methods that must be implemented by subclasses
  abstract doComplete(request: CompletionRequest): Promise<CompletionResponse>
  abstract doValidateConfig(config: ProviderConfig): Promise<boolean>
  abstract getCapabilities(): ProviderCapabilities

  // Optional streaming support
  async *stream?(request: CompletionRequest): AsyncIterator<StreamChunk> {
    // Default implementation: convert complete response to single chunk
    const response = await this.complete(request)
    const chunk: StreamChunk = {
      content: response.content,
      done: true
    }
    if (response.metadata) {
      chunk.metadata = response.metadata
    }
    yield chunk
  }

  // Main completion method with error handling and retries
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.initialized) {
      await this.initialize()
    }

    const timeoutMs = this.getTimeout()
    const maxRetries = this.tier === 'free' ? 1 : 3

    return retryWithTimeout(
      async () => {
        try {
          const response = await this.doComplete(request)

          // Add provider metadata
          response.metadata = {
            ...response.metadata,
            providerId: this.id
          }

          return response
        } catch (error) {
          throw this.normalizeError(error)
        }
      },
      {
        maxRetries,
        retryDelayMs: 100,
        timeoutMs,
        operation: `${this.displayName} completion`
      }
    )
  }

  async validateConfig(config: ProviderConfig): Promise<boolean> {
    try {
      return await this.doValidateConfig(config)
    } catch (error) {
      logger.error(`Config validation failed for ${this.id}:`, error)
      return false
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const startTime = Date.now()

    try {
      // Try a minimal completion request
      await withTimeout(
        this.doComplete({
          messages: [{ role: 'user', content: 'Hi' }],
          options: { maxTokens: 5 }
        }),
        {
          timeoutMs: 5000,
          operation: `${this.displayName} health check`
        }
      )

      return {
        healthy: true,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date()
      }
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date()
      }
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      await this.doInitialize()
      this.initialized = true
      logger.info(`Initialized AI provider: ${this.displayName}`)
    } catch (error) {
      logger.error(`Failed to initialize provider ${this.id}:`, error)
      throw this.normalizeError(error)
    }
  }

  async dispose(): Promise<void> {
    if (!this.initialized) {
      return
    }

    try {
      await this.doDispose()
      this.initialized = false
      logger.info(`Disposed AI provider: ${this.displayName}`)
    } catch (error) {
      logger.error(`Failed to dispose provider ${this.id}:`, error)
    }
  }

  // Hook methods that can be overridden by subclasses
  protected async doInitialize(): Promise<void> {
    // Default: no initialization needed
  }

  protected async doDispose(): Promise<void> {
    // Default: no disposal needed
  }

  // Helper methods
  protected getTimeout(): number {
    if (this.tier === 'free') {
      return 2000 // 2 seconds for free tier
    }
    return 15000 // 15 seconds for paid tier
  }

  protected normalizeError(error: unknown): AIProviderError {
    if (error instanceof AIProviderError) {
      return error
    }

    const message = error instanceof Error ? error.message : 'Unknown error'
    let code: AIErrorCode = 'UNKNOWN_ERROR'
    let retryable = false

    // Try to determine error type
    if (message.includes('rate limit') || message.includes('quota')) {
      code = 'RATE_LIMIT'
      retryable = true
    } else if (message.includes('timeout')) {
      code = 'TIMEOUT'
      retryable = true
    } else if (message.includes('network') || message.includes('fetch')) {
      code = 'NETWORK_ERROR'
      retryable = true
    } else if (message.includes('auth') || message.includes('unauthorized')) {
      code = 'AUTHENTICATION_ERROR'
    } else if (message.includes('invalid')) {
      code = 'INVALID_REQUEST'
    }

    return new AIProviderError(message, code, this.id, retryable, error)
  }

  // Utility method for transforming messages to provider format
  protected transformMessages(messages: CompletionRequest['messages']): unknown[] {
    // Default implementation - can be overridden
    return messages
  }

  // Utility method for parsing provider responses
  protected parseResponse(response: unknown): string {
    // Default implementation - must be overridden for specific providers
    if (typeof response === 'string') {
      return response
    }
    throw new Error('Unable to parse provider response')
  }
}
