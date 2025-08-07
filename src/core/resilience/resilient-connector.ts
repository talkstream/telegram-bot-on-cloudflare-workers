/**
 * Resilient Connector Wrapper
 *
 * Adds circuit breaker protection to any connector
 */

import { CircuitBreakerManager } from './circuit-breaker-manager';
import type { CircuitBreakerConfig } from './circuit-breaker';

import type { IAIConnector } from '@/core/interfaces/ai';
import type { IMessagingConnector } from '@/core/interfaces/messaging';
import { logger } from '@/lib/logger';

/**
 * Wrap AI Connector with circuit breaker
 */
export class ResilientAIConnector implements IAIConnector {
  private manager: CircuitBreakerManager;
  private serviceName: string;

  constructor(
    private connector: IAIConnector,
    config?: Partial<CircuitBreakerConfig>,
  ) {
    this.manager = CircuitBreakerManager.getInstance();
    this.serviceName = `ai:${connector.constructor.name}`;

    // Register with custom config if provided
    if (config) {
      this.manager.register({
        service: this.serviceName,
        failureThreshold: 3,
        failureWindow: 60000,
        successThreshold: 0.7,
        recoveryTimeout: 30000,
        halfOpenRequests: 2,
        ...config,
      });
    }
  }

  async generateResponse(
    prompt: string,
    context?: Record<string, any>,
  ): Promise<{ response: string; usage?: any }> {
    return this.manager.execute(this.serviceName, async () => {
      try {
        const result = await this.connector.generateResponse(prompt, context);
        return result;
      } catch (error) {
        logger.error('AI connector failed', {
          service: this.serviceName,
          error,
        });
        throw error;
      }
    });
  }

  async generateStreamingResponse(
    prompt: string,
    context?: Record<string, any>,
  ): Promise<AsyncIterable<string>> {
    return this.manager.execute(this.serviceName, async () => {
      try {
        const stream = await this.connector.generateStreamingResponse(prompt, context);
        return stream;
      } catch (error) {
        logger.error('AI streaming failed', {
          service: this.serviceName,
          error,
        });
        throw error;
      }
    });
  }

  getCapabilities() {
    return this.connector.getCapabilities();
  }

  validateConfig(): Promise<boolean> {
    // Config validation should not use circuit breaker
    return this.connector.validateConfig();
  }

  getStats() {
    const circuitStats = this.manager.get(this.serviceName)?.getStats();
    return {
      circuit: circuitStats,
      connector: this.connector.getStats?.(),
    };
  }
}

/**
 * Wrap Messaging Connector with circuit breaker
 */
export class ResilientMessagingConnector implements IMessagingConnector {
  private manager: CircuitBreakerManager;
  private serviceName: string;

  constructor(
    private connector: IMessagingConnector,
    config?: Partial<CircuitBreakerConfig>,
  ) {
    this.manager = CircuitBreakerManager.getInstance();
    this.serviceName = `messaging:${connector.constructor.name}`;

    // Register with custom config if provided
    if (config) {
      this.manager.register({
        service: this.serviceName,
        failureThreshold: 5,
        failureWindow: 30000,
        successThreshold: 0.8,
        recoveryTimeout: 20000,
        halfOpenRequests: 3,
        ...config,
      });
    }
  }

  async sendMessage(chatId: string, text: string, options?: any): Promise<void> {
    return this.manager.execute(this.serviceName, async () => {
      try {
        await this.connector.sendMessage(chatId, text, options);
      } catch (error) {
        logger.error('Messaging send failed', {
          service: this.serviceName,
          chatId,
          error,
        });
        throw error;
      }
    });
  }

  async sendTypingAction(chatId: string): Promise<void> {
    // Typing action is not critical, can bypass circuit breaker
    try {
      await this.connector.sendTypingAction(chatId);
    } catch (error) {
      logger.debug('Typing action failed', { chatId, error });
    }
  }

  async editMessage(chatId: string, messageId: string, text: string, options?: any): Promise<void> {
    return this.manager.execute(this.serviceName, async () => {
      try {
        await this.connector.editMessage(chatId, messageId, text, options);
      } catch (error) {
        logger.error('Message edit failed', {
          service: this.serviceName,
          chatId,
          messageId,
          error,
        });
        throw error;
      }
    });
  }

  async deleteMessage(chatId: string, messageId: string): Promise<void> {
    return this.manager.execute(this.serviceName, async () => {
      try {
        await this.connector.deleteMessage(chatId, messageId);
      } catch (error) {
        logger.error('Message delete failed', {
          service: this.serviceName,
          chatId,
          messageId,
          error,
        });
        throw error;
      }
    });
  }

  async getUserInfo(userId: string): Promise<any> {
    return this.manager.execute(this.serviceName, async () => {
      try {
        const info = await this.connector.getUserInfo(userId);
        return info;
      } catch (error) {
        logger.error('Get user info failed', {
          service: this.serviceName,
          userId,
          error,
        });
        throw error;
      }
    });
  }

  async handleWebhook(request: Request): Promise<Response> {
    // Webhook handling should not use circuit breaker
    return this.connector.handleWebhook(request);
  }

  async setWebhook(url: string): Promise<void> {
    // Webhook setup is administrative, bypass circuit breaker
    return this.connector.setWebhook(url);
  }

  getStats() {
    const circuitStats = this.manager.get(this.serviceName)?.getStats();
    return {
      circuit: circuitStats,
      connector: this.connector.getStats?.(),
    };
  }
}

/**
 * Factory function to wrap any connector with resilience
 */
export function withResilience<T extends IAIConnector | IMessagingConnector>(
  connector: T,
  config?: Partial<CircuitBreakerConfig>,
): T {
  if ('generateResponse' in connector) {
    return new ResilientAIConnector(connector, config) as any;
  } else if ('sendMessage' in connector) {
    return new ResilientMessagingConnector(connector as any, config) as any;
  }

  return connector;
}
