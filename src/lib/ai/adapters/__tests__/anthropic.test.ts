import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AIProviderError, CompletionRequest } from '../../types.js'
import { AnthropicProvider } from '../anthropic.js'

function isAIProviderError(error: unknown): error is AIProviderError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    'retryable' in error &&
    'provider' in error
  )
}

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider
  const mockApiKey = 'test-api-key'
  const originalFetch = global.fetch
  const mockFetch = () => global.fetch as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock fetch globally
    global.fetch = vi.fn() as unknown as typeof fetch
    provider = new AnthropicProvider({ apiKey: mockApiKey }, 'free') // Use free tier to avoid retries
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('Initialization', () => {
    it('should initialize with default model', () => {
      const capabilities = provider.getCapabilities()
      expect(provider.id).toBe('anthropic')
      expect(provider.displayName).toBe('Anthropic Claude')
      expect(capabilities.supportedModels).toContain('claude-sonnet-4-20250514')
    })

    it('should initialize with custom model', () => {
      const customProvider = new AnthropicProvider({
        apiKey: mockApiKey,
        model: 'claude-opus-4-20250514'
      })
      expect(customProvider.id).toBe('anthropic')
    })
  })

  describe('Completion', () => {
    beforeEach(async () => {
      vi.clearAllMocks()
      await provider.initialize()
    })

    it('should make successful completion request', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello! How can I help you?' }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20
        }
      }

      mockFetch().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        options: { maxTokens: 100 }
      }

      const response = await provider.complete(request)

      expect(response.content).toBe('Hello! How can I help you?')
      expect(response.usage).toEqual({
        inputUnits: 10,
        outputUnits: 20,
        totalUnits: 30
      })
      expect(response.metadata?.model).toBe('claude-sonnet-4-20250514')

      // Verify API call
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': mockApiKey,
            'anthropic-version': '2023-06-01'
          })
        })
      )
    })

    it('should handle system messages correctly', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'I understand the context.' }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 15, output_tokens: 10 }
      }

      mockFetch().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const request: CompletionRequest = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello' }
        ]
      }

      await provider.complete(request)

      // Verify the request body
      const callArgs = mockFetch().mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)

      expect(requestBody.system).toBe('You are a helpful assistant.')
      expect(requestBody.messages).toEqual([{ role: 'user', content: 'Hello' }])
    })

    it('should handle API errors', async () => {
      vi.clearAllMocks()
      mockFetch().mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded'
      })

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }]
      }

      await expect(provider.complete(request)).rejects.toThrow()
    })
  })

  describe('Streaming', () => {
    beforeEach(async () => {
      await provider.initialize()
    })

    it('should handle streaming responses', async () => {
      const chunks = [
        'data: {"type":"message_start","message":{"id":"msg_123","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-20250514","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":0}}}\n',
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n',
        'data: {"type":"content_block_delta","index":0,"delta":{"text":"Hello"}}\n',
        'data: {"type":"content_block_delta","index":0,"delta":{"text":" there!"}}\n',
        'data: {"type":"content_block_stop","index":0}\n',
        'data: {"type":"message_stop"}\n'
      ]

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk)))
          controller.close()
        }
      })

      mockFetch().mockResolvedValueOnce({
        ok: true,
        body: stream
      })

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }]
      }

      if (!provider.stream) {
        throw new Error('Stream method not available')
      }
      const streamIterator = provider.stream(request)
      const collectedChunks: string[] = []

      for await (const chunk of streamIterator) {
        if (chunk.content) {
          collectedChunks.push(chunk.content)
        }
      }

      expect(collectedChunks).toEqual(['Hello', ' there!'])
    })
  })

  describe('Capabilities', () => {
    it('should return correct capabilities', () => {
      const capabilities = provider.getCapabilities()

      expect(capabilities).toEqual({
        streaming: true,
        maxTokens: 64000,
        maxContextLength: 200000,
        supportedOptions: ['temperature', 'maxTokens', 'topP', 'stopSequences'],
        supportedModels: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514'],
        customFeatures: {
          systemPrompts: true,
          visionSupport: true,
          functionCalling: true,
          xmlMode: true,
          extendedThinking: true
        }
      })
    })
  })

  describe('Configuration Validation', () => {
    beforeEach(async () => {
      await provider.initialize()
    })

    it('should validate valid configuration', async () => {
      mockFetch().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Test' }],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 }
        })
      })

      const isValid = await provider.validateConfig({
        id: 'anthropic',
        type: 'anthropic',
        config: { apiKey: 'valid-key' }
      })

      expect(isValid).toBe(true)
    })

    it('should reject invalid configuration', async () => {
      const isValid = await provider.validateConfig({
        id: 'anthropic',
        type: 'anthropic',
        config: {}
      })

      expect(isValid).toBe(false)
    })
  })

  describe('Error Handling', () => {
    beforeEach(async () => {
      vi.clearAllMocks()
      await provider.initialize()
    })

    it('should normalize rate limit errors', async () => {
      mockFetch().mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'rate limit exceeded'
      })

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }]
      }

      try {
        await provider.complete(request)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(isAIProviderError(error)).toBe(true)
        if (isAIProviderError(error)) {
          expect(error.code).toBe('RATE_LIMIT')
          expect(error.retryable).toBe(true)
          expect(error.provider).toBe('anthropic')
        }
      }
    })

    it('should normalize authentication errors', async () => {
      mockFetch().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key'
      })

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }]
      }

      try {
        await provider.complete(request)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error.code).toBe('AUTHENTICATION_ERROR')
        expect(error.retryable).toBe(false)
      }
    })
  })
})
