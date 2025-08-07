/**
 * Monitored AI Connector Wrapper
 *
 * Wraps any AI connector with automatic monitoring and performance tracking
 */

import { EventBus } from '@/core/events/event-bus'
import { AIEventType } from '@/core/events/types/ai'
import type {
  AICapabilities,
  AIConnector,
  AudioInput,
  AudioOptions,
  AudioResponse,
  CompletionRequest,
  CompletionResponse,
  Cost,
  Embedding,
  Model,
  ModelInfo,
  StreamChunk,
  Usage,
  VisionInput,
  VisionResponse
} from '@/core/interfaces/ai'
import type {
  ConnectorCapabilities,
  ConnectorConfig,
  HealthStatus,
  ValidationResult
} from '@/core/interfaces/connector'
import { ConnectorType } from '@/core/interfaces/connector'
import type { IMonitoringConnector } from '@/core/interfaces/monitoring'

export interface MonitoredAIConnectorConfig {
  connector: AIConnector
  monitoring: IMonitoringConnector
  eventBus?: EventBus
  trackTokens?: boolean
  trackCosts?: boolean
  trackLatency?: boolean
  trackErrors?: boolean
  sampleRate?: number // Sample rate for performance tracking (0-1)
}

export class MonitoredAIConnector implements AIConnector {
  public readonly id: string
  public readonly name: string
  public readonly version: string
  public readonly type = ConnectorType.AI

  private connector: AIConnector
  private monitoring: IMonitoringConnector
  private eventBus?: EventBus
  private config: MonitoredAIConnectorConfig

  constructor(config: MonitoredAIConnectorConfig) {
    this.connector = config.connector
    this.monitoring = config.monitoring
    this.eventBus = config.eventBus
    this.config = config

    // Copy metadata from wrapped connector
    this.id = `monitored-${this.connector.id}`
    this.name = `Monitored ${this.connector.name}`
    this.version = this.connector.version
  }

  async initialize(config: ConnectorConfig): Promise<void> {
    await this.connector.initialize(config)
    this.monitoring.trackEvent('ai_connector_initialized', {
      connectorId: this.connector.id,
      name: this.connector.name
    })
  }

  isReady(): boolean {
    return this.connector.isReady()
  }

  validateConfig(config: ConnectorConfig): ValidationResult {
    return this.connector.validateConfig(config)
  }

  getCapabilities(): ConnectorCapabilities {
    return this.connector.getCapabilities()
  }

  async getHealthStatus(): Promise<HealthStatus> {
    return this.connector.getHealthStatus()
  }

  async destroy(): Promise<void> {
    await this.connector.destroy()
    this.monitoring.trackEvent('ai_connector_destroyed', {
      connectorId: this.connector.id
    })
  }

  getAICapabilities(): AICapabilities {
    return this.connector.getAICapabilities()
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const shouldTrack = this.shouldTrack()
    const startTime = shouldTrack ? Date.now() : 0
    const requestId = crypto.randomUUID()

    try {
      // Track request start
      if (shouldTrack) {
        this.monitoring.trackEvent('ai_completion_started', {
          requestId,
          connectorId: this.connector.id,
          model: request.model,
          messageCount: request.messages?.length,
          maxTokens: request.max_tokens
        })

        this.eventBus?.emit(
          AIEventType.COMPLETION_STARTED,
          {
            requestId,
            provider: this.connector.id,
            model: request.model
          },
          'MonitoredAIConnector'
        )
      }

      // Execute the actual completion
      const response = await this.connector.complete(request)

      // Track success metrics
      if (shouldTrack) {
        const latency = Date.now() - startTime

        // Track latency
        if (this.config.trackLatency !== false) {
          this.monitoring.trackMetric('ai_completion_latency', latency, {
            connectorId: this.connector.id,
            model: request.model
          })
        }

        // Track token usage
        if (this.config.trackTokens !== false && response.usage) {
          this.monitoring.trackMetric('ai_tokens_prompt', response.usage.prompt_tokens || 0, {
            connectorId: this.connector.id,
            model: request.model
          })

          this.monitoring.trackMetric(
            'ai_tokens_completion',
            response.usage.completion_tokens || 0,
            {
              connectorId: this.connector.id,
              model: request.model
            }
          )

          this.monitoring.trackMetric('ai_tokens_total', response.usage.total_tokens || 0, {
            connectorId: this.connector.id,
            model: request.model
          })
        }

        // Track costs if cost calculation is available
        if (this.config.trackCosts !== false && response.usage) {
          const cost = this.connector.calculateCost(response.usage)
          this.monitoring.trackMetric('ai_cost', cost.total, {
            connectorId: this.connector.id,
            model: request.model,
            currency: cost.currency
          })
        }

        // Track completion event
        this.monitoring.trackEvent('ai_completion_success', {
          requestId,
          connectorId: this.connector.id,
          model: request.model,
          latency,
          tokens: response.usage?.total_tokens,
          cost: response.usage ? this.connector.calculateCost(response.usage).total : undefined
        })

        this.eventBus?.emit(
          AIEventType.COMPLETION_SUCCESS,
          {
            requestId,
            provider: this.connector.id,
            model: request.model,
            latency,
            tokens: response.usage?.total_tokens,
            cost: response.usage ? this.connector.calculateCost(response.usage).total : undefined
          },
          'MonitoredAIConnector'
        )
      }

      return response
    } catch (error) {
      // Track error
      if (this.config.trackErrors !== false) {
        const errorObj = error instanceof Error ? error : new Error(String(error))
        const latency = startTime ? Date.now() - startTime : undefined

        this.monitoring.captureException(errorObj, {
          requestId,
          connectorId: this.connector.id,
          model: request.model,
          latency
        })

        this.monitoring.trackEvent('ai_completion_failed', {
          requestId,
          connectorId: this.connector.id,
          model: request.model,
          error: errorObj.message,
          latency
        })

        this.eventBus?.emit(
          AIEventType.COMPLETION_FAILED,
          {
            requestId,
            provider: this.connector.id,
            model: request.model,
            error: errorObj,
            latency
          },
          'MonitoredAIConnector'
        )
      }

      throw error
    }
  }

  async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.connector.stream) {
      throw new Error('Streaming not supported by underlying connector')
    }

    const shouldTrack = this.shouldTrack()
    const startTime = shouldTrack ? Date.now() : 0
    const requestId = crypto.randomUUID()
    let tokenCount = 0
    let chunkCount = 0

    try {
      // Track stream start
      if (shouldTrack) {
        this.monitoring.trackEvent('ai_stream_started', {
          requestId,
          connectorId: this.connector.id,
          model: request.model
        })
      }

      // Stream from underlying connector
      const iterator = this.connector.stream(request) as AsyncGenerator<StreamChunk>
      for await (const chunk of iterator) {
        chunkCount++
        if (chunk.delta?.content) {
          tokenCount += Math.ceil(chunk.delta.content.length / 4) // Rough estimate
        }
        yield chunk
      }

      // Track stream completion
      if (shouldTrack) {
        const latency = Date.now() - startTime

        this.monitoring.trackMetric('ai_stream_latency', latency, {
          connectorId: this.connector.id,
          model: request.model
        })

        this.monitoring.trackMetric('ai_stream_chunks', chunkCount, {
          connectorId: this.connector.id,
          model: request.model
        })

        this.monitoring.trackEvent('ai_stream_completed', {
          requestId,
          connectorId: this.connector.id,
          model: request.model,
          latency,
          chunks: chunkCount,
          estimatedTokens: tokenCount
        })
      }
    } catch (error) {
      // Track stream error
      if (this.config.trackErrors !== false) {
        const errorObj = error instanceof Error ? error : new Error(String(error))
        const latency = startTime ? Date.now() - startTime : undefined

        this.monitoring.captureException(errorObj, {
          requestId,
          connectorId: this.connector.id,
          model: request.model,
          chunks: chunkCount,
          latency
        })

        this.monitoring.trackEvent('ai_stream_failed', {
          requestId,
          connectorId: this.connector.id,
          model: request.model,
          error: errorObj.message,
          chunks: chunkCount,
          latency
        })
      }

      throw error
    }
  }

  async embeddings(texts: string | string[]): Promise<Embedding[]> {
    if (!this.connector.embeddings) {
      throw new Error('Embeddings not supported by underlying connector')
    }

    const shouldTrack = this.shouldTrack()
    const startTime = shouldTrack ? Date.now() : 0
    const textCount = Array.isArray(texts) ? texts.length : 1

    try {
      const result = await this.connector.embeddings(texts)

      if (shouldTrack) {
        const latency = Date.now() - startTime

        this.monitoring.trackMetric('ai_embeddings_latency', latency, {
          connectorId: this.connector.id,
          textCount: String(textCount)
        })

        this.monitoring.trackEvent('ai_embeddings_generated', {
          connectorId: this.connector.id,
          textCount,
          embeddingCount: result.length,
          latency
        })
      }

      return result
    } catch (error) {
      if (this.config.trackErrors !== false) {
        const errorObj = error instanceof Error ? error : new Error(String(error))

        this.monitoring.captureException(errorObj, {
          connectorId: this.connector.id,
          operation: 'embeddings',
          textCount
        })
      }

      throw error
    }
  }

  async vision(images: VisionInput[], prompt: string): Promise<VisionResponse> {
    if (!this.connector.vision) {
      throw new Error('Vision not supported by underlying connector')
    }

    const shouldTrack = this.shouldTrack()
    const startTime = shouldTrack ? Date.now() : 0

    try {
      const result = await this.connector.vision(images, prompt)

      if (shouldTrack) {
        const latency = Date.now() - startTime

        this.monitoring.trackMetric('ai_vision_latency', latency, {
          connectorId: this.connector.id,
          imageCount: String(images.length)
        })

        this.monitoring.trackEvent('ai_vision_processed', {
          connectorId: this.connector.id,
          imageCount: images.length,
          latency
        })
      }

      return result
    } catch (error) {
      if (this.config.trackErrors !== false) {
        const errorObj = error instanceof Error ? error : new Error(String(error))

        this.monitoring.captureException(errorObj, {
          connectorId: this.connector.id,
          operation: 'vision',
          imageCount: images.length
        })
      }

      throw error
    }
  }

  async audio(audio: AudioInput, options?: AudioOptions): Promise<AudioResponse> {
    if (!this.connector.audio) {
      throw new Error('Audio not supported by underlying connector')
    }

    const shouldTrack = this.shouldTrack()
    const startTime = shouldTrack ? Date.now() : 0

    try {
      const result = await this.connector.audio(audio, options)

      if (shouldTrack) {
        const latency = Date.now() - startTime

        this.monitoring.trackMetric('ai_audio_latency', latency, {
          connectorId: this.connector.id
        })

        this.monitoring.trackEvent('ai_audio_processed', {
          connectorId: this.connector.id,
          latency
        })
      }

      return result
    } catch (error) {
      if (this.config.trackErrors !== false) {
        const errorObj = error instanceof Error ? error : new Error(String(error))

        this.monitoring.captureException(errorObj, {
          connectorId: this.connector.id,
          operation: 'audio'
        })
      }

      throw error
    }
  }

  async listModels(): Promise<Model[]> {
    if (!this.connector.listModels) {
      throw new Error('Model listing not supported by underlying connector')
    }

    return this.connector.listModels()
  }

  async getModelInfo(modelId: string): Promise<ModelInfo> {
    return this.connector.getModelInfo(modelId)
  }

  calculateCost(usage: Usage): Cost {
    return this.connector.calculateCost(usage)
  }

  async validateCredentials(): Promise<boolean> {
    const isValid = await this.connector.validateCredentials()

    this.monitoring.trackEvent('ai_credentials_validated', {
      connectorId: this.connector.id,
      valid: isValid
    })

    return isValid
  }

  private shouldTrack(): boolean {
    if (this.config.sampleRate === undefined || this.config.sampleRate === 1) {
      return true
    }
    return Math.random() < this.config.sampleRate
  }
}

/**
 * Factory function to create a monitored AI connector
 */
export function createMonitoredAIConnector(
  connector: AIConnector,
  monitoring: IMonitoringConnector,
  config?: Partial<MonitoredAIConnectorConfig>
): MonitoredAIConnector {
  return new MonitoredAIConnector({
    connector,
    monitoring,
    ...config
  })
}
