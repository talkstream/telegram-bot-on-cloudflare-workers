/**
 * Channel Factory - Dynamic connector loading for Wireframe v2.0
 * 
 * Loads and manages messaging connectors dynamically
 */

import type { MessagingConnector } from '../interfaces/messaging.js';
import type { ConnectorConfig } from '../interfaces/connector.js';
import type { ILogger } from '../interfaces/logger.js';
import type { EventBus } from '../events/event-bus.js';

/**
 * Channel loader function type
 */
export type ChannelLoader = () => Promise<{
  default?: new (config: ConnectorConfig) => MessagingConnector;
  [key: string]: unknown;
}>;

/**
 * Channel registry entry
 */
export interface ChannelRegistryEntry {
  name: string;
  loader: ChannelLoader;
  config?: ConnectorConfig;
}

/**
 * Channel factory configuration
 */
export interface ChannelFactoryConfig {
  logger: ILogger;
  eventBus: EventBus;
  channels?: Map<string, ChannelRegistryEntry>;
}

/**
 * Factory for creating messaging connectors dynamically
 */
export class ChannelFactory {
  private logger: ILogger;
  private eventBus: EventBus;
  private registry = new Map<string, ChannelRegistryEntry>();
  private instances = new Map<string, MessagingConnector>();

  constructor(config: ChannelFactoryConfig) {
    this.logger = config.logger;
    this.eventBus = config.eventBus;

    // Register default channels
    this.registerDefaultChannels();

    // Register custom channels if provided
    if (config.channels) {
      config.channels.forEach((entry, id) => {
        this.registry.set(id, entry);
      });
    }
  }

  /**
   * Register default channel loaders
   */
  private registerDefaultChannels(): void {
    // Telegram
    this.registry.set('telegram', {
      name: 'Telegram',
      loader: async () => import('../../connectors/messaging/telegram/telegram-connector.js'),
    });

    // WhatsApp
    this.registry.set('whatsapp', {
      name: 'WhatsApp',
      loader: async () => import('../../connectors/messaging/whatsapp/whatsapp-connector.js'),
    });

    // Future channels would be registered here
    // this.registry.set('discord', { ... });
    // this.registry.set('slack', { ... });
  }

  /**
   * Register a custom channel
   */
  registerChannel(id: string, entry: ChannelRegistryEntry): void {
    if (this.registry.has(id)) {
      throw new Error(`Channel ${id} is already registered`);
    }
    this.registry.set(id, entry);
    this.logger.info('Channel registered', { id, name: entry.name });
  }

  /**
   * Create or get a channel connector instance
   */
  async getConnector(channelId: string, config?: ConnectorConfig): Promise<MessagingConnector> {
    // Check if already instantiated
    const existing = this.instances.get(channelId);
    if (existing) {
      return existing;
    }

    // Get registry entry
    const entry = this.registry.get(channelId);
    if (!entry) {
      throw new Error(`Channel ${channelId} is not registered`);
    }

    try {
      // Load the connector module
      this.logger.info('Loading channel connector', { channelId, name: entry.name });
      const module = await entry.loader();
      
      // Find the connector class - could be default export or named export
      let ConnectorClass: (new (config: ConnectorConfig) => MessagingConnector) | undefined;
      
      if (module.default && typeof module.default === 'function') {
        ConnectorClass = module.default as new (config: ConnectorConfig) => MessagingConnector;
      } else {
        // Look for named exports
        const moduleExports = module as Record<string, unknown>;
        const connectorExport = Object.entries(moduleExports).find(([key, value]) => 
          typeof value === 'function' && 
          (key.includes('Connector') || (value as Function).name.includes('Connector'))
        );
        
        if (connectorExport) {
          ConnectorClass = connectorExport[1] as new (config: ConnectorConfig) => MessagingConnector;
        }
      }
      
      if (!ConnectorClass) {
        throw new Error(`No connector class found in module for ${channelId}`);
      }

      // Create instance with config
      const connectorConfig = {
        ...entry.config,
        ...config,
        eventBus: this.eventBus,
        logger: this.logger.child({ channel: channelId }),
      };

      const connector = new ConnectorClass(connectorConfig);
      await connector.initialize(connectorConfig);

      // Cache instance
      this.instances.set(channelId, connector);

      this.logger.info('Channel connector loaded', { 
        channelId, 
        name: entry.name,
        ready: connector.isReady(),
      });

      return connector;
    } catch (error) {
      this.logger.error('Failed to load channel connector', {
        channelId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Failed to load channel ${channelId}: ${error}`);
    }
  }

  /**
   * Get all registered channels
   */
  getRegisteredChannels(): Array<{ id: string; name: string }> {
    return Array.from(this.registry.entries()).map(([id, entry]) => ({
      id,
      name: entry.name,
    }));
  }

  /**
   * Check if a channel is registered
   */
  isChannelRegistered(channelId: string): boolean {
    return this.registry.has(channelId);
  }

  /**
   * Destroy a channel instance
   */
  async destroyChannel(channelId: string): Promise<void> {
    const connector = this.instances.get(channelId);
    if (connector) {
      await connector.destroy();
      this.instances.delete(channelId);
      this.logger.info('Channel connector destroyed', { channelId });
    }
  }

  /**
   * Destroy all channel instances
   */
  async destroyAll(): Promise<void> {
    const promises = Array.from(this.instances.keys()).map(id => 
      this.destroyChannel(id)
    );
    await Promise.all(promises);
  }
}

/**
 * Factory function to create ChannelFactory
 */
export function createChannelFactory(config: ChannelFactoryConfig): ChannelFactory {
  return new ChannelFactory(config);
}