import { OpenAIConnector } from './openai-connector.js';
import { AnthropicConnector } from './anthropic-connector.js';
import { GoogleAIConnector } from './google/google-ai-connector.js';
import { LocalAIConnector } from './local-ai-connector.js';
import { MockAIConnector } from './mock-ai-connector.js';
import { createMonitoredAIConnector } from './monitored-ai-connector.js';

import type { IMonitoringConnector } from '@/core/interfaces/monitoring.js';
import type { IAIConnector } from '@/core/interfaces/ai.js';
import type { ResourceConstraints } from '@/core/interfaces/resource-constraints.js';
import { logger } from '@/lib/logger.js';

export interface AIConnectorFactoryOptions {
  monitoring?: IMonitoringConnector;
  constraints?: ResourceConstraints;
}

export class AIConnectorFactory {
  private static readonly connectorMap: Record<
    string,
    new (constraints?: ResourceConstraints) => IAIConnector
  > = {
    openai: OpenAIConnector,
    anthropic: AnthropicConnector,
    google: GoogleAIConnector,
    local: LocalAIConnector,
    mock: MockAIConnector,
  };

  /**
   * Create an AI connector with optional monitoring
   */
  static create(
    provider: string,
    config: Record<string, unknown>,
    options?: AIConnectorFactoryOptions,
  ): IAIConnector | null {
    const ConnectorClass = this.connectorMap[provider.toLowerCase()];

    if (!ConnectorClass) {
      logger.error(`Unknown AI provider: ${provider}`);
      return null;
    }

    try {
      // Create the base connector
      const connector = new ConnectorClass(options?.constraints);

      // Initialize the connector
      void connector.initialize(config);

      // Wrap with monitoring if available
      if (options?.monitoring?.isAvailable()) {
        logger.info(`Creating monitored ${provider} connector`);
        return createMonitoredAIConnector(connector, options.monitoring);
      }

      return connector;
    } catch (error) {
      logger.error(`Failed to create ${provider} connector`, { error });
      return null;
    }
  }

  /**
   * Create multiple AI connectors from environment configuration
   */
  static createFromEnv(
    env: Record<string, string | undefined>,
    options?: AIConnectorFactoryOptions,
  ): IAIConnector[] {
    const connectors: IAIConnector[] = [];

    // OpenAI
    if (env.OPENAI_API_KEY) {
      const openai = this.create('openai', { apiKey: env.OPENAI_API_KEY }, options);
      if (openai) connectors.push(openai);
    }

    // Anthropic
    if (env.ANTHROPIC_API_KEY) {
      const anthropic = this.create('anthropic', { apiKey: env.ANTHROPIC_API_KEY }, options);
      if (anthropic) connectors.push(anthropic);
    }

    // Google AI
    if (env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY) {
      const google = this.create(
        'google',
        { apiKey: env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY },
        options,
      );
      if (google) connectors.push(google);
    }

    // Local AI (if configured)
    if (env.LOCAL_AI_URL) {
      const local = this.create('local', { baseUrl: env.LOCAL_AI_URL }, options);
      if (local) connectors.push(local);
    }

    // Add mock connector in demo mode
    if (env.DEMO_MODE === 'true' || connectors.length === 0) {
      const mock = this.create('mock', {}, options);
      if (mock) connectors.push(mock);
    }

    return connectors;
  }
}
