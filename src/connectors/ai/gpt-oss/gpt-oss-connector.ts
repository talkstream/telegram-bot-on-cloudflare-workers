/**
 * GPT-OSS (Open Source) Connector for Cloudflare Workers AI
 *
 * Provides integration with the gpt-oss-120b model
 * A 120 billion parameter open-source LLM optimized for Workers
 * @module connectors/ai/gpt-oss/gpt-oss-connector
 */

import { BaseConnector } from '@/connectors/base/base-connector'
import { EventBus } from '@/core/events/event-bus'
import type {
  AICapabilities,
  AIConnector,
  CompletionRequest,
  CompletionResponse,
  Cost,
  FinishReason,
  MessageRole,
  ModelInfo,
  StreamChunk,
  Usage
} from '@/core/interfaces/ai'
import type {
  ConnectorCapabilities,
  ConnectorConfig,
  HealthStatus,
  ValidationResult
} from '@/core/interfaces/connector'
import { ConnectorType } from '@/core/interfaces/connector'
import { logger } from '@/lib/logger'

export interface GPTOSSConfig extends ConnectorConfig {
  accountId: string
  apiToken?: string
  baseUrl?: string
  maxTokens?: number
  temperature?: number
  topP?: number
  eventBus?: EventBus
}

export class GPTOSSConnector extends BaseConnector implements AIConnector {
  id = 'gpt-oss-connector'
  name = 'GPT-OSS 120B Connector'
  version = '1.0.0'
  type = ConnectorType.AI

  private accountId!: string
  private apiToken?: string
  private baseUrl: string
  private maxTokens: number
  private temperature: number
  private topP: number

  constructor(config?: GPTOSSConfig) {
    super()
    if (config) {
      this.accountId = config.accountId
      this.apiToken = config.apiToken
      this.baseUrl = config.baseUrl || 'https://api.cloudflare.com/client/v4'
      this.maxTokens = config.maxTokens || 2048
      this.temperature = config.temperature || 0.7
      this.topP = config.topP || 0.9
      if (config.eventBus) {
        this.eventBus = config.eventBus
      }
    } else {
      this.baseUrl = 'https://api.cloudflare.com/client/v4'
      this.maxTokens = 2048
      this.temperature = 0.7
      this.topP = 0.9
    }
  }

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const gptConfig = config as GPTOSSConfig

    this.accountId = gptConfig.accountId
    this.apiToken = gptConfig.apiToken
    this.baseUrl = gptConfig.baseUrl || this.baseUrl
    this.maxTokens = gptConfig.maxTokens || this.maxTokens
    this.temperature = gptConfig.temperature || this.temperature
    this.topP = gptConfig.topP || this.topP

    logger.info('[GPTOSSConnector] Initializing GPT-OSS 120B connector', {
      accountId: this.accountId,
      baseUrl: this.baseUrl,
      model: 'gpt-oss-120b'
    })

    // Validate credentials if available
    if (this.apiToken) {
      const valid = await this.validateCredentials()
      if (!valid) {
        throw new Error('Invalid API credentials for GPT-OSS')
      }
    }

    this.emitEvent('ai:connector:initialized', {
      connector: this.id,
      model: 'gpt-oss-120b',
      capabilities: this.getAICapabilities()
    })
  }

  protected doValidateConfig(config: ConnectorConfig): ValidationResult['errors'] {
    const errors: ValidationResult['errors'] = []
    const gptConfig = config as GPTOSSConfig

    if (!gptConfig.accountId) {
      errors?.push({
        field: 'accountId',
        message: 'Cloudflare account ID is required',
        code: 'REQUIRED_FIELD'
      })
    }

    if (gptConfig.maxTokens && gptConfig.maxTokens > 4096) {
      errors?.push({
        field: 'maxTokens',
        message: 'Max tokens cannot exceed 4096 for GPT-OSS',
        code: 'INVALID_VALUE'
      })
    }

    if (gptConfig.temperature && (gptConfig.temperature < 0 || gptConfig.temperature > 2)) {
      errors?.push({
        field: 'temperature',
        message: 'Temperature must be between 0 and 2',
        code: 'INVALID_VALUE'
      })
    }

    return errors
  }

  protected checkReadiness(): boolean {
    return !!this.accountId
  }

  protected async checkHealth(): Promise<Partial<HealthStatus>> {
    try {
      // Check if the model is available
      const modelInfo = await this.getModelInfo('gpt-oss-120b')

      return {
        status: modelInfo ? 'healthy' : 'degraded',
        message: modelInfo ? 'GPT-OSS connector is operational' : 'Model unavailable',
        details: {
          model: 'gpt-oss-120b',
          available: !!modelInfo
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Failed to check model availability',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  protected async doDestroy(): Promise<void> {
    logger.info('[GPTOSSConnector] Destroying GPT-OSS connector')

    this.emitEvent('ai:connector:destroyed', {
      connector: this.id
    })
  }

  getCapabilities(): ConnectorCapabilities {
    return {
      supportsAsync: true,
      supportsSync: true,
      supportsBatching: false,
      supportsStreaming: true,
      maxBatchSize: 1,
      maxConcurrent: 10,
      features: ['completion', 'streaming', 'chat', 'code-generation', 'reasoning', '120b-params']
    }
  }

  getAICapabilities(): AICapabilities {
    return {
      models: ['gpt-oss-120b'],
      maxContextWindow: 32768,
      maxOutputTokens: 4096,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsAudio: false,
      supportsEmbeddings: false,
      supportsJsonMode: true,
      custom: {
        features: {
          chat: true,
          completion: true,
          codeGeneration: true,
          reasoning: true,
          multiTurn: true,
          systemPrompt: true
        }
      }
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      logger.info('[GPTOSSConnector] Processing completion request', {
        model: request.model || 'gpt-oss-120b',
        messageCount: request.messages.length,
        maxTokens: request.max_tokens || this.maxTokens
      })

      const startTime = Date.now()

      // Prepare the request payload for Cloudflare Workers AI
      const payload = {
        messages: request.messages.map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : msg.content[0]?.text || ''
        })),
        max_tokens: request.max_tokens || this.maxTokens,
        temperature: request.temperature || this.temperature,
        top_p: request.top_p || this.topP,
        stream: false
      }

      // Make API call to Cloudflare Workers AI
      const response = await this.callAPI(payload)

      const latency = Date.now() - startTime

      // Parse and format the response
      const result = response as {
        result?: { response?: string; prompt_tokens?: number; completion_tokens?: number }
      }
      const completionResponse: CompletionResponse = {
        id: `gpt-oss-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        model: 'gpt-oss-120b',
        content: result.result?.response || '',
        role: 'assistant' as MessageRole,
        finish_reason: 'stop' as FinishReason,
        usage: {
          prompt_tokens: result.result?.prompt_tokens || 0,
          completion_tokens: result.result?.completion_tokens || 0,
          total_tokens:
            (result.result?.prompt_tokens || 0) + (result.result?.completion_tokens || 0)
        },
        metadata: {
          latency,
          provider: 'cloudflare',
          model_version: '120b'
        }
      }

      logger.info('[GPTOSSConnector] Completion successful', {
        requestId: completionResponse.id,
        tokens: completionResponse.usage?.total_tokens,
        latency
      })

      this.emitEvent('ai:completion:success', {
        connector: this.id,
        requestId: completionResponse.id,
        usage: completionResponse.usage,
        latency
      })

      return completionResponse
    } catch (error) {
      logger.error('[GPTOSSConnector] Completion failed', error)

      this.emitEvent('ai:completion:error', {
        connector: this.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    }
  }

  async *stream(request: CompletionRequest): AsyncIterator<StreamChunk> {
    try {
      logger.info('[GPTOSSConnector] Starting streaming completion', {
        model: request.model || 'gpt-oss-120b',
        messageCount: request.messages.length
      })

      const payload = {
        messages: request.messages.map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : msg.content[0]?.text || ''
        })),
        max_tokens: request.max_tokens || this.maxTokens,
        temperature: request.temperature || this.temperature,
        top_p: request.top_p || this.topP,
        stream: true
      }

      // Stream response from API
      const stream = await this.callStreamingAPI(payload)
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const chunk = JSON.parse(data)
              yield {
                id: chunk.id || `chunk-${Date.now()}`,
                delta: {
                  content: chunk.response || chunk.content || '',
                  role: 'assistant' as MessageRole
                },
                finish_reason: chunk.finish_reason as FinishReason | undefined,
                usage: chunk.usage
              }
            } catch (e) {
              logger.warn('[GPTOSSConnector] Failed to parse chunk', { line, error: e })
            }
          }
        }
      }

      this.emitEvent('ai:stream:complete', {
        connector: this.id
      })
    } catch (error) {
      logger.error('[GPTOSSConnector] Streaming failed', error)

      this.emitEvent('ai:stream:error', {
        connector: this.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    }
  }

  async getModelInfo(modelId: string): Promise<ModelInfo> {
    if (modelId !== 'gpt-oss-120b') {
      throw new Error(`Model ${modelId} not supported by GPT-OSS connector`)
    }

    return {
      id: 'gpt-oss-120b',
      name: 'GPT-OSS 120B',
      description: 'Open-source 120 billion parameter model optimized for Cloudflare Workers',
      vendor: 'cloudflare',
      context_window: 32768,
      max_output_tokens: 4096,
      input_cost: 0.0001, // $0.10 per 1K tokens
      output_cost: 0.0003, // $0.30 per 1K tokens,
      capabilities: {
        chat: true,
        completion: true,
        embeddings: false,
        vision: false,
        audio: false,
        function_calling: true,
        json_mode: true,
        streaming: true
      },
      version: '120B',
      release_date: '2025-01'
    }
  }

  calculateCost(usage: Usage): Cost {
    const promptCost = (usage.prompt_tokens / 1_000_000) * 0.1
    const completionCost = (usage.completion_tokens / 1_000_000) * 0.3

    return {
      total: promptCost + completionCost,
      currency: 'USD',
      breakdown: {
        prompt: promptCost,
        completion: completionCost
      }
    }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      // Test the API by fetching model info
      const response = await fetch(`${this.baseUrl}/accounts/${this.accountId}/ai/models`, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      })

      return response.ok
    } catch (error) {
      logger.error('[GPTOSSConnector] Credential validation failed', error)
      return false
    }
  }

  private async callAPI(payload: Record<string, unknown>): Promise<unknown> {
    const url = `${this.baseUrl}/accounts/${this.accountId}/ai/run/@cf/meta/gpt-oss-120b`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.apiToken ? `Bearer ${this.apiToken}` : '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`GPT-OSS API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  private async callStreamingAPI(payload: Record<string, unknown>): Promise<ReadableStream> {
    const url = `${this.baseUrl}/accounts/${this.accountId}/ai/run/@cf/meta/gpt-oss-120b`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.apiToken ? `Bearer ${this.apiToken}` : '',
        'Content-Type': 'application/json',
        Accept: 'text/event-stream'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`GPT-OSS streaming API error: ${response.status} - ${error}`)
    }

    const body = response.body
    if (!body) {
      throw new Error('Response has no body')
    }
    return body
  }
}
