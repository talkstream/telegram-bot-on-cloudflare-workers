import { FieldMapper } from '../database/field-mapper.js'
import { CommonEventType, EventBus } from '../events/event-bus.js'
import type { Connector } from '../interfaces/connector.js'

import type {
  PluginManager as IPluginManager,
  Logger,
  Plugin,
  PluginCommand,
  PluginContext,
  PluginMetadata,
  PluginMiddleware,
  PluginStorage
} from './plugin.js'
import { PluginState } from './plugin.js'

// Helper type for plugin metadata source
interface PluginMetadataSource {
  id: string
  name: string
  version: string
  description: string
  author?: string
  homepage?: string
  state: PluginState
  installedAt: Date
  config?: Record<string, unknown>
}

// Field mapper for plugin metadata
const _pluginMetadataMapper = new FieldMapper<PluginMetadataSource, PluginMetadata>([
  { dbField: 'id', domainField: 'id' },
  { dbField: 'name', domainField: 'name' },
  { dbField: 'version', domainField: 'version' },
  { dbField: 'description', domainField: 'description' },
  { dbField: 'author', domainField: 'author' },
  { dbField: 'homepage', domainField: 'homepage' },
  { dbField: 'state', domainField: 'state' },
  { dbField: 'installedAt', domainField: 'installedAt' },
  { dbField: 'config', domainField: 'config' }
])

export class PluginManager implements IPluginManager {
  private plugins: Map<string, Plugin> = new Map()
  private pluginStates: Map<string, PluginState> = new Map()
  private pluginConfigs: Map<string, Record<string, unknown>> = new Map()
  private commands: Map<string, PluginCommand> = new Map()
  private middleware: PluginMiddleware[] = []
  private services: Map<string, unknown> = new Map()
  private connectorRegistry: Map<string, Connector> = new Map()

  constructor(
    private eventBus: EventBus,
    private logger: Logger,
    private storageFactory: (pluginId: string) => PluginStorage,
    private dataDir: string
  ) {}

  async install(plugin: Plugin, config: Record<string, unknown> = {}): Promise<void> {
    try {
      // Check if already installed
      if (this.plugins.has(plugin.id)) {
        throw new Error(`Plugin ${plugin.id} is already installed`)
      }

      // Validate dependencies
      await this.validateDependencies(plugin)

      // Create plugin context
      const context = this.createPluginContext(plugin, config)

      // Install plugin
      await plugin.install(context)

      // Store plugin
      this.plugins.set(plugin.id, plugin)
      this.pluginStates.set(plugin.id, PluginState.INSTALLED)
      this.pluginConfigs.set(plugin.id, config)

      // Register plugin components
      this.registerPluginComponents(plugin)

      // Emit event
      this.eventBus.emit(
        CommonEventType.PLUGIN_LOADED,
        { plugin: this.getPluginMetadata(plugin) },
        'PluginManager'
      )

      this.logger.info(`Plugin ${plugin.name} installed successfully`)
    } catch (error) {
      this.pluginStates.set(plugin.id, PluginState.ERROR)
      this.eventBus.emit(
        CommonEventType.PLUGIN_ERROR,
        { plugin: plugin.id, error },
        'PluginManager'
      )
      throw error
    }
  }

  async uninstall(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    try {
      // Deactivate if active
      if (this.isActive(pluginId)) {
        await this.deactivate(pluginId)
      }

      // Uninstall plugin
      await plugin.uninstall()

      // Unregister components
      this.unregisterPluginComponents(plugin)

      // Remove plugin
      this.plugins.delete(pluginId)
      this.pluginStates.delete(pluginId)
      this.pluginConfigs.delete(pluginId)

      this.logger.info(`Plugin ${plugin.name} uninstalled successfully`)
    } catch (error) {
      this.eventBus.emit(CommonEventType.PLUGIN_ERROR, { plugin: pluginId, error }, 'PluginManager')
      throw error
    }
  }

  async activate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    const state = this.pluginStates.get(pluginId)
    if (state === PluginState.ACTIVE) {
      throw new Error(`Plugin ${pluginId} is already active`)
    }

    try {
      await plugin.activate()
      this.pluginStates.set(pluginId, PluginState.ACTIVE)

      this.eventBus.emit(
        CommonEventType.PLUGIN_ACTIVATED,
        { plugin: this.getPluginMetadata(plugin) },
        'PluginManager'
      )

      this.logger.info(`Plugin ${plugin.name} activated successfully`)
    } catch (error) {
      this.pluginStates.set(pluginId, PluginState.ERROR)
      this.eventBus.emit(CommonEventType.PLUGIN_ERROR, { plugin: pluginId, error }, 'PluginManager')
      throw error
    }
  }

  async deactivate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    const state = this.pluginStates.get(pluginId)
    if (state !== PluginState.ACTIVE) {
      throw new Error(`Plugin ${pluginId} is not active`)
    }

    try {
      await plugin.deactivate()
      this.pluginStates.set(pluginId, PluginState.INACTIVE)

      this.eventBus.emit(
        CommonEventType.PLUGIN_DEACTIVATED,
        { plugin: this.getPluginMetadata(plugin) },
        'PluginManager'
      )

      this.logger.info(`Plugin ${plugin.name} deactivated successfully`)
    } catch (error) {
      this.pluginStates.set(pluginId, PluginState.ERROR)
      this.eventBus.emit(CommonEventType.PLUGIN_ERROR, { plugin: pluginId, error }, 'PluginManager')
      throw error
    }
  }

  get(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId)
  }

  getAll(): Plugin[] {
    return Array.from(this.plugins.values())
  }

  getActive(): Plugin[] {
    return this.getAll().filter(plugin => this.pluginStates.get(plugin.id) === PluginState.ACTIVE)
  }

  isActive(pluginId: string): boolean {
    return this.pluginStates.get(pluginId) === PluginState.ACTIVE
  }

  async updateConfig(pluginId: string, config: Record<string, unknown>): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`)
    }

    const oldConfig = this.pluginConfigs.get(pluginId) || {}
    this.pluginConfigs.set(pluginId, config)

    // Notify plugin of config change
    if (plugin.hooks?.onConfigChange) {
      await plugin.hooks.onConfigChange(config, oldConfig)
    }

    this.logger.info(`Plugin ${plugin.name} configuration updated`)
  }

  async loadFromDirectory(_directory: string): Promise<void> {
    // This would be implemented to scan directory for plugins
    throw new Error('Not implemented')
  }

  async loadFromPackage(_packageName: string): Promise<void> {
    // This would be implemented to load plugin from npm package
    throw new Error('Not implemented')
  }

  registerCommand(command: PluginCommand): void {
    if (this.commands.has(command.name)) {
      throw new Error(`Command ${command.name} already registered`)
    }
    this.commands.set(command.name, command)

    // Also register aliases
    command.aliases?.forEach(alias => {
      this.commands.set(alias, command)
    })
  }

  registerMiddleware(middleware: PluginMiddleware): void {
    this.middleware.push(middleware)
    // Sort by priority
    this.middleware.sort((a, b) => (a.priority || 0) - (b.priority || 0))
  }

  getCommands(): PluginCommand[] {
    return Array.from(new Set(this.commands.values()))
  }

  getMiddleware(): PluginMiddleware[] {
    return this.middleware
  }

  registerConnector(connector: Connector): void {
    this.connectorRegistry.set(connector.id, connector)
  }

  getConnector(id: string): Connector | undefined {
    return this.connectorRegistry.get(id)
  }

  registerService(id: string, service: unknown): void {
    this.services.set(id, service)
  }

  getService(id: string): unknown {
    return this.services.get(id)
  }

  private createPluginContext(plugin: Plugin, config: Record<string, unknown>): PluginContext {
    return {
      manager: this,
      eventBus: this.eventBus.scope(`plugin:${plugin.id}`) as unknown as EventBus,
      config,
      dataDir: `${this.dataDir}/${plugin.id}`,
      logger: this.createPluginLogger(plugin),
      storage: this.storageFactory(plugin.id),
      commands: new Map(),
      getPlugin: (id: string) => this.get(id),
      getConnector: (id: string) => this.getConnector(id),
      registerService: (id: string, service: unknown) =>
        this.registerService(`${plugin.id}:${id}`, service),
      getService: (id: string) => this.getService(id)
    }
  }

  private createPluginLogger(plugin: Plugin): Logger {
    const prefix = `[${plugin.name}]`
    return {
      debug: (message: string, metadata?: Record<string, unknown>) =>
        this.logger.debug(`${prefix} ${message}`, metadata),
      info: (message: string, metadata?: Record<string, unknown>) =>
        this.logger.info(`${prefix} ${message}`, metadata),
      warn: (message: string, metadata?: Record<string, unknown>) =>
        this.logger.warn(`${prefix} ${message}`, metadata),
      error: (message: string, metadata?: Record<string, unknown>) =>
        this.logger.error(`${prefix} ${message}`, metadata)
    }
  }

  /**
   * Load all plugins from the configured directory
   */
  async loadPlugins(pluginDir?: string): Promise<void> {
    const dir = pluginDir || this.dataDir

    try {
      // In production, plugins would be loaded from a directory or registry
      // For now, we'll emit an event that plugins are loaded
      this.logger.info(`Loading plugins from ${dir}`)

      // Emit event that plugin loading started
      this.eventBus.emit(
        CommonEventType.PLUGIN_LOADED,
        { message: 'Plugin loading started' },
        'PluginManager'
      )

      // In a real implementation, we would:
      // 1. Scan the plugin directory
      // 2. Load plugin manifests
      // 3. Validate and install each plugin
      // 4. Handle dependencies

      this.logger.info('Plugin loading completed')
    } catch (error) {
      this.logger.error('Failed to load plugins', error as Record<string, unknown>)
      this.eventBus.emit(
        CommonEventType.PLUGIN_ERROR,
        { error: error instanceof Error ? error.message : String(error) },
        'PluginManager'
      )
    }
  }

  private async validateDependencies(plugin: Plugin): Promise<void> {
    if (!plugin.dependencies) return

    for (const dep of plugin.dependencies) {
      const depPlugin = this.plugins.get(dep.id)
      if (!depPlugin && !dep.optional) {
        throw new Error(`Required dependency ${dep.id} not found for plugin ${plugin.id}`)
      }

      // Validate version requirements
      if (depPlugin && dep.version) {
        const installedVersion = depPlugin.version
        if (!this.isVersionCompatible(installedVersion, dep.version)) {
          throw new Error(
            `Plugin ${plugin.id} requires ${dep.id}@${dep.version}, but ${installedVersion} is installed`
          )
        }
      }
    }
  }

  /**
   * Check if installed version satisfies the required version
   */
  private isVersionCompatible(installed: string, required: string): boolean {
    // Simple version comparison - in production, use semver
    // For now, just check if versions match exactly or if no specific version is required
    if (required === '*' || required === 'latest') {
      return true
    }
    return installed === required
  }

  private registerPluginComponents(plugin: Plugin): void {
    // Register commands
    const commands = plugin.getCommands?.() || []
    commands.forEach(cmd => this.registerCommand(cmd))

    // Register middleware
    const middleware = plugin.getMiddleware?.() || []
    middleware.forEach(mw => this.registerMiddleware(mw))

    // Register connectors
    const connectors = plugin.getConnectors?.() || []
    connectors.forEach(conn => this.registerConnector(conn))
  }

  private unregisterPluginComponents(plugin: Plugin): void {
    // Unregister commands
    const commands = plugin.getCommands?.() || []
    commands.forEach(cmd => {
      this.commands.delete(cmd.name)
      cmd.aliases?.forEach(alias => this.commands.delete(alias))
    })

    // Unregister middleware
    const pluginMiddleware = plugin.getMiddleware?.() || []
    this.middleware = this.middleware.filter(
      mw => !pluginMiddleware.some(pmw => pmw.name === mw.name)
    )

    // Unregister connectors
    const connectors = plugin.getConnectors?.() || []
    connectors.forEach(conn => this.connectorRegistry.delete(conn.id))
  }

  private getPluginMetadata(plugin: Plugin): PluginMetadata {
    const source: PluginMetadataSource = {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      author: plugin.author,
      homepage: plugin.homepage,
      state: this.pluginStates.get(plugin.id) || PluginState.INSTALLED,
      installedAt: new Date(), // TODO: Track actual install time
      config: this.pluginConfigs.get(plugin.id)
    }

    return _pluginMetadataMapper.toDomain(source)
  }
}
