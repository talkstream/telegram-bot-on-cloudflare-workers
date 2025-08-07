/**
 * Main Wireframe class - orchestrates the ecosystem
 */

import { EventBus } from './events';
import { Registry } from './registry';
import { PluginManager } from './plugins';
import type { Config, Bot, MessageHandler, Connector } from './interfaces';
import { ConnectorType } from './interfaces';

export class Wireframe implements Bot {
  private eventBus: EventBus;
  private registry: Registry;
  private pluginManager: PluginManager;
  private connectors: Map<ConnectorType, Connector>;
  private started: boolean = false;

  constructor() {
    this.eventBus = new EventBus();
    this.registry = new Registry();
    this.pluginManager = new PluginManager();
    this.connectors = new Map();
  }

  /**
   * Create and configure a Wireframe instance
   */
  static async create(config?: Config): Promise<Wireframe> {
    const instance = new Wireframe();
    
    if (config) {
      // Load connectors
      if (config.connectors) {
        for (const connectorName of config.connectors) {
          const connector = await instance.registry.load(connectorName) as Connector;
          await connector.initialize(config.config?.[connectorName] || {});
          instance.connectors.set(connector.type, connector);
        }
      }

      // Load plugins
      if (config.plugins) {
        for (const pluginName of config.plugins) {
          const plugin = await instance.registry.load(pluginName);
          instance.pluginManager.add(plugin as any);
        }
        await instance.pluginManager.initializeAll(instance);
      }
    }

    return instance;
  }

  /**
   * Subscribe to events
   */
  on(event: string, handler: MessageHandler): void {
    this.eventBus.on(event, handler as any);
  }

  /**
   * Unsubscribe from events
   */
  off(event: string, handler: MessageHandler): void {
    this.eventBus.off(event, handler as any);
  }

  /**
   * Emit an event
   */
  emit(event: string, data: unknown): void {
    this.eventBus.emit(event, data);
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    if (this.started) {
      throw new Error('Bot already started');
    }

    // Start all connectors
    for (const connector of this.connectors.values()) {
      if ('start' in connector && typeof connector.start === 'function') {
        await (connector as any).start();
      }
    }

    this.started = true;
    this.emit('started', {});
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    // Stop all connectors
    for (const connector of this.connectors.values()) {
      if ('stop' in connector && typeof connector.stop === 'function') {
        await (connector as any).stop();
      }
    }

    // Dispose plugins
    await this.pluginManager.disposeAll();

    // Dispose connectors
    for (const connector of this.connectors.values()) {
      if (connector.dispose) {
        await connector.dispose();
      }
    }

    this.started = false;
    this.emit('stopped', {});
  }

  /**
   * Get a connector by type
   */
  getConnector(type: ConnectorType): Connector | undefined {
    return this.connectors.get(type);
  }

  /**
   * Get the AI connector (convenience method)
   */
  get ai(): any {
    const connector = this.getConnector(ConnectorType.AI);
    return connector || {
      async complete(_prompt: string): Promise<string> {
        throw new Error('No AI connector configured');
      }
    };
  }

  /**
   * Get the messaging connector (convenience method)
   */
  get messaging(): any {
    const connector = this.getConnector(ConnectorType.MESSAGING);
    return connector || {
      async sendMessage(_chatId: string, _text: string): Promise<void> {
        throw new Error('No messaging connector configured');
      }
    };
  }

  /**
   * Check if bot is running
   */
  isRunning(): boolean {
    return this.started;
  }
}