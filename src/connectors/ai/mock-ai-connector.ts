/**
 * Mock AI Connector for deployment without real AI services
 *
 * This connector simulates AI responses for testing and demo purposes.
 * It provides canned responses without requiring API keys.
 */

import { IAIConnector } from '../../core/interfaces/ai-connector';
import { AIConfig, AIResponse, AIOptions } from '../../types/ai';

export class MockAIConnector implements IAIConnector {
  provider = 'mock' as const;

  private responses = [
    "Hello! I'm a mock AI assistant running in demo mode. This is Wireframe v1.2 - a universal AI assistant platform.",
    'I can simulate various AI responses for testing purposes. In production, you can connect real AI providers like OpenAI, Google Gemini, or others.',
    'This framework supports multi-cloud deployment, multiple messaging platforms, and a plugin system for extensibility.',
    "Feel free to explore the demo! When you're ready, you can configure real AI providers by setting the appropriate API keys.",
    'Wireframe is designed to be platform-agnostic, allowing you to deploy on Cloudflare, AWS, GCP, or any other cloud provider.',
  ];

  private responseIndex = 0;

  async initialize(config: AIConfig): Promise<void> {
    console.info('[MockAI] Initialized in DEMO mode - no real AI service connected');
    console.info('[MockAI] Provider:', config.provider || 'mock');
  }

  async complete(prompt: string, _options?: AIOptions): Promise<AIResponse> {
    console.info('[MockAI] Prompt received:', prompt);

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Get next response from the rotation
    const content = this.responses[this.responseIndex % this.responses.length];
    this.responseIndex++;

    // Check for specific prompts
    if (prompt.toLowerCase().includes('weather')) {
      return {
        content:
          "🌤️ Mock Weather Report: It's a beautiful day in the cloud! Perfect for deploying your AI assistants. (This is a demo response)",
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      };
    }

    if (prompt.toLowerCase().includes('help')) {
      return {
        content:
          "📚 Mock Help: I'm running in demo mode! Available commands:\n/start - Welcome message\n/help - This help\n/echo <text> - Echo your message\n/about - Learn about Wireframe\n\nTo use real AI, configure your API keys in the environment variables.",
        usage: { promptTokens: 10, completionTokens: 50, totalTokens: 60 },
      };
    }

    return {
      content,
      usage: {
        promptTokens: prompt.length,
        completionTokens: content.length,
        totalTokens: prompt.length + content.length,
      },
    };
  }

  async *stream(
    prompt: string,
    options?: AIOptions,
  ): AsyncGenerator<{ content: string; isComplete: boolean }> {
    console.info('[MockAI] Stream prompt received:', prompt);

    const response = await this.complete(prompt, options);
    const words = response.content.split(' ');

    // Simulate streaming by yielding words one by one
    for (let i = 0; i < words.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      yield {
        content: words.slice(0, i + 1).join(' '),
        isComplete: i === words.length - 1,
      };
    }
  }

  async embeddings(texts: string | string[]): Promise<number[][]> {
    const textArray = Array.isArray(texts) ? texts : [texts];
    console.info('[MockAI] Generating mock embeddings for', textArray.length, 'texts');

    // Return mock embeddings (768-dimensional vectors)
    return textArray.map(() =>
      Array(768)
        .fill(0)
        .map(() => Math.random() * 2 - 1),
    );
  }

  validateConfig(): boolean {
    // Mock connector doesn't need validation
    return true;
  }

  getModelInfo(): { name: string; contextWindow: number; maxOutput: number } {
    return {
      name: 'mock-model-v1',
      contextWindow: 8192,
      maxOutput: 2048,
    };
  }

  estimateCost(_usage: { promptTokens: number; completionTokens: number }): number {
    // Mock cost calculation (free in demo mode)
    return 0;
  }
}
