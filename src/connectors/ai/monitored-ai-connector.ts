import type {
  IAIConnector,
  AITextRequest,
  AITextResponse,
  AIEmbeddingRequest,
  AIEmbeddingResponse,
  AIStreamRequest,
  AIVisionRequest,
  AIVisionResponse,
  AIModelInfo,
  AIConnectorCapabilities,
  AIUsage,
  AIStreamChunk,
} from '@/core/interfaces/ai.js';
import type { IMonitoringConnector, ISpan } from '@/core/interfaces/monitoring.js';

/**
 * AI Connector wrapper that adds monitoring capabilities
 */
export class MonitoredAIConnector implements IAIConnector {
  constructor(
    private readonly connector: IAIConnector,
    private readonly monitoring: IMonitoringConnector | undefined,
  ) {}

  get id(): string {
    return this.connector.id;
  }

  get name(): string {
    return this.connector.name;
  }

  async initialize(config: Record<string, unknown>): Promise<void> {
    const span = this.startSpan('ai.initialize', `Initialize ${this.name}`);
    try {
      await this.connector.initialize(config);
      span?.setStatus('ok');
    } catch (error) {
      span?.setStatus('internal_error');
      this.captureError(error as Error, { operation: 'initialize', provider: this.name });
      throw error;
    } finally {
      span?.finish();
    }
  }

  async generateText(request: AITextRequest): Promise<AITextResponse> {
    const transaction = this.monitoring?.startTransaction?.({
      name: `ai.generateText.${this.name}`,
      op: 'ai.generate',
      data: {
        model: request.model,
        promptLength: request.prompt.length,
        maxTokens: request.maxTokens,
      },
    });

    try {
      // Track the request
      this.addBreadcrumb('AI text generation started', {
        provider: this.name,
        model: request.model,
        promptLength: request.prompt.length,
      });

      const startTime = Date.now();
      const response = await this.connector.generateText(request);
      const duration = Date.now() - startTime;

      // Track performance metrics
      transaction?.setData('responseLength', response.text.length);
      transaction?.setData('tokensUsed', response.usage?.totalTokens || 0);
      transaction?.setData('duration', duration);

      // Track cost if available
      if (response.usage?.totalCost) {
        transaction?.setData('cost', response.usage.totalCost);
        this.monitoring?.captureMessage?.(
          `AI generation cost: $${response.usage.totalCost.toFixed(4)}`,
          'info',
          {
            provider: this.name,
            model: request.model,
            tokens: response.usage.totalTokens,
          },
        );
      }

      // Add success breadcrumb
      this.addBreadcrumb('AI text generation completed', {
        provider: this.name,
        model: request.model,
        duration,
        tokensUsed: response.usage?.totalTokens || 0,
      });

      transaction?.setStatus('ok');
      return response;
    } catch (error) {
      transaction?.setStatus('internal_error');
      this.captureError(error as Error, {
        operation: 'generateText',
        provider: this.name,
        model: request.model,
      });
      throw error;
    } finally {
      transaction?.finish();
    }
  }

  async generateEmbedding(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    const span = this.startSpan('ai.embedding', `Generate embedding with ${this.name}`);
    try {
      span?.setData('model', request.model);
      span?.setData('inputLength', request.input.length);

      const response = await this.connector.generateEmbedding(request);

      span?.setData('embeddingDimensions', response.embedding.length);
      span?.setData('tokensUsed', response.usage?.totalTokens || 0);
      span?.setStatus('ok');

      return response;
    } catch (error) {
      span?.setStatus('internal_error');
      this.captureError(error as Error, {
        operation: 'generateEmbedding',
        provider: this.name,
        model: request.model,
      });
      throw error;
    } finally {
      span?.finish();
    }
  }

  async *streamText(request: AIStreamRequest): AsyncGenerator<AIStreamChunk> {
    const transaction = this.monitoring?.startTransaction?.({
      name: `ai.streamText.${this.name}`,
      op: 'ai.stream',
      data: {
        model: request.model,
        promptLength: request.prompt.length,
      },
    });

    try {
      let totalTokens = 0;
      let chunkCount = 0;

      for await (const chunk of this.connector.streamText(request)) {
        chunkCount++;
        if (chunk.usage?.totalTokens) {
          totalTokens = chunk.usage.totalTokens;
        }
        yield chunk;
      }

      transaction?.setData('chunkCount', chunkCount);
      transaction?.setData('totalTokens', totalTokens);
      transaction?.setStatus('ok');

      this.addBreadcrumb('AI stream completed', {
        provider: this.name,
        model: request.model,
        chunkCount,
        totalTokens,
      });
    } catch (error) {
      transaction?.setStatus('internal_error');
      this.captureError(error as Error, {
        operation: 'streamText',
        provider: this.name,
        model: request.model,
      });
      throw error;
    } finally {
      transaction?.finish();
    }
  }

  async analyzeImage(request: AIVisionRequest): Promise<AIVisionResponse> {
    const span = this.startSpan('ai.vision', `Analyze image with ${this.name}`);
    try {
      span?.setData('model', request.model);
      span?.setData('imageSize', request.image.length);

      const response = await this.connector.analyzeImage(request);

      span?.setData('responseLength', response.text.length);
      span?.setData('tokensUsed', response.usage?.totalTokens || 0);
      span?.setStatus('ok');

      return response;
    } catch (error) {
      span?.setStatus('internal_error');
      this.captureError(error as Error, {
        operation: 'analyzeImage',
        provider: this.name,
        model: request.model,
      });
      throw error;
    } finally {
      span?.finish();
    }
  }

  async getModelInfo(model: string): Promise<AIModelInfo> {
    return this.connector.getModelInfo(model);
  }

  getCapabilities(): AIConnectorCapabilities {
    return this.connector.getCapabilities();
  }

  async validateConnection(): Promise<boolean> {
    const span = this.startSpan('ai.validate', `Validate ${this.name} connection`);
    try {
      const result = await this.connector.validateConnection();
      span?.setStatus(result ? 'ok' : 'cancelled');
      return result;
    } catch (error) {
      span?.setStatus('internal_error');
      this.captureError(error as Error, {
        operation: 'validateConnection',
        provider: this.name,
      });
      throw error;
    } finally {
      span?.finish();
    }
  }

  estimateCost(usage: AIUsage): number {
    return this.connector.estimateCost(usage);
  }

  // Helper methods
  private startSpan(op: string, description: string): ISpan | undefined {
    return this.monitoring?.startSpan?.({
      op,
      description,
      data: {
        provider: this.name,
      },
    });
  }

  private addBreadcrumb(message: string, data?: Record<string, unknown>): void {
    this.monitoring?.addBreadcrumb({
      message,
      category: 'ai',
      level: 'info',
      type: 'default',
      data: {
        ...data,
        provider: this.name,
      },
    });
  }

  private captureError(error: Error, context: Record<string, unknown>): void {
    this.monitoring?.captureException(error, {
      tags: {
        component: 'ai-connector',
        provider: this.name,
      },
      extra: context,
    });
  }
}

/**
 * Factory function to create a monitored AI connector
 */
export function createMonitoredAIConnector(
  connector: IAIConnector,
  monitoring: IMonitoringConnector | undefined,
): IAIConnector {
  if (!monitoring?.isAvailable()) {
    return connector;
  }
  return new MonitoredAIConnector(connector, monitoring);
}
