/**
 * Main Wireframe class - orchestrates the ecosystem
 */

import { EventBus } from './events'
import type { Bot, Config, Connector, MessageHandler, Plugin } from './interfaces'
import { ConnectorType } from './interfaces'
import { PluginManager } from './plugins'
import { Registry } from './registry'

type EventHandler = (...args: unknown[]) => void | Promise<void>

export class Wireframe implements Bot {
  private eventBus: EventBus
  private registry: Registry
  private pluginManager: PluginManager
  private connectors: Map<ConnectorType, Connector>
  private started: boolean = false

  constructor() {
    this.eventBus = new EventBus()
    this.registry = new Registry()
    this.pluginManager = new PluginManager()
    this.connectors = new Map()
  }

  /**
   * Create and configure a Wireframe instance
   */
  static async create(config?: Config): Promise<Wireframe> {
    const instance = new Wireframe()

    if (config) {
      // Load connectors
      if (config.connectors) {
        for (const connectorName of config.connectors) {
          const connector = (await instance.registry.load(connectorName)) as Connector
          await connector.initialize(config.config?.[connectorName] || {})
          instance.connectors.set(connector.type, connector)
        }
      }

      // Load plugins
      if (config.plugins) {
        for (const pluginName of config.plugins) {
          const plugin = await instance.registry.load(pluginName)
          instance.pluginManager.add(plugin as Plugin)
        }
        await instance.pluginManager.initializeAll(instance)
      }
    }

    return instance
  }

  /**
   * Subscribe to events
   */
  on(event: string, handler: MessageHandler): void {
    this.eventBus.on(event, handler as EventHandler)
  }

  /**
   * Unsubscribe from events
   */
  off(event: string, handler: MessageHandler): void {
    this.eventBus.off(event, handler as EventHandler)
  }

  /**
   * Emit an event
   */
  emit(event: string, data: unknown): void {
    this.eventBus.emit(event, data)
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    if (this.started) {
      throw new Error('Bot already started')
    }

    // Start all connectors
    for (const connector of this.connectors.values()) {
      if ('start' in connector && typeof connector.start === 'function') {
        await connector.start()
      }
    }

    this.started = true
    this.emit('started', {})
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return
    }

    // Stop all connectors
    for (const connector of this.connectors.values()) {
      if ('stop' in connector && typeof connector.stop === 'function') {
        await connector.stop()
      }
    }

    // Dispose plugins
    await this.pluginManager.disposeAll()

    // Dispose connectors
    for (const connector of this.connectors.values()) {
      if (connector.dispose) {
        await connector.dispose()
      }
    }

    this.started = false
    this.emit('stopped', {})
  }

  /**
   * Get a connector by type
   */
  getConnector(type: ConnectorType): Connector | undefined {
    return this.connectors.get(type)
  }

  /**
   * Get the AI connector (convenience method)
   */
  get ai(): { complete: (prompt: string) => Promise<string> } {
    const connector = this.getConnector(ConnectorType.AI)
    if (connector && 'complete' in connector) {
      return connector as { complete: (prompt: string) => Promise<string> }
    }
    return {
      async complete(_prompt: string): Promise<string> {
        throw new Error('No AI connector configured')
      }
    }
  }

  /**
   * Get the messaging connector (convenience method)
   */
  get messaging(): { sendMessage: (chatId: string, text: string) => Promise<void> } {
    const connector = this.getConnector(ConnectorType.MESSAGING)
    if (connector && 'sendMessage' in connector) {
      return connector as { sendMessage: (chatId: string, text: string) => Promise<void> }
    }
    return {
      async sendMessage(_chatId: string, _text: string): Promise<void> {
        throw new Error('No messaging connector configured')
      }
    }
  }

  /**
   * Check if bot is running
   */
  isRunning(): boolean {
    return this.started
  }
}
