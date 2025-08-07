import { logger } from '../../logger'
import type {
  CompletionRequest,
  CompletionResponse,
  ProviderCapabilities,
  ProviderConfig,
  StreamChunk
} from '../types'

import { BaseAIProvider } from './base'

export interface MockProviderConfig {
  responses?: Record<string, string>
  defaultResponse?: string
  simulateDelay?: number
  simulateError?: boolean
  errorRate?: number
}

/**
 * Mock AI provider for testing
 */
export class MockAIProvider extends BaseAIProvider {
  private responses: Record<string, string>
  private defaultResponse: string
  private simulateDelay: number
  private simulateError: boolean
  private errorRate: number
  private callCount = 0

  constructor(config: MockProviderConfig = {}) {
    super({
      id: 'mock',
      displayName: 'Mock AI Provider',
      type: 'mock',
      config: config as Record<string, unknown>
    })

    this.responses = config.responses || {}
    this.defaultResponse = config.defaultResponse || 'This is a mock response.'
    this.simulateDelay = config.simulateDelay || 100
    this.simulateError = config.simulateError || false
    this.errorRate = config.errorRate || 0.1
  }

  async doComplete(request: CompletionRequest): Promise<CompletionResponse> {
    this.callCount++

    // Simulate delay
    if (this.simulateDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.simulateDelay))
    }

    // Simulate random errors
    if (this.simulateError && Math.random() < this.errorRate) {
      throw new Error('Mock provider simulated error')
    }

    // Get the last user message
    const lastUserMessage = request.messages.filter(m => m.role === 'user').pop()?.content || ''

    // Check for predefined responses
    let content = this.defaultResponse
    for (const [pattern, response] of Object.entries(this.responses)) {
      if (lastUserMessage.includes(pattern)) {
        content = response
        break
      }
    }

    // Calculate mock usage
    const inputLength = request.messages.map(m => m.content).join(' ').length
    const outputLength = content.length

    logger.info('Mock AI provider called', {
      callCount: this.callCount,
      messageCount: request.messages.length
    })

    return {
      content,
      usage: {
        inputUnits: Math.ceil(inputLength / 4),
        outputUnits: Math.ceil(outputLength / 4),
        totalUnits: Math.ceil((inputLength + outputLength) / 4)
      },
      metadata: {
        model: 'mock-model',
        providerId: this.id,
        processingTimeMs: this.simulateDelay,
        custom: {
          callCount: this.callCount,
          matched: content !== this.defaultResponse
        }
      }
    }
  }

  override async *stream(request: CompletionRequest): AsyncIterator<StreamChunk> {
    const response = await this.doComplete(request)
    const words = response.content.split(' ')

    // Stream word by word
    for (let i = 0; i < words.length; i++) {
      if (this.simulateDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.simulateDelay / 10))
      }

      const chunk: StreamChunk = {
        content: words[i] + (i < words.length - 1 ? ' ' : ''),
        done: i === words.length - 1
      }
      if (response.metadata) {
        chunk.metadata = response.metadata
      }
      yield chunk
    }
  }

  async doValidateConfig(_config: ProviderConfig): Promise<boolean> {
    // Mock provider is always valid
    return true
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      maxTokens: 4096,
      maxContextLength: 16384,
      supportedOptions: ['temperature', 'maxTokens', 'topP', 'stopSequences'],
      supportedModels: ['mock-model', 'mock-model-large'],
      customFeatures: {
        testing: true,
        deterministic: true,
        configurable: true
      }
    }
  }

  // Test helper methods
  getCallCount(): number {
    return this.callCount
  }

  resetCallCount(): void {
    this.callCount = 0
  }

  setResponse(pattern: string, response: string): void {
    this.responses[pattern] = response
  }

  setDefaultResponse(response: string): void {
    this.defaultResponse = response
  }

  setErrorSimulation(enabled: boolean, rate?: number): void {
    this.simulateError = enabled
    if (rate !== undefined) {
      this.errorRate = rate
    }
  }
}

/**
 * Factory function for creating preconfigured mock providers
 */
export function createMockProvider(preset?: 'chatbot' | 'assistant' | 'error'): MockAIProvider {
  switch (preset) {
    case 'chatbot':
      return new MockAIProvider({
        responses: {
          hello: 'Hello! How can I help you today?',
          help: 'I can assist you with various tasks. What do you need help with?',
          bye: 'Goodbye! Have a great day!'
        },
        defaultResponse: 'I understand. Can you tell me more?'
      })

    case 'assistant':
      return new MockAIProvider({
        responses: {
          weather: 'I cannot access real-time weather data, but you can check weather.com',
          time: `The current time is ${new Date().toLocaleTimeString()}`,
          date: `Today is ${new Date().toLocaleDateString()}`
        },
        defaultResponse: 'I am a mock assistant. How may I help you?'
      })

    case 'error':
      return new MockAIProvider({
        simulateError: true,
        errorRate: 0.5,
        simulateDelay: 1000
      })

    default:
      return new MockAIProvider()
  }
}
