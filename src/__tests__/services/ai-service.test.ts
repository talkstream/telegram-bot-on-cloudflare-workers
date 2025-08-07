import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AIProvider, AIResponse, CompletionRequest } from '@/lib/ai/types'
import { AIService } from '@/services/ai-service'

// Mock registry
const mockRegistry = {
  get: vi.fn(),
  exists: vi.fn(),
  register: vi.fn(),
  setDefault: vi.fn(),
  getDefault: vi.fn(),
  list: vi.fn()
}

// Mock the registry module
vi.mock('@/lib/ai/registry', () => ({
  getProviderRegistry: vi.fn(() => mockRegistry)
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

// Create mock provider
const createMockProvider = (id: string, supportStreaming = true): AIProvider => ({
  id,
  name: `Mock ${id} Provider`,
  description: 'Mock provider for testing',

  async complete(request: CompletionRequest): Promise<AIResponse> {
    return {
      content: `Response from ${id}: ${request.messages[0].content}`,
      provider: id,
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30
      }
    }
  },

  stream: supportStreaming
    ? async function* (request: CompletionRequest) {
        yield { content: `Streaming from ${id}: ` }
        yield { content: request.messages[0].content as string }
      }
    : undefined,

  async getHealthStatus() {
    return { healthy: true }
  }
})

describe('AIService', () => {
  let aiService: AIService

  beforeEach(() => {
    vi.clearAllMocks()
    aiService = new AIService()
  })

  describe('complete', () => {
    it('should complete with default provider', async () => {
      const mockProvider = createMockProvider('gemini')
      mockRegistry.getDefault.mockReturnValue('gemini')
      mockRegistry.get.mockReturnValue(mockProvider)

      const response = await aiService.complete('Hello AI')

      expect(response.content).toBe('Response from gemini: Hello AI')
      expect(response.provider).toBe('gemini')
      expect(response.usage).toBeDefined()
    })

    it('should complete with specified provider', async () => {
      const mockProvider = createMockProvider('openai')
      mockRegistry.get.mockReturnValue(mockProvider)

      const response = await aiService.complete('Hello AI', { provider: 'openai' })

      expect(response.content).toBe('Response from openai: Hello AI')
      expect(response.provider).toBe('openai')
    })

    it('should handle message array input', async () => {
      const mockProvider = createMockProvider('gemini')
      mockRegistry.getDefault.mockReturnValue('gemini')
      mockRegistry.get.mockReturnValue(mockProvider)

      const messages = [
        { role: 'system' as const, content: 'You are helpful' },
        { role: 'user' as const, content: 'Hello' }
      ]

      const response = await aiService.complete(messages)

      expect(response.content).toBe('Response from gemini: You are helpful')
    })

    it('should throw error when no provider available', async () => {
      mockRegistry.getDefault.mockReturnValue(null)

      await expect(aiService.complete('Hello')).rejects.toThrow('No AI provider available')
    })

    it('should fallback to secondary provider on error', async () => {
      const failingProvider = createMockProvider('primary')
      failingProvider.complete = vi.fn().mockRejectedValue(new Error('API error'))

      const workingProvider = createMockProvider('fallback')

      mockRegistry.getDefault.mockReturnValue('primary')
      mockRegistry.get.mockImplementation(id => {
        if (id === 'primary') return failingProvider
        if (id === 'fallback') return workingProvider
        return null
      })
      mockRegistry.exists.mockReturnValue(true)

      const service = new AIService({
        fallbackProviders: ['fallback']
      })

      const response = await service.complete('Hello')

      expect(response.content).toBe('Response from fallback: Hello')
      expect(response.provider).toBe('fallback')
    })

    it('should not use fallback when disabled', async () => {
      const failingProvider = createMockProvider('primary')
      failingProvider.complete = vi.fn().mockRejectedValue(new Error('API error'))

      mockRegistry.getDefault.mockReturnValue('primary')
      mockRegistry.get.mockReturnValue(failingProvider)

      const service = new AIService({
        fallbackProviders: ['fallback']
      })

      await expect(service.complete('Hello', { allowFallback: false })).rejects.toThrow('API error')
    })
  })

  describe('stream', () => {
    it('should stream from provider', async () => {
      const mockProvider = createMockProvider('gemini')
      mockRegistry.getDefault.mockReturnValue('gemini')
      mockRegistry.get.mockReturnValue(mockProvider)

      const chunks: string[] = []
      for await (const chunk of aiService.stream('Hello')) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual(['Streaming from gemini: ', 'Hello'])
    })

    it('should throw error for non-streaming provider', async () => {
      const mockProvider = createMockProvider('basic', false)
      mockRegistry.getDefault.mockReturnValue('basic')
      mockRegistry.get.mockReturnValue(mockProvider)

      const streamIterator = aiService.stream('Hello')

      await expect(streamIterator.next()).rejects.toThrow(
        'Provider basic does not support streaming'
      )
    })
  })

  describe('switchProvider', () => {
    it('should switch to valid provider', async () => {
      const mockProvider = createMockProvider('openai')
      mockRegistry.exists.mockReturnValue(true)
      mockRegistry.get.mockReturnValue(mockProvider)

      await aiService.switchProvider('openai')

      expect(mockRegistry.setDefault).toHaveBeenCalledWith('openai')
    })

    it('should throw error for non-existent provider', async () => {
      mockRegistry.exists.mockReturnValue(false)

      await expect(aiService.switchProvider('invalid')).rejects.toThrow(
        'Provider invalid is not registered'
      )
    })

    it('should throw error for unhealthy provider', async () => {
      const unhealthyProvider = createMockProvider('unhealthy')
      unhealthyProvider.getHealthStatus = vi.fn().mockResolvedValue({
        healthy: false,
        error: 'Connection failed'
      })

      mockRegistry.exists.mockReturnValue(true)
      mockRegistry.get.mockReturnValue(unhealthyProvider)

      await expect(aiService.switchProvider('unhealthy')).rejects.toThrow(
        'Provider unhealthy is not healthy: Connection failed'
      )
    })
  })

  describe('provider management', () => {
    it('should get active provider', () => {
      mockRegistry.getDefault.mockReturnValue('gemini')

      expect(aiService.getActiveProvider()).toBe('gemini')
    })

    it('should list all providers', () => {
      const providers = ['gemini', 'openai', 'anthropic']
      mockRegistry.list.mockReturnValue(providers)

      expect(aiService.listProviders()).toEqual(providers)
    })

    it('should register new provider', () => {
      const newProvider = createMockProvider('custom')

      aiService.registerProvider(newProvider)

      expect(mockRegistry.register).toHaveBeenCalledWith(newProvider)
    })
  })

  describe('health status', () => {
    it('should get provider health', async () => {
      const mockProvider = createMockProvider('gemini')
      mockRegistry.getDefault.mockReturnValue('gemini')
      mockRegistry.get.mockReturnValue(mockProvider)

      const health = await aiService.getProviderHealth()

      expect(health).toEqual({ healthy: true })
    })

    it('should return null for non-existent provider', async () => {
      mockRegistry.getDefault.mockReturnValue(null)

      const health = await aiService.getProviderHealth()

      expect(health).toBeNull()
    })
  })

  describe('cost tracking', () => {
    it('should track costs when enabled', async () => {
      const mockProvider = createMockProvider('gemini')
      mockRegistry.getDefault.mockReturnValue('gemini')
      mockRegistry.get.mockReturnValue(mockProvider)

      const mockCalculator = {
        calculateCost: vi
          .fn()
          .mockReturnValue({ inputCost: 0.01, outputCost: 0.02, totalCost: 0.03 })
      }

      const service = new AIService({
        costTracking: {
          enabled: true,
          calculator: mockCalculator
        }
      })

      const response = await service.complete('Hello')

      expect(response.cost).toEqual({
        inputCost: 0.01,
        outputCost: 0.02,
        totalCost: 0.03
      })
    })

    it('should get cost info', () => {
      const mockCalculator = {
        calculateCost: vi.fn()
      }

      const service = new AIService({
        costTracking: {
          enabled: true,
          calculator: mockCalculator
        }
      })

      const costInfo = service.getCostInfo()

      expect(costInfo).toBeDefined()
      expect(costInfo).toHaveProperty('usage')
      expect(costInfo).toHaveProperty('costs')
      expect(costInfo).toHaveProperty('total')
    })

    it('should return null cost info when tracking disabled', () => {
      const service = new AIService()

      const costInfo = service.getCostInfo()

      expect(costInfo).toBeNull()
    })
  })

  describe('backward compatibility', () => {
    it('should support generateText method', async () => {
      const mockProvider = createMockProvider('gemini')
      mockRegistry.getDefault.mockReturnValue('gemini')
      mockRegistry.get.mockReturnValue(mockProvider)

      const text = await aiService.generateText('Hello')

      expect(text).toBe('Response from gemini: Hello')
    })
  })
})
