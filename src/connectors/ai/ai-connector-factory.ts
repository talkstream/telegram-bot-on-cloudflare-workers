import { MockAIConnector } from './mock-ai-connector.js';

import type { IMonitoringConnector } from '@/core/interfaces/monitoring.js';
import type { AIConnector } from '@/core/interfaces/ai.js';
import type { ResourceConstraints } from '@/core/interfaces/resource-constraints.js';
import { logger } from '@/lib/logger.js';

export interface AIConnectorFactoryOptions {
  monitoring?: IMonitoringConnector;
  constraints?: ResourceConstraints;
}

export class AIConnectorFactory {
  private static readonly connectorMap: Record<
    string,
    new (constraints?: ResourceConstraints) => AIConnector
  > = {
    mock: MockAIConnector,
  };

  /**
   * Create an AI connector with optional monitoring
   */
  static create(
    provider: string,
    config: Record<string, unknown>,
    options?: AIConnectorFactoryOptions,
  ): AIConnector | null {
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
    _env: Record<string, string | undefined>,
    options?: AIConnectorFactoryOptions,
  ): AIConnector[] {
    const connectors: AIConnector[] = [];

    // Always add mock connector for now
    const mock = this.create('mock', {}, options);
    if (mock) connectors.push(mock);

    return connectors;
  }
}