import type { ResourceConstraints } from '@/core/interfaces/resource-constraints'
import { hasAICapabilities, isConstrainedEnvironment } from '@/core/interfaces/resource-constraints'
import { CostTracker as CostTrackerImpl } from '@/lib/ai/cost-tracking'
import { getProviderRegistry } from '@/lib/ai/registry'
import type {
  AIOptions,
  AIProvider,
  AIResponse,
  AIServiceConfig,
  CompletionRequest,
  Message,
  ProviderRegistry
} from '@/lib/ai/types'
import { AIProviderError } from '@/lib/ai/types'
import { logger } from '@/lib/logger'

export class AIService {
  private registry: ProviderRegistry
  private costTracker?: CostTrackerImpl
  private fallbackProviders: string[]

  constructor(config: AIServiceConfig = {}, constraints?: ResourceConstraints) {
    this.registry = getProviderRegistry()

    // Configure based on resource constraints
    if (constraints) {
      // Check if AI capabilities are available
      if (!hasAICapabilities(constraints)) {
        logger.warn('AI capabilities may be limited with current resource constraints')
      }

      // Adjust settings based on constraints
      const isConstrained = isConstrainedEnvironment(constraints)

      // Setup fallback providers (limited in constrained environments)
      if (isConstrained) {
        // In constrained environments, limit fallback attempts
        this.fallbackProviders = (config.fallbackProviders || []).slice(0, 1)
      } else {
        this.fallbackProviders = config.fallbackProviders || []
      }
    } else {
      this.fallbackProviders = config.fallbackProviders || []
    }

    // Set default provider if specified
    if (config.defaultProvider) {
      this.registry.setDefault(config.defaultProvider)
    }

    // Setup cost tracking if enabled
    if (config.costTracking?.enabled && config.costTracking.calculator) {
      this.costTracker = new CostTrackerImpl(config.costTracking.calculator)
    }
  }

  /**
   * Complete a prompt using the AI provider
   */
  async complete(prompt: string | Message[], options: AIOptions = {}): Promise<AIResponse> {
    // Convert string prompt to messages if needed
    const messages: Message[] =
      typeof prompt === 'string' ? [{ role: 'user', content: prompt }] : prompt

    const request: CompletionRequest = {
      messages,
      options
    }

    // Get the provider to use
    const providerId = options.provider || this.registry.getDefault()
    if (!providerId) {
      throw new AIProviderError('No AI provider available', 'PROVIDER_ERROR', 'unknown', false)
    }

    // Try primary provider first
    try {
      return await this.completeWithProvider(providerId, request, options)
    } catch (error) {
      logger.error(`Primary provider ${providerId} failed:`, error)

      // Try fallback providers if allowed
      if (options.allowFallback !== false && this.fallbackProviders.length > 0) {
        for (const fallbackId of this.fallbackProviders) {
          if (fallbackId !== providerId && this.registry.exists(fallbackId)) {
            try {
              logger.info(`Trying fallback provider: ${fallbackId}`)
              return await this.completeWithProvider(fallbackId, request, options)
            } catch (fallbackError) {
              logger.error(`Fallback provider ${fallbackId} failed:`, fallbackError)
            }
          }
        }
      }

      // Re-throw the original error if all providers failed
      throw error
    }
  }

  /**
   * Complete using a specific provider
   */
  private async completeWithProvider(
    providerId: string,
    request: CompletionRequest,
    options: AIOptions
  ): Promise<AIResponse> {
    const provider = this.registry.get(providerId)
    if (!provider) {
      throw new AIProviderError(
        `Provider ${providerId} not found`,
        'PROVIDER_ERROR',
        providerId,
        false
      )
    }

    // Execute the completion
    const response = await provider.complete(request)

    // Track costs if enabled
    let cost
    if (options.trackCost !== false && this.costTracker && response.usage) {
      cost = await this.costTracker.trackUsage(providerId, response.usage)
    }

    const result: AIResponse = {
      content: response.content,
      provider: providerId
    }

    if (response.usage) {
      result.usage = response.usage
    }

    if (cost) {
      result.cost = cost
    }

    if (response.metadata) {
      result.metadata = response.metadata
    }

    return result
  }

  /**
   * Stream a completion (if provider supports it)
   */
  async *stream(prompt: string | Message[], options: AIOptions = {}): AsyncIterator<string> {
    const providerId = options.provider || this.registry.getDefault()
    if (!providerId) {
      throw new AIProviderError('No AI provider available', 'PROVIDER_ERROR', 'unknown', false)
    }

    const provider = this.registry.get(providerId)
    if (!provider) {
      throw new AIProviderError(
        `Provider ${providerId} not found`,
        'PROVIDER_ERROR',
        providerId,
        false
      )
    }

    if (!provider.stream) {
      throw new AIProviderError(
        `Provider ${providerId} does not support streaming`,
        'UNSUPPORTED_FEATURE',
        providerId,
        false
      )
    }

    // Convert string prompt to messages if needed
    const messages: Message[] =
      typeof prompt === 'string' ? [{ role: 'user', content: prompt }] : prompt

    const request: CompletionRequest = {
      messages,
      options
    }

    // Stream from provider
    // Create an async generator that properly iterates
    if (!provider.stream) {
      throw new AIProviderError(
        `Provider ${providerId} does not support streaming`,
        'UNSUPPORTED_FEATURE',
        providerId,
        false
      )
    }
    const generator = provider.stream(request)

    // Manual iteration to avoid AsyncIterator type issues
    try {
      while (true) {
        const { value, done } = await generator.next()
        if (done) break
        if (value) {
          yield value.content
        }
      }
    } finally {
      // Ensure generator is properly closed
      if (generator.return) {
        await generator.return()
      }
    }
  }

  /**
   * Switch the active provider
   */
  async switchProvider(providerId: string): Promise<void> {
    if (!this.registry.exists(providerId)) {
      throw new Error(`Provider ${providerId} is not registered`)
    }

    // Validate provider health before switching
    const provider = this.registry.get(providerId)
    if (provider) {
      const health = await provider.getHealthStatus()
      if (!health.healthy) {
        throw new Error(`Provider ${providerId} is not healthy: ${health.error}`)
      }
    }

    this.registry.setDefault(providerId)
    logger.info(`Switched active AI provider to: ${providerId}`)
  }

  /**
   * Get the active provider info
   */
  getActiveProvider(): string | null {
    return this.registry.getDefault()
  }

  /**
   * List all available providers
   */
  listProviders() {
    return this.registry.list()
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(providerId?: string) {
    const id = providerId || this.registry.getDefault()
    if (!id) {
      return null
    }

    const provider = this.registry.get(id)
    if (!provider) {
      return null
    }

    return provider.getHealthStatus()
  }

  /**
   * Get cost tracking information
   */
  getCostInfo() {
    if (!this.costTracker) {
      return null
    }

    return {
      usage: this.costTracker.getUsage(),
      costs: this.costTracker.getCosts(),
      total: this.costTracker.getTotalCost()
    }
  }

  /**
   * Reset cost tracking
   */
  resetCostTracking(providerId?: string) {
    if (this.costTracker) {
      this.costTracker.reset(providerId)
    }
  }

  /**
   * Register a new provider
   */
  registerProvider(provider: AIProvider) {
    this.registry.register(provider)
  }

  /**
   * Helper method for backward compatibility with GeminiService
   */
  async generateText(prompt: string): Promise<string> {
    const response = await this.complete(prompt)
    return response.content
  }
}
