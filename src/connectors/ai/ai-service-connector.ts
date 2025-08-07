/**
 * AI Service integration through EventBus
 * Bridges the existing AIService with the new connector architecture
 */

import type { EventBus } from '../../core/events/event-bus'
import type { ResourceConstraints } from '../../core/interfaces/resource-constraints'
import type { AIOptions, AIServiceConfig } from '../../lib/ai/types'
import { logger } from '../../lib/logger'
import { AIService } from '../../services/ai-service'

export class AIServiceConnector {
  private aiService: AIService

  constructor(
    private eventBus: EventBus,
    config?: AIServiceConfig,
    constraints?: ResourceConstraints
  ) {
    // AIService now uses ResourceConstraints directly
    this.aiService = new AIService(config, constraints)
    this.setupEventHandlers()
  }

  /**
   * Setup event handlers for AI requests
   */
  private setupEventHandlers(): void {
    // Handle AI completion requests
    this.eventBus.on('ai:complete', async event => {
      const { prompt, options, requestId } = event.payload as {
        prompt: string
        options?: AIOptions
        requestId: string
      }

      try {
        const response = await this.aiService.complete(prompt, options)

        // Emit success event
        this.eventBus.emit(
          'ai:complete:success',
          {
            requestId,
            response
          },
          'AIServiceConnector'
        )
      } catch (error) {
        // Emit error event
        this.eventBus.emit(
          'ai:complete:error',
          {
            requestId,
            error: error instanceof Error ? error.message : 'AI completion failed'
          },
          'AIServiceConnector'
        )

        logger.error('AI completion failed', { error, requestId })
      }
    })

    // Handle AI streaming requests
    this.eventBus.on('ai:stream', async event => {
      const { prompt, options, requestId } = event.payload as {
        prompt: string
        options?: AIOptions
        requestId: string
      }

      try {
        const stream = await this.aiService.stream(prompt, options)

        // Process stream and emit chunks
        const iterator = stream as AsyncIterator<string>
        let result = await iterator.next()
        while (!result.done) {
          this.eventBus.emit(
            'ai:stream:chunk',
            {
              requestId,
              chunk: result.value
            },
            'AIServiceConnector'
          )
          result = await iterator.next()
        }

        // Emit completion event
        this.eventBus.emit(
          'ai:stream:complete',
          {
            requestId
          },
          'AIServiceConnector'
        )
      } catch (error) {
        // Emit error event
        this.eventBus.emit(
          'ai:stream:error',
          {
            requestId,
            error: error instanceof Error ? error.message : 'AI streaming failed'
          },
          'AIServiceConnector'
        )

        logger.error('AI streaming failed', { error, requestId })
      }
    })

    // Handle provider switching
    this.eventBus.on('ai:provider:switch', event => {
      const { providerId } = event.payload as { providerId: string }

      try {
        this.aiService.switchProvider(providerId)
        this.eventBus.emit(
          'ai:provider:switched',
          {
            providerId
          },
          'AIServiceConnector'
        )
      } catch (error) {
        this.eventBus.emit(
          'ai:provider:switch:error',
          {
            providerId,
            error: error instanceof Error ? error.message : 'Provider switch failed'
          },
          'AIServiceConnector'
        )
      }
    })

    // Handle cost queries
    this.eventBus.on('ai:cost:query', event => {
      const { period } = event.payload as { period?: string }

      const costInfo = this.aiService.getCostInfo()
      this.eventBus.emit(
        'ai:cost:response',
        {
          costs: costInfo,
          period
        },
        'AIServiceConnector'
      )
    })
  }

  /**
   * Get the underlying AI service instance
   */
  getService(): AIService {
    return this.aiService
  }
}
