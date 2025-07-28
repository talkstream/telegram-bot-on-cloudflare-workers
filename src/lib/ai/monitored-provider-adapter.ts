import type { AIProvider, CompletionRequest, CompletionResponse } from './types.js';

import type { IAIConnector } from '@/core/interfaces/ai.js';
import type { IMonitoringConnector } from '@/core/interfaces/monitoring.js';
import { createMonitoredAIConnector } from '@/connectors/ai/monitored-ai-connector.js';

/**
 * Adapter that wraps IAIConnector to work with the legacy AIProvider interface
 * and adds monitoring capabilities
 */
export class MonitoredProviderAdapter implements AIProvider {
  private monitoredConnector: IAIConnector;

  constructor(
    public readonly id: string,
    private connector: IAIConnector,
    monitoring: IMonitoringConnector | undefined,
  ) {
    // Wrap the connector with monitoring
    this.monitoredConnector = createMonitoredAIConnector(connector, monitoring);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Convert messages to a single prompt
    const prompt = request.messages.map((msg) => `${msg.role}: ${msg.content}`).join('\n');

    // Call the monitored connector
    const response = await this.monitoredConnector.generateText({
      prompt,
      model: request.options?.model || 'default',
      maxTokens: request.options?.maxTokens,
      temperature: request.options?.temperature,
      topP: request.options?.topP,
      stopSequences: request.options?.stopSequences,
    });

    // Convert response back to legacy format
    return {
      content: response.text,
      usage: response.usage
        ? {
            promptTokens: response.usage.promptTokens,
            completionTokens: response.usage.completionTokens,
            totalTokens: response.usage.totalTokens,
          }
        : undefined,
      metadata: response.metadata,
    };
  }

  // Optional stream method
  async *stream?(request: CompletionRequest): AsyncIterator<string> {
    const prompt = request.messages.map((msg) => `${msg.role}: ${msg.content}`).join('\n');

    for await (const chunk of this.monitoredConnector.streamText({
      prompt,
      model: request.options?.model || 'default',
      maxTokens: request.options?.maxTokens,
      temperature: request.options?.temperature,
      topP: request.options?.topP,
      stopSequences: request.options?.stopSequences,
    })) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  }

  /**
   * Create a monitored provider from an existing provider
   */
  static fromProvider(
    provider: AIProvider,
    monitoring: IMonitoringConnector | undefined,
  ): AIProvider {
    // If it's already a monitored adapter, return as is
    if (provider instanceof MonitoredProviderAdapter) {
      return provider;
    }

    // Wrap the provider's complete method with monitoring
    const monitoredProvider: AIProvider = {
      id: provider.id,
      complete: async (request: CompletionRequest) => {
        const transaction = monitoring?.startTransaction?.({
          name: `ai.complete.${provider.id}`,
          op: 'ai.complete',
          data: {
            provider: provider.id,
            model: request.options?.model,
          },
        });

        try {
          monitoring?.addBreadcrumb({
            message: `AI completion started with ${provider.id}`,
            category: 'ai',
            level: 'info',
            data: {
              provider: provider.id,
              messageCount: request.messages.length,
            },
          });

          const response = await provider.complete(request);

          transaction?.setData('tokensUsed', response.usage?.totalTokens || 0);
          transaction?.setStatus('ok');

          return response;
        } catch (error) {
          transaction?.setStatus('internal_error');
          monitoring?.captureException(error as Error, {
            tags: {
              component: 'ai-provider',
              provider: provider.id,
            },
          });
          throw error;
        } finally {
          transaction?.finish();
        }
      },
    };

    // Copy stream method if it exists
    if (provider.stream) {
      monitoredProvider.stream = async function* (request: CompletionRequest) {
        const transaction = monitoring?.startTransaction?.({
          name: `ai.stream.${provider.id}`,
          op: 'ai.stream',
          data: {
            provider: provider.id,
            model: request.options?.model,
          },
        });

        try {
          let chunkCount = 0;
          const streamMethod = provider.stream;
          if (!streamMethod) throw new Error('Stream method not available');
          for await (const chunk of streamMethod(request)) {
            chunkCount++;
            yield chunk;
          }

          transaction?.setData('chunkCount', chunkCount);
          transaction?.setStatus('ok');
        } catch (error) {
          transaction?.setStatus('internal_error');
          monitoring?.captureException(error as Error, {
            tags: {
              component: 'ai-provider',
              provider: provider.id,
            },
          });
          throw error;
        } finally {
          transaction?.finish();
        }
      };
    }

    return monitoredProvider;
  }
}
