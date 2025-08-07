/**
 * MeloTTS Connector for Cloudflare Workers AI
 *
 * Provides text-to-speech capabilities using MeloTTS model
 * High-quality multilingual speech synthesis
 * @module connectors/ai/melotts/melotts-connector
 */

import { BaseConnector } from '@/connectors/base/base-connector'
import { EventBus } from '@/core/events/event-bus'
import type {
  AICapabilities,
  AIConnector,
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

export interface MeloTTSConfig extends ConnectorConfig {
  accountId: string
  apiToken?: string
  baseUrl?: string
  defaultVoice?: string
  defaultLanguage?: string
  eventBus?: EventBus
}

export interface TTSOptions {
  voice?: string
  language?: string
  speed?: number // 0.5 to 2.0
  pitch?: number // -20 to 20 semitones
  volume?: number // 0 to 1
  format?: 'mp3' | 'wav' | 'ogg' | 'flac'
  sampleRate?: 8000 | 16000 | 22050 | 24000 | 44100 | 48000
  emotion?: 'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised'
}

export interface TTSResponse {
  audio: Buffer | string // Buffer or base64 string
  format: string
  duration: number // in seconds
  sampleRate: number
  size: number // in bytes
  metadata?: {
    voice: string
    language: string
    emotion?: string
    characterCount: number
  }
}

export class MeloTTSConnector extends BaseConnector implements AIConnector {
  id = 'melotts-connector'
  name = 'MeloTTS Text-to-Speech Connector'
  version = '1.0.0'
  type = ConnectorType.AI

  private accountId!: string
  private apiToken?: string
  private baseUrl: string
  private defaultVoice: string
  private defaultLanguage: string

  constructor(config?: MeloTTSConfig) {
    super()
    if (config) {
      this.accountId = config.accountId
      this.apiToken = config.apiToken
      this.baseUrl = config.baseUrl || 'https://api.cloudflare.com/client/v4'
      this.defaultVoice = config.defaultVoice || 'en-US-Standard-A'
      this.defaultLanguage = config.defaultLanguage || 'en-US'
      if (config.eventBus) {
        this.eventBus = config.eventBus
      }
    } else {
      this.baseUrl = 'https://api.cloudflare.com/client/v4'
      this.defaultVoice = 'en-US-Standard-A'
      this.defaultLanguage = 'en-US'
    }
  }

  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const ttsConfig = config as MeloTTSConfig

    this.accountId = ttsConfig.accountId
    this.apiToken = ttsConfig.apiToken
    this.baseUrl = ttsConfig.baseUrl || this.baseUrl
    this.defaultVoice = ttsConfig.defaultVoice || this.defaultVoice
    this.defaultLanguage = ttsConfig.defaultLanguage || this.defaultLanguage

    logger.info('[MeloTTSConnector] Initializing MeloTTS connector', {
      accountId: this.accountId,
      defaultVoice: this.defaultVoice,
      defaultLanguage: this.defaultLanguage
    })

    // Validate credentials if available
    if (this.apiToken) {
      const valid = await this.validateCredentials()
      if (!valid) {
        throw new Error('Invalid API credentials for MeloTTS')
      }
    }

    this.emitEvent('ai:tts:connector:initialized', {
      connector: this.id,
      capabilities: this.getAICapabilities()
    })
  }

  protected doValidateConfig(config: ConnectorConfig): ValidationResult['errors'] {
    const errors: ValidationResult['errors'] = []
    const ttsConfig = config as MeloTTSConfig

    if (!ttsConfig.accountId) {
      errors?.push({
        field: 'accountId',
        message: 'Cloudflare account ID is required',
        code: 'REQUIRED_FIELD'
      })
    }

    return errors
  }

  protected checkReadiness(): boolean {
    return !!this.accountId
  }

  protected async checkHealth(): Promise<Partial<HealthStatus>> {
    try {
      // Check if the TTS service is available
      const modelInfo = await this.getModelInfo('melotts')

      return {
        status: modelInfo ? 'healthy' : 'degraded',
        message: modelInfo ? 'MeloTTS connector is operational' : 'Service unavailable',
        details: {
          service: 'melotts',
          available: !!modelInfo
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Failed to check service availability',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  protected async doDestroy(): Promise<void> {
    logger.info('[MeloTTSConnector] Destroying MeloTTS connector')

    this.emitEvent('ai:tts:connector:destroyed', {
      connector: this.id
    })
  }

  getCapabilities(): ConnectorCapabilities {
    return {
      supportsAsync: true,
      supportsSync: true,
      supportsBatching: true,
      supportsStreaming: true,
      maxBatchSize: 10,
      maxConcurrent: 5,
      features: [
        'text-to-speech',
        'multi-voice',
        'multi-language',
        'emotion-control',
        'speed-control',
        'pitch-control',
        'streaming-audio'
      ]
    }
  }

  getAICapabilities(): AICapabilities {
    return {
      models: ['melotts'],
      maxContextWindow: 0, // Not applicable for TTS
      maxOutputTokens: 0, // Not applicable for TTS
      supportsStreaming: true,
      supportsFunctionCalling: false,
      supportsVision: false,
      supportsAudio: true,
      supportsEmbeddings: false,
      supportsJsonMode: false,
      custom: {
        features: {
          textToSpeech: true,
          multiLanguage: true,
          emotionControl: true,
          voiceCloning: false
        }
      }
    }
  }

  /**
   * Generate speech from text
   */
  async synthesize(text: string, options?: TTSOptions): Promise<TTSResponse> {
    try {
      logger.info('[MeloTTSConnector] Processing text-to-speech', {
        textLength: text.length,
        voice: options?.voice || this.defaultVoice,
        language: options?.language || this.defaultLanguage,
        format: options?.format || 'mp3'
      })

      const startTime = Date.now()

      // Prepare the request payload
      const payload = {
        text,
        voice: options?.voice || this.defaultVoice,
        language: options?.language || this.defaultLanguage,
        speed: options?.speed || 1.0,
        pitch: options?.pitch || 0,
        volume: options?.volume || 1.0,
        format: options?.format || 'mp3',
        sample_rate: options?.sampleRate || 24000,
        emotion: options?.emotion || 'neutral'
      }

      // Make API call to Cloudflare Workers AI
      const response = await this.callAPI(payload)
      const latency = Date.now() - startTime

      // Decode base64 audio if needed
      const result = response as { audio?: string; duration?: number }
      const audioBuffer = Buffer.from(result.audio || '', 'base64')

      const ttsResponse: TTSResponse = {
        audio: audioBuffer,
        format: options?.format || 'mp3',
        duration: result.duration || audioBuffer.length / (options?.sampleRate || 24000) / 2, // Estimate
        sampleRate: options?.sampleRate || 24000,
        size: audioBuffer.length,
        metadata: {
          voice: options?.voice || this.defaultVoice,
          language: options?.language || this.defaultLanguage,
          emotion: options?.emotion,
          characterCount: text.length
        }
      }

      logger.info('[MeloTTSConnector] TTS synthesis successful', {
        duration: ttsResponse.duration,
        size: ttsResponse.size,
        latency
      })

      this.emitEvent('ai:tts:synthesis:success', {
        connector: this.id,
        duration: ttsResponse.duration,
        size: ttsResponse.size,
        latency
      })

      return ttsResponse
    } catch (error) {
      logger.error('[MeloTTSConnector] TTS synthesis failed', error)

      this.emitEvent('ai:tts:synthesis:error', {
        connector: this.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    }
  }

  /**
   * Stream speech synthesis
   */
  async *streamSynthesize(text: string, options?: TTSOptions): AsyncIterator<Uint8Array> {
    try {
      logger.info('[MeloTTSConnector] Starting streaming TTS', {
        textLength: text.length,
        voice: options?.voice || this.defaultVoice
      })

      const payload = {
        text,
        voice: options?.voice || this.defaultVoice,
        language: options?.language || this.defaultLanguage,
        speed: options?.speed || 1.0,
        pitch: options?.pitch || 0,
        volume: options?.volume || 1.0,
        format: options?.format || 'mp3',
        sample_rate: options?.sampleRate || 24000,
        emotion: options?.emotion || 'neutral',
        stream: true
      }

      // Stream response from API
      const stream = await this.callStreamingAPI(payload)
      const reader = stream.getReader()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        yield value
      }

      this.emitEvent('ai:tts:stream:complete', {
        connector: this.id
      })
    } catch (error) {
      logger.error('[MeloTTSConnector] Streaming TTS failed', error)

      this.emitEvent('ai:tts:stream:error', {
        connector: this.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    }
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<
    Array<{
      id: string
      name: string
      language: string
      gender: string
      preview_url?: string
    }>
  > {
    return [
      { id: 'en-US-Standard-A', name: 'US English Female', language: 'en-US', gender: 'female' },
      { id: 'en-US-Standard-B', name: 'US English Male', language: 'en-US', gender: 'male' },
      {
        id: 'en-GB-Standard-A',
        name: 'British English Female',
        language: 'en-GB',
        gender: 'female'
      },
      { id: 'en-GB-Standard-B', name: 'British English Male', language: 'en-GB', gender: 'male' },
      { id: 'es-ES-Standard-A', name: 'Spanish Female', language: 'es-ES', gender: 'female' },
      { id: 'fr-FR-Standard-A', name: 'French Female', language: 'fr-FR', gender: 'female' },
      { id: 'de-DE-Standard-A', name: 'German Female', language: 'de-DE', gender: 'female' },
      { id: 'it-IT-Standard-A', name: 'Italian Female', language: 'it-IT', gender: 'female' },
      { id: 'ja-JP-Standard-A', name: 'Japanese Female', language: 'ja-JP', gender: 'female' },
      { id: 'ko-KR-Standard-A', name: 'Korean Female', language: 'ko-KR', gender: 'female' },
      { id: 'zh-CN-Standard-A', name: 'Chinese Female', language: 'zh-CN', gender: 'female' },
      { id: 'ru-RU-Standard-A', name: 'Russian Female', language: 'ru-RU', gender: 'female' }
    ]
  }

  // Implement required AIConnector methods (not used for TTS-only connector)
  async complete(_request: CompletionRequest): Promise<CompletionResponse> {
    throw new Error(
      'MeloTTS connector does not support text completion. Use synthesize() method for TTS.'
    )
  }

  async getModelInfo(modelId: string): Promise<ModelInfo> {
    if (modelId !== 'melotts') {
      throw new Error(`Model ${modelId} not supported by MeloTTS connector`)
    }

    return {
      id: 'melotts',
      name: 'MeloTTS',
      description: 'High-quality multilingual text-to-speech synthesis',
      vendor: 'cloudflare',
      context_window: 0,
      max_output_tokens: 0,
      input_cost: 0.00002, // $0.02 per 1000 characters
      output_cost: 0,
      capabilities: {
        chat: false,
        completion: false,
        embeddings: false,
        vision: false,
        audio: true,
        function_calling: false,
        json_mode: false,
        streaming: true
      },
      version: '1.0',
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh']
    }
  }

  calculateCost(usage: Usage): Cost {
    // MeloTTS pricing is based on character count
    // Estimate 5 characters per token
    const characters = usage.total_tokens * 5
    const cost = (characters / 1000) * 0.02

    return {
      total: cost,
      currency: 'USD',
      breakdown: {
        prompt: cost,
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
      logger.error('[MeloTTSConnector] Credential validation failed', error)
      return false
    }
  }

  private async callAPI(payload: Record<string, unknown>): Promise<unknown> {
    const url = `${this.baseUrl}/accounts/${this.accountId}/ai/run/@cf/bytedance/melotts`

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
      throw new Error(`MeloTTS API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  private async callStreamingAPI(payload: Record<string, unknown>): Promise<ReadableStream> {
    const url = `${this.baseUrl}/accounts/${this.accountId}/ai/run/@cf/bytedance/melotts`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.apiToken ? `Bearer ${this.apiToken}` : '',
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`MeloTTS streaming API error: ${response.status} - ${error}`)
    }

    const body = response.body
    if (!body) {
      throw new Error('Response has no body')
    }
    return body
  }
}
