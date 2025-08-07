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
  Message,
  Model,
  ModelInfo,
  StreamChunk,
  Usage,
  VisionInput,
  VisionResponse
} from '../../core/interfaces/ai.js'
import type { ConnectorCapabilities, ConnectorConfig } from '../../core/interfaces/connector.js'
import { ConnectorType } from '../../core/interfaces/connector.js'

import { BaseConnector } from './base-connector.js'

/**
 * Base implementation for AI connectors
 */
export abstract class BaseAIConnector extends BaseConnector implements AIConnector {
  type = ConnectorType.AI

  protected models: Map<string, Model> = new Map()
  protected defaultModel?: string
  protected apiKey?: string

  /**
   * Complete text generation
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Validate request
    const validation = this.validateCompletionRequest(request)
    if (!validation.valid) {
      throw new Error(`Invalid request: ${validation.error}`)
    }

    // Check model availability
    const model = await this.getModelInfo(request.model)
    if (!model) {
      throw new Error(`Model ${request.model} not found`)
    }

    // Apply model limits
    const limitedRequest = this.applyModelLimits(request, model)

    // Execute completion
    const response = await this.doComplete(limitedRequest)

    // Calculate and add cost if usage provided
    if (response.usage) {
      const cost = this.calculateCost(response.usage)
      response.metadata = {
        ...response.metadata,
        cost
      }
    }

    return response
  }

  /**
   * Stream text generation (optional)
   */
  async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    const capabilities = this.getAICapabilities()
    if (!capabilities.supportsStreaming) {
      throw new Error('Streaming not supported')
    }

    // Validate and prepare request
    const validation = this.validateCompletionRequest(request)
    if (!validation.valid) {
      throw new Error(`Invalid request: ${validation.error}`)
    }

    const model = await this.getModelInfo(request.model)
    if (!model) {
      throw new Error(`Model ${request.model} not found`)
    }

    const limitedRequest = this.applyModelLimits(request, model)

    // Stream from implementation
    yield* this.doStream(limitedRequest)
  }

  /**
   * Generate embeddings (optional)
   */
  async embeddings(texts: string | string[]): Promise<Embedding[]> {
    const capabilities = this.getAICapabilities()
    if (!capabilities.supportsEmbeddings) {
      throw new Error('Embeddings not supported')
    }

    const textArray = Array.isArray(texts) ? texts : [texts]
    return this.doEmbeddings(textArray)
  }

  /**
   * Process vision input (optional)
   */
  async vision(images: VisionInput[], prompt: string): Promise<VisionResponse> {
    const capabilities = this.getAICapabilities()
    if (!capabilities.supportsVision) {
      throw new Error('Vision not supported')
    }

    return this.doVision(images, prompt)
  }

  /**
   * Process audio input (optional)
   */
  async audio(audio: AudioInput, options?: AudioOptions): Promise<AudioResponse> {
    const capabilities = this.getAICapabilities()
    if (!capabilities.supportsAudio) {
      throw new Error('Audio not supported')
    }

    return this.doAudio(audio, options)
  }

  /**
   * Get model information
   */
  async getModelInfo(modelId: string): Promise<ModelInfo> {
    // Check cache first
    const cached = this.models.get(modelId)
    if (cached) {
      return {
        ...cached,
        vendor: this.name
      }
    }

    // Fetch from implementation
    const model = await this.doGetModelInfo(modelId)
    if (model) {
      this.models.set(modelId, model)
    }

    return {
      ...model,
      vendor: this.name
    }
  }

  /**
   * Calculate cost for usage
   */
  calculateCost(usage: Usage): Cost {
    const model = this.models.get(this.defaultModel || '')
    if (!model || !model.input_cost || !model.output_cost) {
      return {
        total: 0,
        currency: 'USD',
        breakdown: {
          prompt: 0,
          completion: 0
        }
      }
    }

    const promptCost = (usage.prompt_tokens / 1000) * model.input_cost
    const completionCost = (usage.completion_tokens / 1000) * model.output_cost

    return {
      total: promptCost + completionCost,
      currency: 'USD',
      breakdown: {
        prompt: promptCost,
        completion: completionCost,
        cache_hit: usage.prompt_cache_hit_tokens
          ? (usage.prompt_cache_hit_tokens / 1000) * model.input_cost * 0.1
          : undefined,
        cache_miss: usage.prompt_cache_miss_tokens
          ? (usage.prompt_cache_miss_tokens / 1000) * model.input_cost
          : undefined
      }
    }
  }

  /**
   * Validate API credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      // Try to list models or make a minimal request
      const models = await this.listModels?.()
      return models !== undefined && models.length > 0
    } catch {
      return false
    }
  }

  /**
   * Get base capabilities
   */
  getCapabilities(): ConnectorCapabilities {
    const aiCaps = this.getAICapabilities()
    return {
      features: [
        'ai_completion',
        ...(aiCaps.supportsStreaming ? ['streaming'] : []),
        ...(aiCaps.supportsEmbeddings ? ['embeddings'] : []),
        ...(aiCaps.supportsVision ? ['vision'] : []),
        ...(aiCaps.supportsAudio ? ['audio'] : []),
        ...(aiCaps.supportsFunctionCalling ? ['function_calling'] : []),
        ...(aiCaps.supportsJsonMode ? ['json_mode'] : [])
      ],
      rateLimits: aiCaps.rateLimits
        ? [
            {
              resource: 'requests',
              limit: aiCaps.rateLimits.requests_per_minute || 60,
              window: 60
            },
            {
              resource: 'tokens',
              limit: aiCaps.rateLimits.tokens_per_minute || 90000,
              window: 60
            }
          ]
        : []
    }
  }

  /**
   * Validate completion request
   */
  protected validateCompletionRequest(request: CompletionRequest): {
    valid: boolean
    error?: string
  } {
    if (!request.model) {
      return { valid: false, error: 'Model is required' }
    }

    if (!request.messages || request.messages.length === 0) {
      return { valid: false, error: 'Messages are required' }
    }

    const capabilities = this.getAICapabilities()

    // Check max tokens
    if (request.max_tokens && request.max_tokens > capabilities.maxOutputTokens) {
      return { valid: false, error: `Max tokens exceeds limit of ${capabilities.maxOutputTokens}` }
    }

    // Check JSON mode support
    if (request.response_format?.type === 'json_object' && !capabilities.supportsJsonMode) {
      return { valid: false, error: 'JSON mode not supported' }
    }

    // Check function calling support
    if (request.tools && request.tools.length > 0 && !capabilities.supportsFunctionCalling) {
      return { valid: false, error: 'Function calling not supported' }
    }

    return { valid: true }
  }

  /**
   * Apply model limits to request
   */
  protected applyModelLimits(request: CompletionRequest, model: Model): CompletionRequest {
    const limited = { ...request }

    // Limit max tokens
    if (!limited.max_tokens || limited.max_tokens > (model.max_output_tokens || 4096)) {
      limited.max_tokens = model.max_output_tokens || 4096
    }

    // Implement context window limiting
    if (limited.messages && model.context_window) {
      const contextLimit = model.context_window
      const outputTokens = limited.max_tokens || 4096
      const availableForInput = contextLimit - outputTokens

      // Estimate tokens in messages (rough estimate: 1 token ≈ 4 characters)
      let estimatedTokens = 0
      const limitedMessages = []

      // Process messages from most recent to oldest to preserve recent context
      for (let i = limited.messages.length - 1; i >= 0; i--) {
        const message = limited.messages[i]
        if (!message) continue

        // Handle both string and MessageContent[] content
        const contentLength =
          typeof message.content === 'string'
            ? message.content.length
            : JSON.stringify(message.content).length
        const messageTokens = Math.ceil(contentLength / 4)

        if (estimatedTokens + messageTokens <= availableForInput) {
          limitedMessages.unshift(message)
          estimatedTokens += messageTokens
        } else if (i === limited.messages.length - 1) {
          // Always include the most recent message, but truncate if needed
          const availableChars = Math.max(100, (availableForInput - estimatedTokens) * 4)

          // Only truncate if content is a string
          if (typeof message.content === 'string') {
            limitedMessages.unshift({
              ...message,
              content: message.content.substring(0, availableChars) + '...[truncated]'
            })
          } else {
            // For complex content, include as-is but stop here
            limitedMessages.unshift(message)
          }
          break
        } else {
          // Skip older messages that don't fit
          break
        }
      }

      limited.messages = limitedMessages.filter((m): m is Message => m !== undefined)

      // Log if messages were truncated
      if (limitedMessages.length < request.messages.length) {
        console.warn('Context window limit reached, truncated messages', {
          original: request.messages.length,
          limited: limitedMessages.length,
          contextWindow: contextLimit
        })
      }
    }

    return limited
  }

  /**
   * Initialize API key from config
   */
  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    this.apiKey = config.apiKey as string | undefined
    if (!this.apiKey) {
      throw new Error('API key is required')
    }

    // Load available models
    const models = await this.listModels?.()
    if (models) {
      models.forEach(model => this.models.set(model.id, model))
    }

    // Set default model
    this.defaultModel = (config.defaultModel as string | undefined) || models?.[0]?.id
  }

  /**
   * Abstract methods for implementations
   */
  protected abstract doComplete(request: CompletionRequest): Promise<CompletionResponse>
  protected abstract doStream(request: CompletionRequest): AsyncGenerator<StreamChunk>
  protected abstract doEmbeddings(texts: string[]): Promise<Embedding[]>
  protected abstract doVision(images: VisionInput[], prompt: string): Promise<VisionResponse>
  protected abstract doAudio(audio: AudioInput, options?: AudioOptions): Promise<AudioResponse>
  protected abstract doGetModelInfo(modelId: string): Promise<Model>
  abstract listModels?(): Promise<Model[]>
  abstract getAICapabilities(): AICapabilities
}
