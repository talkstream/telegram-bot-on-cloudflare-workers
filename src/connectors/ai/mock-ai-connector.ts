/**
 * Mock AI Connector for deployment without real AI services
 *
 * This connector simulates AI responses for testing and demo purposes.
 * It provides canned responses without requiring API keys.
 */

import type {
  AICapabilities,
  AIConnector,
  CompletionRequest,
  CompletionResponse,
  Cost,
  Model,
  ModelInfo,
  Usage
} from '../../core/interfaces/ai'
import { FinishReason, MessageRole } from '../../core/interfaces/ai'
import type {
  ConnectorCapabilities,
  ConnectorConfig,
  HealthStatus,
  ValidationResult
} from '../../core/interfaces/connector'
import { ConnectorType } from '../../core/interfaces/connector'

export class MockAIConnector implements AIConnector {
  id = 'ai-mock'
  name = 'Mock AI Connector'
  version = '1.0.0'
  type = ConnectorType.AI
  private _isReady = true
  provider = 'mock' as const

  constructor(_env?: unknown) {
    // Accept optional env parameter for compatibility
  }

  private responses = [
    "Hello! I'm a mock AI assistant running in demo mode. This is Wireframe v1.2 - a universal AI assistant platform.",
    'I can simulate various AI responses for testing purposes. In production, you can connect real AI providers like OpenAI, Google Gemini, or others.',
    'This framework supports multi-cloud deployment, multiple messaging platforms, and a plugin system for extensibility.',
    "Feel free to explore the demo! When you're ready, you can configure real AI providers by setting the appropriate API keys.",
    'Wireframe is designed to be platform-agnostic, allowing you to deploy on Cloudflare, AWS, GCP, or any other cloud provider.'
  ]

  private responseIndex = 0

  async initialize(_config: ConnectorConfig): Promise<void> {
    console.info('[MockAI] Initialized in DEMO mode - no real AI service connected')
  }

  async connect(): Promise<void> {
    // No-op for mock
  }

  async disconnect(): Promise<void> {
    // No-op for mock
  }

  async healthCheck(): Promise<boolean> {
    return true
  }

  isReady(): boolean {
    return this._isReady
  }

  validateConfig(_config: ConnectorConfig): ValidationResult {
    return { valid: true }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      message: 'Mock AI connector is running',
      details: { mode: 'mock' },
      timestamp: Date.now()
    }
  }

  async destroy(): Promise<void> {
    console.info('[MockAI] Destroyed')
  }

  getCapabilities(): ConnectorCapabilities {
    const aiCaps = this.getAICapabilities()
    return {
      features: [
        'ai',
        aiCaps.supportsStreaming ? 'streaming' : '',
        aiCaps.supportsEmbeddings ? 'embeddings' : '',
        aiCaps.supportsVision ? 'vision' : '',
        aiCaps.supportsAudio ? 'audio' : '',
        aiCaps.supportsFunctionCalling ? 'functions' : ''
      ].filter(Boolean) as string[],
      limits: {
        maxContextWindow: aiCaps.maxContextWindow,
        maxOutputTokens: aiCaps.maxOutputTokens
      },
      metadata: {
        models: aiCaps.models,
        rateLimits: aiCaps.rateLimits
      }
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const prompt = request.messages
      .filter(m => m.role === MessageRole.USER)
      .map(m => (typeof m.content === 'string' ? m.content : ''))
      .join(' ')

    console.info('[MockAI] Prompt received:', prompt)

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500))

    // Get next response from the rotation
    let content = this.responses[this.responseIndex % this.responses.length]
    this.responseIndex++

    // Check for specific prompts
    if (prompt.toLowerCase().includes('weather')) {
      content =
        "🌤️ Mock Weather Report: It's a beautiful day in the cloud! Perfect for deploying your AI assistants. (This is a demo response)"
    }

    if (prompt.toLowerCase().includes('help')) {
      content =
        "📚 Mock Help: I'm running in demo mode! Available commands:\n/start - Welcome message\n/help - This help\n/echo <text> - Echo your message\n/about - Learn about Wireframe\n\nTo use real AI, configure your API keys in the environment variables."
    }

    return {
      id: `mock-${Date.now()}`,
      model: request.model || 'mock-model',
      content: content || '',
      role: MessageRole.ASSISTANT,
      finish_reason: FinishReason.STOP,
      usage: {
        prompt_tokens: prompt.length,
        completion_tokens: content?.length || 0,
        total_tokens: prompt.length + (content?.length || 0)
      }
    }
  }

  async *stream(request: CompletionRequest): AsyncIterator<{
    id: string
    delta: { content?: string; role?: MessageRole }
    finish_reason?: FinishReason
  }> {
    const response = await this.complete(request)
    const words = response.content.split(' ')

    // Simulate streaming by yielding words one by one
    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 100))
      yield {
        id: response.id,
        delta: {
          content: words[i] + (i < words.length - 1 ? ' ' : ''),
          role: i === 0 ? MessageRole.ASSISTANT : undefined
        },
        finish_reason: i === words.length - 1 ? FinishReason.STOP : undefined
      }
    }
  }

  async embeddings(
    texts: string | string[]
  ): Promise<Array<{ embedding: number[]; index: number }>> {
    const textArray = Array.isArray(texts) ? texts : [texts]
    console.info('[MockAI] Generating mock embeddings for', textArray.length, 'texts')

    // Return mock embeddings (768-dimensional vectors)
    return textArray.map((_, index) => ({
      embedding: Array(768)
        .fill(0)
        .map(() => Math.random() * 2 - 1),
      index
    }))
  }

  async validateCredentials(): Promise<boolean> {
    // Mock connector doesn't need validation
    return true
  }

  async listModels(): Promise<Model[]> {
    return [
      {
        id: 'mock-model-v1',
        name: 'Mock Model v1',
        description: 'A mock model for testing',
        context_window: 8192,
        max_output_tokens: 2048
      }
    ]
  }

  async getModelInfo(modelId: string): Promise<ModelInfo> {
    return {
      id: modelId,
      name: 'Mock Model v1',
      vendor: 'Mock AI',
      description: 'A mock model for testing',
      context_window: 8192,
      max_output_tokens: 2048,
      capabilities: {
        chat: true,
        completion: true,
        embeddings: true,
        vision: false,
        audio: false,
        function_calling: false,
        json_mode: false,
        streaming: true
      }
    }
  }

  calculateCost(_usage: Usage): Cost {
    // Mock cost calculation (free in demo mode)
    return {
      total: 0,
      currency: 'USD',
      breakdown: {
        prompt: 0,
        completion: 0
      }
    }
  }

  getAICapabilities(): AICapabilities {
    return {
      models: ['mock-model-v1'],
      maxContextWindow: 8192,
      maxOutputTokens: 2048,
      supportsStreaming: true,
      supportsEmbeddings: true,
      supportsVision: false,
      supportsAudio: false,
      supportsFunctionCalling: false,
      supportsJsonMode: false
    }
  }
}
