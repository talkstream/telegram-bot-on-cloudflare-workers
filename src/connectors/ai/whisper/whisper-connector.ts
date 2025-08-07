/**
 * Whisper Connector for Cloudflare Workers AI
 *
 * Provides speech-to-text capabilities using Whisper Large v3 Turbo model
 * Optimized for fast transcription and multi-language support
 * @module connectors/ai/whisper/whisper-connector
 */

import { BaseConnector } from '@/connectors/base/base-connector'
import { EventBus } from '@/core/events/event-bus'
import type {
  AICapabilities,
  AIConnector,
  AudioInput,
  AudioOptions,
  AudioResponse,
  CompletionRequest,
  CompletionResponse,
  Cost,
  ModelInfo,
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

export interface WhisperConfig extends ConnectorConfig {
  accountId: string
  apiToken?: string
  baseUrl?: string
  model?: 'whisper-large-v3-turbo' | 'whisper-small' | 'whisper-tiny'
  language?: string
  eventBus?: EventBus
}

export interface TranscriptionOptions extends AudioOptions {
  language?: string
  task?: 'transcribe' | 'translate'
  temperature?: number
  prompt?: string
  response_format?: 'json' | 'text' | 'srt' | 'vtt' | 'verbose_json'
  timestamp_granularities?: ('word' | 'segment')[]
}

export interface TranscriptionResponse extends AudioResponse {
  text: string
  language?: string
  duration?: number
  words?: Array<{
    word: string
    start: number
    end: number
    confidence?: number
  }>
  segments?: Array<{
    id: number
    text: string
    start: number
    end: number
    confidence?: number
  }>
}

export class WhisperConnector extends BaseConnector implements AIConnector {
  id = 'whisper-connector'
  name = 'Whisper Speech-to-Text Connector'
  version = '1.0.0'
  type = ConnectorType.AI

  private accountId!: string
  private apiToken?: string
  private baseUrl: string
  private model: string
  private defaultLanguage?: string

  constructor(config?: WhisperConfig) {
    super()
    if (config) {
      this.accountId = config.accountId
      this.apiToken = config.apiToken
      this.baseUrl = config.baseUrl || 'https://api.cloudflare.com/client/v4'
      this.model = config.model || 'whisper-large-v3-turbo'
      this.defaultLanguage = config.language
      if (config.eventBus) {
        this.eventBus = config.eventBus
      }
    } else {
      this.baseUrl = 'https://api.cloudflare.com/client/v4'
      this.model = 'whisper-large-v3-turbo'
    }
  }

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const whisperConfig = config as WhisperConfig

    this.accountId = whisperConfig.accountId
    this.apiToken = whisperConfig.apiToken
    this.baseUrl = whisperConfig.baseUrl || this.baseUrl
    this.model = whisperConfig.model || this.model
    this.defaultLanguage = whisperConfig.language

    logger.info('[WhisperConnector] Initializing Whisper connector', {
      accountId: this.accountId,
      model: this.model,
      language: this.defaultLanguage || 'auto-detect'
    })

    // Validate credentials if available
    if (this.apiToken) {
      const valid = await this.validateCredentials()
      if (!valid) {
        throw new Error('Invalid API credentials for Whisper')
      }
    }

    this.emitEvent('ai:audio:connector:initialized', {
      connector: this.id,
      model: this.model,
      capabilities: this.getAICapabilities()
    })
  }

  protected doValidateConfig(config: ConnectorConfig): ValidationResult['errors'] {
    const errors: ValidationResult['errors'] = []
    const whisperConfig = config as WhisperConfig

    if (!whisperConfig.accountId) {
      errors?.push({
        field: 'accountId',
        message: 'Cloudflare account ID is required',
        code: 'REQUIRED_FIELD'
      })
    }

    const validModels = ['whisper-large-v3-turbo', 'whisper-small', 'whisper-tiny']
    if (whisperConfig.model && !validModels.includes(whisperConfig.model)) {
      errors?.push({
        field: 'model',
        message: `Model must be one of: ${validModels.join(', ')}`,
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
      const modelInfo = await this.getModelInfo(this.model)

      return {
        status: modelInfo ? 'healthy' : 'degraded',
        message: modelInfo ? 'Whisper connector is operational' : 'Model unavailable',
        details: {
          model: this.model,
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
    logger.info('[WhisperConnector] Destroying Whisper connector')

    this.emitEvent('ai:audio:connector:destroyed', {
      connector: this.id
    })
  }

  getCapabilities(): ConnectorCapabilities {
    return {
      supportsAsync: true,
      supportsSync: true,
      supportsBatching: true,
      supportsStreaming: false,
      maxBatchSize: 10,
      maxConcurrent: 5,
      features: [
        'speech-to-text',
        'transcription',
        'translation',
        'multi-language',
        'timestamps',
        'word-level-timestamps'
      ]
    }
  }

  getAICapabilities(): AICapabilities {
    return {
      models: ['whisper-large-v3-turbo', 'whisper-small', 'whisper-tiny'],
      maxContextWindow: 0, // Not applicable for audio
      maxOutputTokens: 0, // Not applicable for audio
      supportsStreaming: false,
      supportsFunctionCalling: false,
      supportsVision: false,
      supportsAudio: true,
      supportsEmbeddings: false,
      supportsJsonMode: true,
      custom: {
        features: {
          audioTranscription: true,
          audioTranslation: true,
          multiLanguage: true,
          timestamps: true
        }
      }
    }
  }

  async audio(audio: AudioInput, options?: TranscriptionOptions): Promise<TranscriptionResponse> {
    try {
      logger.info('[WhisperConnector] Processing audio transcription', {
        model: this.model,
        language: options?.language || this.defaultLanguage || 'auto',
        task: options?.task || 'transcribe',
        format: options?.response_format || 'json'
      })

      const startTime = Date.now()

      // Convert audio input to base64 if needed
      const audioData = await this.prepareAudioData(audio)

      // Prepare the request payload
      const payload = {
        audio: audioData,
        model: this.model,
        language: options?.language || this.defaultLanguage,
        task: options?.task || 'transcribe',
        temperature: options?.temperature || 0,
        prompt: options?.prompt,
        response_format: options?.response_format || 'verbose_json',
        timestamp_granularities: options?.timestamp_granularities || ['segment']
      }

      // Make API call to Cloudflare Workers AI
      const response = await this.callAPI(payload)
      const latency = Date.now() - startTime

      // Parse and format the response
      const result = response as {
        text?: string
        language?: string
        duration?: number
        words?: Array<{ word: string; start: number; end: number; confidence: number }>
        segments?: Array<{
          id: number
          start: number
          end: number
          text: string
          confidence?: number
        }>
      }

      const transcriptionResponse: TranscriptionResponse = {
        text: result.text || '',
        language: result.language,
        duration: result.duration,
        words: result.words,
        segments: result.segments,
        metadata: {
          latency,
          model: this.model,
          task: options?.task || 'transcribe',
          provider: 'cloudflare'
        }
      }

      logger.info('[WhisperConnector] Transcription successful', {
        duration: result.duration,
        language: result.language,
        latency,
        wordCount: result.words?.length || 0,
        segmentCount: result.segments?.length || 0
      })

      this.emitEvent('ai:audio:transcription:success', {
        connector: this.id,
        model: this.model,
        duration: result.duration,
        language: result.language,
        latency
      })

      return transcriptionResponse
    } catch (error) {
      logger.error('[WhisperConnector] Transcription failed', error)

      this.emitEvent('ai:audio:transcription:error', {
        connector: this.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    }
  }

  // Implement required AIConnector methods (not used for audio-only connector)
  async complete(_request: CompletionRequest): Promise<CompletionResponse> {
    throw new Error(
      'Whisper connector does not support text completion. Use audio() method for transcription.'
    )
  }

  async getModelInfo(modelId: string): Promise<ModelInfo> {
    const models: Record<string, ModelInfo> = {
      'whisper-large-v3-turbo': {
        id: 'whisper-large-v3-turbo',
        name: 'Whisper Large v3 Turbo',
        description: 'Fast and accurate speech-to-text model with multi-language support',
        vendor: 'cloudflare',
        context_window: 0,
        max_output_tokens: 0,
        input_cost: 0.00006, // $0.06 per hour of audio
        output_cost: 0,
        capabilities: {
          chat: false,
          completion: false,
          embeddings: false,
          vision: false,
          audio: true,
          function_calling: false,
          json_mode: true,
          streaming: false
        },
        version: 'v3-turbo',
        languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh']
      },
      'whisper-small': {
        id: 'whisper-small',
        name: 'Whisper Small',
        description: 'Lightweight speech-to-text model for basic transcription',
        vendor: 'cloudflare',
        context_window: 0,
        max_output_tokens: 0,
        input_cost: 0.00003, // $0.03 per hour of audio
        output_cost: 0,
        capabilities: {
          chat: false,
          completion: false,
          embeddings: false,
          vision: false,
          audio: true,
          function_calling: false,
          json_mode: true,
          streaming: false
        },
        version: 'small',
        languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh']
      },
      'whisper-tiny': {
        id: 'whisper-tiny',
        name: 'Whisper Tiny',
        description: 'Ultra-lightweight model for simple transcription tasks',
        vendor: 'cloudflare',
        context_window: 0,
        max_output_tokens: 0,
        input_cost: 0.00001, // $0.01 per hour of audio
        output_cost: 0,
        capabilities: {
          chat: false,
          completion: false,
          embeddings: false,
          vision: false,
          audio: true,
          function_calling: false,
          json_mode: true,
          streaming: false
        },
        version: 'tiny',
        languages: ['en', 'es', 'fr', 'de', 'it']
      }
    }

    const model = models[modelId]
    if (!model) {
      throw new Error(`Model ${modelId} not supported by Whisper connector`)
    }

    return model
  }

  calculateCost(usage: Usage): Cost {
    // Whisper pricing is based on audio duration, not tokens
    // Estimate 1 hour of audio = 30,000 tokens
    const hours = usage.total_tokens / 30000
    const costPerHour =
      this.model === 'whisper-large-v3-turbo' ? 0.06 : this.model === 'whisper-small' ? 0.03 : 0.01

    return {
      total: hours * costPerHour,
      currency: 'USD',
      breakdown: {
        prompt: hours * costPerHour,
        completion: 0
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
      logger.error('[WhisperConnector] Credential validation failed', error)
      return false
    }
  }

  private async prepareAudioData(audio: AudioInput): Promise<string> {
    if (audio.type === 'base64') {
      return audio.data as string
    } else if (audio.type === 'buffer') {
      return Buffer.from(audio.data as Buffer).toString('base64')
    } else if (audio.type === 'url') {
      // Fetch audio from URL and convert to base64
      const response = await fetch(audio.data as string)
      const buffer = await response.arrayBuffer()
      return Buffer.from(buffer).toString('base64')
    } else {
      throw new Error(`Unsupported audio input type: ${audio.type}`)
    }
  }

  private async callAPI(payload: Record<string, unknown>): Promise<unknown> {
    const modelPath = this.model.replace(/-/g, '_')
    const url = `${this.baseUrl}/accounts/${this.accountId}/ai/run/@cf/openai/${modelPath}`

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
      throw new Error(`Whisper API error: ${response.status} - ${error}`)
    }

    return response.json()
  }
}
