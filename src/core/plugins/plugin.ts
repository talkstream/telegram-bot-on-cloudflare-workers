import { EventBus } from '../events/event-bus.js'
import type { Connector } from '../interfaces/connector.js'

/**
 * Plugin interface for extending functionality
 */
export interface Plugin {
  /**
   * Unique plugin identifier
   */
  id: string

  /**
   * Plugin name
   */
  name: string

  /**
   * Plugin version
   */
  version: string

  /**
   * Plugin description
   */
  description: string

  /**
   * Plugin author
   */
  author?: string

  /**
   * Plugin homepage
   */
  homepage?: string

  /**
   * Plugin dependencies
   */
  dependencies?: Dependency[]

  /**
   * Install the plugin
   */
  install(context: PluginContext): Promise<void>

  /**
   * Activate the plugin
   */
  activate(): Promise<void>

  /**
   * Deactivate the plugin
   */
  deactivate(): Promise<void>

  /**
   * Uninstall the plugin
   */
  uninstall(): Promise<void>

  /**
   * Get plugin commands
   */
  getCommands?(): PluginCommand[]

  /**
   * Get plugin middleware
   */
  getMiddleware?(): PluginMiddleware[]

  /**
   * Get plugin connectors
   */
  getConnectors?(): Connector[]

  /**
   * Get plugin configuration schema
   */
  getConfigSchema?(): ConfigSchema

  /**
   * Plugin lifecycle hooks
   */
  hooks?: PluginHooks
}

export interface Dependency {
  /**
   * Dependency ID
   */
  id: string

  /**
   * Version requirement
   */
  version: string

  /**
   * Is this dependency optional?
   */
  optional?: boolean
}

export interface PluginContext {
  /**
   * Plugin manager instance
   */
  manager: PluginManager

  /**
   * Event bus for communication
   */
  eventBus: EventBus

  /**
   * Plugin configuration
   */
  config: Record<string, unknown>

  /**
   * Plugin data directory
   */
  dataDir: string

  /**
   * Logger instance
   */
  logger: Logger

  /**
   * Storage adapter
   */
  storage: PluginStorage

  /**
   * Commands registry
   */
  commands: Map<string, PluginCommand>

  /**
   * Get other plugins
   */
  getPlugin(id: string): Plugin | undefined

  /**
   * Get connector by ID
   */
  getConnector(id: string): Connector | undefined

  /**
   * Register a service
   */
  registerService(id: string, service: unknown): void

  /**
   * Get a service
   */
  getService(id: string): unknown
}

export interface PluginCommand {
  /**
   * Command name
   */
  name: string

  /**
   * Command description
   */
  description: string

  /**
   * Command aliases
   */
  aliases?: string[]

  /**
   * Command handler
   */
  handler: CommandHandler

  /**
   * Command options
   */
  options?: CommandOption[]
}

export type CommandHandler = (args: unknown, context: CommandContext) => Promise<void>

export interface CommandContext {
  /**
   * Command sender
   */
  sender: {
    id: string
    firstName?: string
    lastName?: string
    username?: string
  }

  /**
   * Command arguments
   */
  args: Record<string, unknown>

  /**
   * Reply function
   */
  reply: (message: string) => Promise<void>

  /**
   * Plugin context
   */
  plugin: PluginContext
}

export interface CommandOption {
  name: string
  type: 'string' | 'number' | 'boolean'
  description: string
  required?: boolean
  default?: unknown
  choices?: unknown[]
}

export interface PluginMiddleware {
  /**
   * Middleware name
   */
  name: string

  /**
   * Middleware handler
   */
  handler: MiddlewareHandler

  /**
   * Middleware priority (lower = higher priority)
   */
  priority?: number
}

export type MiddlewareHandler = (
  request: unknown,
  response: unknown,
  next: () => Promise<void>
) => Promise<void>

export interface ConfigSchema {
  /**
   * Schema type
   */
  type: 'object'

  /**
   * Schema properties
   */
  properties: Record<string, unknown>

  /**
   * Required properties
   */
  required?: string[]

  /**
   * Additional properties allowed?
   */
  additionalProperties?: boolean
}

export interface PluginHooks {
  /**
   * Called before plugin installation
   */
  beforeInstall?: () => Promise<void>

  /**
   * Called after plugin installation
   */
  afterInstall?: () => Promise<void>

  /**
   * Called before plugin activation
   */
  beforeActivate?: () => Promise<void>

  /**
   * Called after plugin activation
   */
  afterActivate?: () => Promise<void>

  /**
   * Called before plugin deactivation
   */
  beforeDeactivate?: () => Promise<void>

  /**
   * Called after plugin deactivation
   */
  afterDeactivate?: () => Promise<void>

  /**
   * Called before plugin uninstallation
   */
  beforeUninstall?: () => Promise<void>

  /**
   * Called after plugin uninstallation
   */
  afterUninstall?: () => Promise<void>

  /**
   * Called when configuration changes
   */
  onConfigChange?: (
    newConfig: Record<string, unknown>,
    oldConfig: Record<string, unknown>
  ) => Promise<void>

  /**
   * Called on plugin error
   */
  onError?: (error: Error) => Promise<void>
}

export interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void
  info(message: string, metadata?: Record<string, unknown>): void
  warn(message: string, metadata?: Record<string, unknown>): void
  error(message: string, metadata?: Record<string, unknown>): void
}

export interface PluginStorage {
  /**
   * Get value by key
   */
  get<T = unknown>(key: string): Promise<T | null>

  /**
   * Set value by key
   */
  set<T = unknown>(key: string, value: T): Promise<void>

  /**
   * Delete value by key
   */
  delete(key: string): Promise<void>

  /**
   * Check if key exists
   */
  has(key: string): Promise<boolean>

  /**
   * Clear all storage
   */
  clear(): Promise<void>

  /**
   * Get all keys
   */
  keys(): Promise<string[]>
}

export interface PluginManager {
  /**
   * Install a plugin
   */
  install(plugin: Plugin, config?: Record<string, unknown>): Promise<void>

  /**
   * Uninstall a plugin
   */
  uninstall(pluginId: string): Promise<void>

  /**
   * Activate a plugin
   */
  activate(pluginId: string): Promise<void>

  /**
   * Deactivate a plugin
   */
  deactivate(pluginId: string): Promise<void>

  /**
   * Get plugin by ID
   */
  get(pluginId: string): Plugin | undefined

  /**
   * Get all plugins
   */
  getAll(): Plugin[]

  /**
   * Get active plugins
   */
  getActive(): Plugin[]

  /**
   * Check if plugin is active
   */
  isActive(pluginId: string): boolean

  /**
   * Update plugin configuration
   */
  updateConfig(pluginId: string, config: Record<string, unknown>): Promise<void>

  /**
   * Load plugins from directory
   */
  loadFromDirectory(directory: string): Promise<void>

  /**
   * Load plugin from package
   */
  loadFromPackage(packageName: string): Promise<void>

  /**
   * Register a global command
   */
  registerCommand(command: PluginCommand): void

  /**
   * Register global middleware
   */
  registerMiddleware(middleware: PluginMiddleware): void

  /**
   * Get all registered commands
   */
  getCommands(): PluginCommand[]

  /**
   * Get all registered middleware
   */
  getMiddleware(): PluginMiddleware[]
}

/**
 * Plugin state
 */
export enum PluginState {
  INSTALLED = 'installed',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error'
}

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  id: string
  name: string
  version: string
  description: string
  author?: string
  homepage?: string
  state: PluginState
  installedAt: Date
  activatedAt?: Date
  config?: Record<string, unknown>
  error?: string
}

/**
 * Base plugin class
 */
export abstract class BasePlugin implements Plugin {
  abstract id: string
  abstract name: string
  abstract version: string
  abstract description: string

  author?: string
  homepage?: string
  dependencies?: Dependency[]
  hooks?: PluginHooks

  protected context?: PluginContext

  async install(context: PluginContext): Promise<void> {
    this.context = context
    await this.hooks?.beforeInstall?.()
    await this.onInstall()
    await this.hooks?.afterInstall?.()
  }

  async activate(): Promise<void> {
    await this.hooks?.beforeActivate?.()
    await this.onActivate()
    await this.hooks?.afterActivate?.()
  }

  async deactivate(): Promise<void> {
    await this.hooks?.beforeDeactivate?.()
    await this.onDeactivate()
    await this.hooks?.afterDeactivate?.()
  }

  async uninstall(): Promise<void> {
    await this.hooks?.beforeUninstall?.()
    await this.onUninstall()
    await this.hooks?.afterUninstall?.()
  }

  /**
   * Override these methods in your plugin
   */
  protected async onInstall(): Promise<void> {}
  protected async onActivate(): Promise<void> {}
  protected async onDeactivate(): Promise<void> {}
  protected async onUninstall(): Promise<void> {}

  /**
   * Helper methods
   */
  protected get logger(): Logger {
    if (!this.context) throw new Error('Plugin not initialized')
    return this.context.logger
  }

  protected get storage(): PluginStorage {
    if (!this.context) throw new Error('Plugin not initialized')
    return this.context.storage
  }

  protected get eventBus(): EventBus {
    if (!this.context) throw new Error('Plugin not initialized')
    return this.context.eventBus
  }

  protected get config(): Record<string, unknown> {
    if (!this.context) throw new Error('Plugin not initialized')
    return this.context.config
  }
}
