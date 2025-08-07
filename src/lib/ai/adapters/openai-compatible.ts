import { logger } from '../../logger'
import type {
  CompletionRequest,
  CompletionResponse,
  ProviderCapabilities,
  ProviderConfig,
  StreamChunk,
  UsageMetrics
} from '../types'
import { AIProviderError } from '../types'

import { BaseAIProvider } from './base'

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAIRequest {
  model: string
  messages: OpenAIMessage[]
  temperature?: number
  max_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  stop?: string[]
  stream?: boolean
}

interface OpenAIResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface OpenAIStreamChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      content?: string
    }
    finish_reason?: string | null
  }>
}

export interface OpenAICompatibleConfig {
  apiKey: string
  apiUrl?: string
  model?: string
  organization?: string
  defaultOptions?: Partial<OpenAIRequest>
}

/**
 * Adapter for OpenAI-compatible APIs (OpenAI, xAI, DeepSeek, etc.)
 */
export class OpenAICompatibleProvider extends BaseAIProvider {
  private apiKey: string
  private apiUrl: string
  private model: string
  private organization?: string
  private defaultOptions: Partial<OpenAIRequest>

  constructor(
    id: string,
    displayName: string,
    config: OpenAICompatibleConfig,
    tier?: 'free' | 'paid'
  ) {
    super({
      id,
      displayName,
      type: 'openai-compatible',
      config: { ...config } as Record<string, unknown>,
      tier: tier || 'free'
    })

    this.apiKey = config.apiKey
    this.apiUrl = config.apiUrl || 'https://api.openai.com/v1'
    this.model = config.model || 'gpt-3.5-turbo'
    if (config.organization) {
      this.organization = config.organization
    }
    this.defaultOptions = config.defaultOptions || {}
  }

  async doComplete(request: CompletionRequest): Promise<CompletionResponse> {
    const openAIRequest: OpenAIRequest = {
      model: this.model,
      messages: this.transformMessages(request.messages) as OpenAIMessage[],
      ...this.defaultOptions
    }

    // Apply request options
    if (request.options) {
      if (request.options.temperature !== undefined) {
        openAIRequest.temperature = request.options.temperature
      }
      if (request.options.maxTokens !== undefined) {
        openAIRequest.max_tokens = request.options.maxTokens
      }
      if (request.options.topP !== undefined) {
        openAIRequest.top_p = request.options.topP
      }
      if (request.options.frequencyPenalty !== undefined) {
        openAIRequest.frequency_penalty = request.options.frequencyPenalty
      }
      if (request.options.presencePenalty !== undefined) {
        openAIRequest.presence_penalty = request.options.presencePenalty
      }
      if (request.options.stopSequences !== undefined) {
        openAIRequest.stop = request.options.stopSequences
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`
    }

    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization
    }

    try {
      const response = await fetch(`${this.apiUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(openAIRequest)
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`API error: ${response.status} - ${error}`)
      }

      const data: OpenAIResponse = await response.json()

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No completion choices returned')
      }

      const usage: UsageMetrics = {
        inputUnits: data.usage?.prompt_tokens || 0,
        outputUnits: data.usage?.completion_tokens || 0,
        totalUnits: data.usage?.total_tokens || 0
      }

      return {
        content: data.choices[0]?.message?.content || '',
        usage,
        metadata: {
          model: data.model,
          providerId: this.id,
          processingTimeMs: Date.now() - data.created * 1000
        }
      }
    } catch (error) {
      logger.error(`OpenAI-compatible API error for ${this.id}:`, error)
      throw this.normalizeError(error)
    }
  }

  override async *stream(request: CompletionRequest): AsyncIterator<StreamChunk> {
    const openAIRequest: OpenAIRequest = {
      model: this.model,
      messages: this.transformMessages(request.messages) as OpenAIMessage[],
      stream: true,
      ...this.defaultOptions
    }

    // Apply request options (same as doComplete)
    if (request.options) {
      if (request.options.temperature !== undefined) {
        openAIRequest.temperature = request.options.temperature
      }
      if (request.options.maxTokens !== undefined) {
        openAIRequest.max_tokens = request.options.maxTokens
      }
      // ... other options
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`
    }

    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization
    }

    try {
      const response = await fetch(`${this.apiUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(openAIRequest)
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`API error: ${response.status} - ${error}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim() === '' || line.trim() === 'data: [DONE]') {
            continue
          }

          if (line.startsWith('data: ')) {
            try {
              const data: OpenAIStreamChunk = JSON.parse(line.slice(6))
              const content = data.choices[0]?.delta?.content || ''
              const isDone = data.choices[0]?.finish_reason !== null

              yield {
                content,
                done: isDone,
                metadata: {
                  model: data.model,
                  providerId: this.id
                }
              }
            } catch (e) {
              logger.warn('Failed to parse stream chunk:', e)
            }
          }
        }
      }
    } catch (error) {
      logger.error(`OpenAI-compatible streaming error for ${this.id}:`, error)
      throw this.normalizeError(error)
    }
  }

  async doValidateConfig(config: ProviderConfig): Promise<boolean> {
    if (!config.config?.apiKey) {
      return false
    }

    // Optionally validate by making a test request
    try {
      await this.getHealthStatus()
      return true
    } catch {
      return false
    }
  }

  getCapabilities(): ProviderCapabilities {
    // These are typical capabilities - can be overridden for specific providers
    return {
      streaming: true,
      maxTokens: 4096,
      maxContextLength: 16384,
      supportedOptions: [
        'temperature',
        'maxTokens',
        'topP',
        'frequencyPenalty',
        'presencePenalty',
        'stopSequences'
      ],
      supportedModels: this.getSupportedModels(),
      customFeatures: {
        hasOrganization: !!this.organization,
        apiUrl: this.apiUrl
      }
    }
  }

  private getSupportedModels(): string[] {
    // Return models based on provider ID
    switch (this.id) {
      case 'openai':
        return ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'o1', 'o1-mini']
      case 'xai':
        return ['grok-3', 'grok-3-mini']
      case 'deepseek':
        return ['deepseek-chat', 'deepseek-reasoner']
      default:
        return [this.model]
    }
  }

  protected override normalizeError(error: unknown): AIProviderError {
    const baseError = super.normalizeError(error)

    // Check for specific OpenAI error patterns
    if (error instanceof Error) {
      if (error.message.includes('429')) {
        return new AIProviderError('Rate limit exceeded', 'RATE_LIMIT', this.id, true, error)
      }
      if (error.message.includes('401')) {
        return new AIProviderError('Invalid API key', 'AUTHENTICATION_ERROR', this.id, false, error)
      }
      if (error.message.includes('quota')) {
        return new AIProviderError('Quota exceeded', 'QUOTA_EXCEEDED', this.id, false, error)
      }
    }

    return baseError
  }
}

// Factory functions for common providers
export function createOpenAIProvider(
  apiKey: string,
  model?: string,
  tier?: 'free' | 'paid'
): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider(
    'openai',
    'OpenAI',
    {
      apiKey,
      model: model || 'gpt-3.5-turbo'
    },
    tier
  )
}

export function createXAIProvider(
  apiKey: string,
  model?: string,
  tier?: 'free' | 'paid'
): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider(
    'xai',
    'xAI Grok',
    {
      apiKey,
      apiUrl: 'https://api.x.ai/v1',
      model: model || 'grok-3-mini'
    },
    tier
  )
}

export function createDeepSeekProvider(
  apiKey: string,
  model?: string,
  tier?: 'free' | 'paid'
): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider(
    'deepseek',
    'DeepSeek',
    {
      apiKey,
      apiUrl: 'https://api.deepseek.com/v1',
      model: model || 'deepseek-chat'
    },
    tier
  )
}
