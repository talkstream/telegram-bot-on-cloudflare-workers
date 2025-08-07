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

interface CloudflareAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface CloudflareAIRequest {
  messages: CloudflareAIMessage[]
  max_tokens?: number
  temperature?: number
  stream?: boolean
}

interface CloudflareAIResponse {
  result: {
    response: string
  }
  success: boolean
  errors: Array<{ message: string }>
  messages: Array<{ message: string }>
}

interface CloudflareAIStreamResponse {
  response: string
  p?: string // partial response indicator
}

export interface CloudflareAIConfig {
  accountId: string
  apiToken: string
  model?: string
}

/**
 * Adapter for Cloudflare Workers AI
 */
export class CloudflareAIProvider extends BaseAIProvider {
  private accountId: string
  private apiToken: string
  private model: string
  private baseUrl: string

  constructor(config: CloudflareAIConfig, tier?: 'free' | 'paid') {
    super({
      id: 'cloudflare-ai',
      displayName: 'Cloudflare Workers AI',
      type: 'cloudflare-ai',
      config: { ...config } as Record<string, unknown>,
      tier: tier || 'free'
    })

    this.accountId = config.accountId
    this.apiToken = config.apiToken
    this.model = config.model || '@cf/meta/llama-3.1-8b-instruct'
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run`
  }

  async doComplete(request: CompletionRequest): Promise<CompletionResponse> {
    const cfRequest: CloudflareAIRequest = {
      messages: request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    }

    // Apply options
    if (request.options) {
      if (request.options.maxTokens !== undefined) {
        cfRequest.max_tokens = request.options.maxTokens
      }
      if (request.options.temperature !== undefined) {
        cfRequest.temperature = request.options.temperature
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/${this.model}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cfRequest)
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Cloudflare AI error: ${response.status} - ${error}`)
      }

      const data: CloudflareAIResponse = await response.json()

      if (!data.success) {
        const errorMsg = data.errors?.map(e => e.message).join(', ') || 'Unknown error'
        throw new Error(`Cloudflare AI request failed: ${errorMsg}`)
      }

      // Cloudflare AI doesn't provide token usage in the same format
      // We'll estimate based on the response
      const usage: UsageMetrics = {
        inputUnits: this.estimateTokens(request.messages.map(m => m.content).join(' ')),
        outputUnits: this.estimateTokens(data.result.response)
      }

      logger.info('Cloudflare AI call successful')

      return {
        content: data.result.response,
        usage,
        metadata: {
          model: this.model,
          providerId: this.id,
          processingTimeMs: Date.now()
        }
      }
    } catch (error) {
      logger.error('Error calling Cloudflare AI:', error)
      throw this.normalizeError(error)
    }
  }

  override async *stream(request: CompletionRequest): AsyncIterator<StreamChunk> {
    const cfRequest: CloudflareAIRequest = {
      messages: request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      stream: true
    }

    // Apply options
    if (request.options) {
      if (request.options.maxTokens !== undefined) {
        cfRequest.max_tokens = request.options.maxTokens
      }
      if (request.options.temperature !== undefined) {
        cfRequest.temperature = request.options.temperature
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/${this.model}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cfRequest)
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Cloudflare AI error: ${response.status} - ${error}`)
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
          if (line.trim() === '' || !line.startsWith('data: ')) {
            continue
          }

          const data = line.slice(6)
          if (data === '[DONE]') {
            continue
          }

          try {
            const parsed: CloudflareAIStreamResponse = JSON.parse(data)
            yield {
              content: parsed.response || '',
              done: !parsed.p,
              metadata: {
                model: this.model,
                providerId: this.id
              }
            }
          } catch (e) {
            logger.warn('Failed to parse stream chunk:', e)
          }
        }
      }
    } catch (error) {
      logger.error('Cloudflare AI streaming error:', error)
      throw this.normalizeError(error)
    }
  }

  async doValidateConfig(config: ProviderConfig): Promise<boolean> {
    if (!config.config?.accountId || !config.config?.apiToken) {
      return false
    }

    try {
      // Validate by listing available models
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${config.config.accountId}/ai/models/search`,
        {
          headers: {
            Authorization: `Bearer ${config.config.apiToken}`
          }
        }
      )

      return response.ok
    } catch {
      return false
    }
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      maxTokens: 2048, // Varies by model
      maxContextLength: 16384, // Varies by model
      supportedOptions: ['temperature', 'maxTokens'],
      supportedModels: [
        '@cf/meta/llama-3.1-8b-instruct',
        '@cf/meta/llama-3.2-1b-instruct',
        '@cf/mistral/mistral-7b-instruct-v0.1',
        '@cf/microsoft/phi-2',
        '@cf/qwen/qwen1.5-0.5b-chat',
        '@cf/google/gemma-3-12b-it'
      ],
      customFeatures: {
        edgeComputing: true,
        neuronPricing: true,
        freeAllocation: true
      }
    }
  }

  /**
   * Simple token estimation (roughly 4 characters per token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  protected override normalizeError(error: unknown): AIProviderError {
    const baseError = super.normalizeError(error)

    // Check for specific Cloudflare AI error patterns
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        return {
          ...baseError,
          code: 'RATE_LIMIT',
          retryable: true
        }
      }
      if (error.message.includes('quota')) {
        return {
          ...baseError,
          code: 'QUOTA_EXCEEDED',
          retryable: false
        }
      }
      if (error.message.includes('401') || error.message.includes('403')) {
        return {
          ...baseError,
          code: 'AUTHENTICATION_ERROR',
          retryable: false
        }
      }
    }

    return baseError
  }
}

/**
 * Alternative implementation using the AI binding (when available in Workers environment)
 */
interface AIBinding {
  run(
    model: string,
    inputs: CloudflareAIRequest
  ): Promise<{
    response: string
  }>
}

export class CloudflareAIBindingProvider extends BaseAIProvider {
  private ai: AIBinding
  private model: string

  constructor(ai: AIBinding, model?: string, tier?: 'free' | 'paid') {
    super({
      id: 'cloudflare-ai-binding',
      displayName: 'Cloudflare Workers AI (Binding)',
      type: 'cloudflare-ai-binding',
      tier: tier || 'free'
    })

    this.ai = ai
    this.model = model || '@cf/meta/llama-3.1-8b-instruct'
  }

  async doComplete(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const messages = request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const cfRequest: CloudflareAIRequest = {
        messages
      }

      if (request.options?.maxTokens !== undefined) {
        cfRequest.max_tokens = request.options.maxTokens
      }

      if (request.options?.temperature !== undefined) {
        cfRequest.temperature = request.options.temperature
      }

      const response = await this.ai.run(this.model, cfRequest)

      const content = response.response || ''

      // Estimate usage
      const usage: UsageMetrics = {
        inputUnits: this.estimateTokens(request.messages.map(m => m.content).join(' ')),
        outputUnits: this.estimateTokens(content)
      }

      return {
        content,
        usage,
        metadata: {
          model: this.model,
          providerId: this.id
        }
      }
    } catch (error) {
      logger.error('Error calling Cloudflare AI Binding:', error)
      throw this.normalizeError(error)
    }
  }

  async doValidateConfig(): Promise<boolean> {
    // AI binding is always valid if provided
    return !!this.ai
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: false, // Streaming through binding requires different implementation
      maxTokens: 2048,
      maxContextLength: 16384,
      supportedOptions: ['temperature', 'maxTokens'],
      supportedModels: [
        '@cf/meta/llama-3.1-8b-instruct',
        '@cf/meta/llama-3.2-1b-instruct',
        '@cf/mistral/mistral-7b-instruct-v0.1',
        '@cf/microsoft/phi-2'
      ],
      customFeatures: {
        edgeComputing: true,
        binding: true,
        zeroLatency: true
      }
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }
}
