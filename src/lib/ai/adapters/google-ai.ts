import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

import type {
  CompletionRequest,
  CompletionResponse,
  ProviderCapabilities,
  ProviderConfig,
  UsageMetrics,
} from '../types';
import { AIProviderError } from '../types';
import { logger } from '../../logger';

import { BaseAIProvider } from './base';

export interface GoogleAIConfig {
  apiKey: string;
  model?: string;
}

/**
 * Adapter for Google Gemini AI
 */
export class GoogleAIProvider extends BaseAIProvider {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private modelName: string;

  constructor(config: GoogleAIConfig, tier?: 'free' | 'paid') {
    super({
      id: 'google-ai',
      displayName: 'Google Gemini',
      type: 'google-ai',
      config: { ...config } as Record<string, unknown>,
      tier: tier || 'free',
    });

    this.modelName = config.model || 'gemini-2.5-flash';
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });
  }

  async doComplete(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      // Convert messages to Gemini format
      const prompt = this.messagesToPrompt(request.messages);

      // Generate content
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Extract usage if available
      const usage: UsageMetrics = {
        inputUnits: 0, // Gemini doesn't provide token counts in the same way
        outputUnits: 0,
      };

      // Try to get usage metadata if available
      if (response.usageMetadata) {
        usage.inputUnits = response.usageMetadata.promptTokenCount || 0;
        usage.outputUnits = response.usageMetadata.candidatesTokenCount || 0;
        usage.totalUnits = response.usageMetadata.totalTokenCount || 0;
      }

      logger.info('Google AI call successful');

      return {
        content: text,
        usage,
        metadata: {
          model: this.modelName,
          providerId: this.id,
          processingTimeMs: Date.now(),
        },
      };
    } catch (error) {
      logger.error('Error calling Google AI:', error);
      throw this.normalizeError(error);
    }
  }

  async doValidateConfig(config: ProviderConfig): Promise<boolean> {
    if (!config.config?.apiKey) {
      return false;
    }

    try {
      // Validate by attempting to create a model
      const testAI = new GoogleGenerativeAI(config.config.apiKey as string);
      testAI.getGenerativeModel({ model: this.modelName });
      return true;
    } catch {
      return false;
    }
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: false, // Streaming is supported but not implemented in this adapter
      maxTokens: 8192,
      maxContextLength: 1048576, // Gemini 2.5 supports 1M context
      supportedOptions: ['temperature', 'maxTokens', 'topP', 'stopSequences'],
      supportedModels: ['gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
      customFeatures: {
        multimodal: true,
        codeExecution: true,
        functionCalling: true,
      },
    };
  }

  /**
   * Convert our message format to Gemini's prompt format
   */
  private messagesToPrompt(messages: CompletionRequest['messages']): string {
    return messages
      .map((msg) => {
        switch (msg.role) {
          case 'system':
            return `System: ${msg.content}`;
          case 'user':
            return `User: ${msg.content}`;
          case 'assistant':
            return `Assistant: ${msg.content}`;
          default:
            return msg.content;
        }
      })
      .join('\n\n');
  }

  protected override normalizeError(error: unknown): AIProviderError {
    const baseError = super.normalizeError(error);

    // Check for specific Gemini error patterns
    if (error instanceof Error) {
      if (error.message.includes('quota') || error.message.includes('limit')) {
        return {
          ...baseError,
          code: 'QUOTA_EXCEEDED',
          retryable: false,
        };
      }
      if (error.message.includes('API key')) {
        return {
          ...baseError,
          code: 'AUTHENTICATION_ERROR',
          retryable: false,
        };
      }
    }

    return baseError;
  }
}

/**
 * Adapter wrapper for the existing GeminiService to maintain compatibility
 */
export class GeminiServiceAdapter extends GoogleAIProvider {
  constructor(apiKey: string, tier?: 'free' | 'paid') {
    super({ apiKey }, tier);
  }

  // Compatibility method for existing code
  async generateText(prompt: string): Promise<string> {
    const response = await this.complete({
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content;
  }
}
