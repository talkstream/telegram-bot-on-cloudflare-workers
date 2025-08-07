import { logger } from '../../logger'
import type {
  CompletionRequest,
  CompletionResponse,
  Message,
  ProviderCapabilities,
  ProviderConfig,
  StreamChunk
} from '../types'
import { AIProviderError } from '../types'

import { BaseAIProvider } from './base'

export interface AnthropicConfig {
  apiKey: string
  model?: string
  baseURL?: string
}

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AnthropicRequest {
  model: string
  messages: AnthropicMessage[]
  max_tokens: number
  temperature?: number
  top_p?: number
  stop_sequences?: string[]
  stream?: boolean
  system?: string
}

interface AnthropicResponse {
  id: string
  type: 'message'
  role: 'assistant'
  content: Array<{
    type: 'text'
    text: string
  }>
  model: string
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null
  stop_sequence: string | null
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

interface AnthropicStreamResponse {
  type:
    | 'message_start'
    | 'content_block_start'
    | 'content_block_delta'
    | 'content_block_stop'
    | 'message_delta'
    | 'message_stop'
    | 'error'
  message?: AnthropicResponse
  delta?: {
    text?: string
    stop_reason?: string
    stop_sequence?: string | null
  }
  index?: number
  content_block?: {
    type: 'text'
    text: string
  }
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
  error?: {
    type: string
    message: string
  }
}

/**
 * Adapter for Anthropic Claude AI
 */
export class AnthropicProvider extends BaseAIProvider {
  private apiKey: string
  private modelName: string
  private baseURL: string

  constructor(config: AnthropicConfig, tier?: 'free' | 'paid') {
    super({
      id: 'anthropic',
      displayName: 'Anthropic Claude',
      type: 'anthropic',
      config: { ...config } as Record<string, unknown>,
      tier: tier || 'paid'
    })

    this.apiKey = config.apiKey
    this.modelName = config.model || 'claude-sonnet-4-20250514'
    this.baseURL = config.baseURL || 'https://api.anthropic.com'
  }

  async doComplete(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const anthropicRequest = this.buildRequest(request)
      const response = await this.makeRequest(anthropicRequest)

      logger.info('Anthropic AI call successful')

      return {
        content: response.content[0]?.text || '',
        usage: {
          inputUnits: response.usage.input_tokens,
          outputUnits: response.usage.output_tokens,
          totalUnits: response.usage.input_tokens + response.usage.output_tokens
        },
        metadata: {
          model: response.model,
          providerId: this.id,
          processingTimeMs: Date.now(),
          custom: {
            stopReason: response.stop_reason,
            stopSequence: response.stop_sequence
          }
        }
      }
    } catch (error) {
      logger.error('Error calling Anthropic AI:', error)
      throw this.normalizeError(error)
    }
  }

  override async *stream(request: CompletionRequest): AsyncIterator<StreamChunk> {
    try {
      const anthropicRequest = this.buildRequest(request)
      anthropicRequest.stream = true

      const stream = await this.makeStreamRequest(anthropicRequest)

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
          yield {
            content: chunk.delta.text,
            done: false
          }
        } else if (chunk.type === 'message_stop') {
          yield {
            content: '',
            done: true,
            metadata: {
              model: this.modelName,
              providerId: this.id
            }
          }
        } else if (chunk.type === 'error') {
          throw new Error(chunk.error?.message || 'Stream error')
        }
      }
    } catch (error) {
      logger.error('Error streaming from Anthropic:', error)
      throw this.normalizeError(error)
    }
  }

  async doValidateConfig(config: ProviderConfig): Promise<boolean> {
    if (!config.config?.apiKey) {
      return false
    }

    try {
      // Validate by making a minimal request
      const testRequest: AnthropicRequest = {
        model: this.modelName,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1
      }

      await this.makeRequest(testRequest, config.config.apiKey as string)
      return true
    } catch {
      return false
    }
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      maxTokens: 64000, // Claude 4 supports up to 64K output tokens
      maxContextLength: 200000, // Claude 4 supports 200k context
      supportedOptions: ['temperature', 'maxTokens', 'topP', 'stopSequences'],
      supportedModels: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514'],
      customFeatures: {
        systemPrompts: true,
        visionSupport: true,
        functionCalling: true,
        xmlMode: true,
        extendedThinking: true
      }
    }
  }

  private buildRequest(request: CompletionRequest): AnthropicRequest {
    const { messages, options } = request

    // Extract system message if present
    const systemMessage = messages.find(m => m.role === 'system')
    const nonSystemMessages = messages.filter(m => m.role !== 'system')

    // Convert messages to Anthropic format
    const anthropicMessages = this.convertMessages(nonSystemMessages)

    const anthropicRequest: AnthropicRequest = {
      model: this.modelName,
      messages: anthropicMessages,
      max_tokens: options?.maxTokens || 1024
    }

    // Add system prompt if present
    if (systemMessage) {
      anthropicRequest.system = systemMessage.content
    }

    // Add optional parameters
    if (options?.temperature !== undefined) {
      anthropicRequest.temperature = options.temperature
    }
    if (options?.topP !== undefined) {
      anthropicRequest.top_p = options.topP
    }
    if (options?.stopSequences) {
      anthropicRequest.stop_sequences = options.stopSequences
    }

    return anthropicRequest
  }

  private convertMessages(messages: Message[]): AnthropicMessage[] {
    const anthropicMessages: AnthropicMessage[] = []

    for (const message of messages) {
      if (message.role === 'system') {
        // System messages are handled separately in Anthropic
        continue
      }

      anthropicMessages.push({
        role: message.role === 'user' ? 'user' : 'assistant',
        content: message.content
      })
    }

    // Ensure messages alternate between user and assistant
    // and start with a user message
    if (anthropicMessages.length > 0 && anthropicMessages[0]?.role !== 'user') {
      anthropicMessages.unshift({
        role: 'user',
        content: 'Continue the conversation'
      })
    }

    return anthropicMessages
  }

  private async makeRequest(
    request: AnthropicRequest,
    apiKeyOverride?: string
  ): Promise<AnthropicResponse> {
    const apiKey = apiKeyOverride || this.apiKey

    const response = await fetch(`${this.baseURL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic API error: ${response.status} - ${error}`)
    }

    return response.json() as Promise<AnthropicResponse>
  }

  private async *makeStreamRequest(
    request: AnthropicRequest
  ): AsyncGenerator<AnthropicStreamResponse> {
    const response = await fetch(`${this.baseURL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic API error: ${response.status} - ${error}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body reader available')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data) as AnthropicStreamResponse
              yield parsed
            } catch (e) {
              logger.warn('Failed to parse stream chunk:', e)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  protected override normalizeError(error: unknown): AIProviderError {
    // Check for specific Anthropic error patterns first
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      if (message.includes('rate limit')) {
        return new AIProviderError(error.message, 'RATE_LIMIT', this.id, true, error)
      }

      if (message.includes('invalid api key') || message.includes('unauthorized')) {
        return new AIProviderError(error.message, 'AUTHENTICATION_ERROR', this.id, false, error)
      }

      if (message.includes('overloaded')) {
        return new AIProviderError(error.message, 'PROVIDER_ERROR', this.id, true, error)
      }

      if (message.includes('context length') || message.includes('max tokens')) {
        return new AIProviderError(error.message, 'INVALID_REQUEST', this.id, false, error)
      }
    }

    // Fall back to base class error normalization
    return super.normalizeError(error)
  }
}
