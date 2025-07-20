import { EventBus, CommonEventType } from '../events/event-bus.js';
import type { Connector } from '../interfaces/connector.js';

import { PluginState } from './plugin.js';
import type {
  Plugin,
  PluginManager as IPluginManager,
  PluginContext,
  PluginCommand,
  PluginMiddleware,
  PluginMetadata,
  Logger,
  PluginStorage,
} from './plugin.js';

export class PluginManager implements IPluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private pluginStates: Map<string, PluginState> = new Map();
  private pluginConfigs: Map<string, Record<string, unknown>> = new Map();
  private commands: Map<string, PluginCommand> = new Map();
  private middleware: PluginMiddleware[] = [];
  private services: Map<string, unknown> = new Map();
  private connectorRegistry: Map<string, Connector> = new Map();

  constructor(
    private eventBus: EventBus,
    private logger: Logger,
    private storageFactory: (pluginId: string) => PluginStorage,
    private dataDir: string,
  ) {}

  async install(plugin: Plugin, config: Record<string, unknown> = {}): Promise<void> {
    try {
      // Check if already installed
      if (this.plugins.has(plugin.id)) {
        throw new Error(`Plugin ${plugin.id} is already installed`);
      }

      // Validate dependencies
      await this.validateDependencies(plugin);

      // Create plugin context
      const context = this.createPluginContext(plugin, config);

      // Install plugin
      await plugin.install(context);

      // Store plugin
      this.plugins.set(plugin.id, plugin);
      this.pluginStates.set(plugin.id, PluginState.INSTALLED);
      this.pluginConfigs.set(plugin.id, config);

      // Register plugin components
      this.registerPluginComponents(plugin);

      // Emit event
      this.eventBus.emit(
        CommonEventType.PLUGIN_LOADED,
        { plugin: this.getPluginMetadata(plugin) },
        'PluginManager',
      );

      this.logger.info(`Plugin ${plugin.name} installed successfully`);
    } catch (error) {
      this.pluginStates.set(plugin.id, PluginState.ERROR);
      this.eventBus.emit(
        CommonEventType.PLUGIN_ERROR,
        { plugin: plugin.id, error },
        'PluginManager',
      );
      throw error;
    }
  }

  async uninstall(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    try {
      // Deactivate if active
      if (this.isActive(pluginId)) {
        await this.deactivate(pluginId);
      }

      // Uninstall plugin
      await plugin.uninstall();

      // Unregister components
      this.unregisterPluginComponents(plugin);

      // Remove plugin
      this.plugins.delete(pluginId);
      this.pluginStates.delete(pluginId);
      this.pluginConfigs.delete(pluginId);

      this.logger.info(`Plugin ${plugin.name} uninstalled successfully`);
    } catch (error) {
      this.eventBus.emit(
        CommonEventType.PLUGIN_ERROR,
        { plugin: pluginId, error },
        'PluginManager',
      );
      throw error;
    }
  }

  async activate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    const state = this.pluginStates.get(pluginId);
    if (state === PluginState.ACTIVE) {
      throw new Error(`Plugin ${pluginId} is already active`);
    }

    try {
      await plugin.activate();
      this.pluginStates.set(pluginId, PluginState.ACTIVE);

      this.eventBus.emit(
        CommonEventType.PLUGIN_ACTIVATED,
        { plugin: this.getPluginMetadata(plugin) },
        'PluginManager',
      );

      this.logger.info(`Plugin ${plugin.name} activated successfully`);
    } catch (error) {
      this.pluginStates.set(pluginId, PluginState.ERROR);
      this.eventBus.emit(
        CommonEventType.PLUGIN_ERROR,
        { plugin: pluginId, error },
        'PluginManager',
      );
      throw error;
    }
  }

  async deactivate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    const state = this.pluginStates.get(pluginId);
    if (state !== PluginState.ACTIVE) {
      throw new Error(`Plugin ${pluginId} is not active`);
    }

    try {
      await plugin.deactivate();
      this.pluginStates.set(pluginId, PluginState.INACTIVE);

      this.eventBus.emit(
        CommonEventType.PLUGIN_DEACTIVATED,
        { plugin: this.getPluginMetadata(plugin) },
        'PluginManager',
      );

      this.logger.info(`Plugin ${plugin.name} deactivated successfully`);
    } catch (error) {
      this.pluginStates.set(pluginId, PluginState.ERROR);
      this.eventBus.emit(
        CommonEventType.PLUGIN_ERROR,
        { plugin: pluginId, error },
        'PluginManager',
      );
      throw error;
    }
  }

  get(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  getAll(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getActive(): Plugin[] {
    return this.getAll().filter(
      (plugin) => this.pluginStates.get(plugin.id) === PluginState.ACTIVE,
    );
  }

  isActive(pluginId: string): boolean {
    return this.pluginStates.get(pluginId) === PluginState.ACTIVE;
  }

  async updateConfig(pluginId: string, config: Record<string, unknown>): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    const oldConfig = this.pluginConfigs.get(pluginId) || {};
    this.pluginConfigs.set(pluginId, config);

    // Notify plugin of config change
    if (plugin.hooks?.onConfigChange) {
      await plugin.hooks.onConfigChange(config, oldConfig);
    }

    this.logger.info(`Plugin ${plugin.name} configuration updated`);
  }

  async loadFromDirectory(_directory: string): Promise<void> {
    // This would be implemented to scan directory for plugins
    throw new Error('Not implemented');
  }

  async loadFromPackage(_packageName: string): Promise<void> {
    // This would be implemented to load plugin from npm package
    throw new Error('Not implemented');
  }

  registerCommand(command: PluginCommand): void {
    if (this.commands.has(command.name)) {
      throw new Error(`Command ${command.name} already registered`);
    }
    this.commands.set(command.name, command);

    // Also register aliases
    command.aliases?.forEach((alias) => {
      this.commands.set(alias, command);
    });
  }

  registerMiddleware(middleware: PluginMiddleware): void {
    this.middleware.push(middleware);
    // Sort by priority
    this.middleware.sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }

  getCommands(): PluginCommand[] {
    return Array.from(new Set(this.commands.values()));
  }

  getMiddleware(): PluginMiddleware[] {
    return this.middleware;
  }

  registerConnector(connector: Connector): void {
    this.connectorRegistry.set(connector.id, connector);
  }

  getConnector(id: string): Connector | undefined {
    return this.connectorRegistry.get(id);
  }

  registerService(id: string, service: unknown): void {
    this.services.set(id, service);
  }

  getService(id: string): unknown {
    return this.services.get(id);
  }

  private createPluginContext(plugin: Plugin, config: Record<string, unknown>): PluginContext {
    return {
      manager: this,
      eventBus: this.eventBus.scope(`plugin:${plugin.id}`) as unknown as EventBus,
      config,
      dataDir: `${this.dataDir}/${plugin.id}`,
      logger: this.createPluginLogger(plugin),
      storage: this.storageFactory(plugin.id),
      getPlugin: (id: string) => this.get(id),
      getConnector: (id: string) => this.getConnector(id),
      registerService: (id: string, service: unknown) =>
        this.registerService(`${plugin.id}:${id}`, service),
      getService: (id: string) => this.getService(id),
    };
  }

  private createPluginLogger(plugin: Plugin): Logger {
    const prefix = `[${plugin.name}]`;
    return {
      debug: (message: string, ...args: unknown[]) =>
        this.logger.debug(`${prefix} ${message}`, ...args),
      info: (message: string, ...args: unknown[]) =>
        this.logger.info(`${prefix} ${message}`, ...args),
      warn: (message: string, ...args: unknown[]) =>
        this.logger.warn(`${prefix} ${message}`, ...args),
      error: (message: string, ...args: unknown[]) =>
        this.logger.error(`${prefix} ${message}`, ...args),
    };
  }

  private async validateDependencies(plugin: Plugin): Promise<void> {
    if (!plugin.dependencies) return;

    for (const dep of plugin.dependencies) {
      const depPlugin = this.plugins.get(dep.id);
      if (!depPlugin && !dep.optional) {
        throw new Error(`Required dependency ${dep.id} not found for plugin ${plugin.id}`);
      }
      // TODO: Validate version requirements
    }
  }

  private registerPluginComponents(plugin: Plugin): void {
    // Register commands
    const commands = plugin.getCommands?.() || [];
    commands.forEach((cmd) => this.registerCommand(cmd));

    // Register middleware
    const middleware = plugin.getMiddleware?.() || [];
    middleware.forEach((mw) => this.registerMiddleware(mw));

    // Register connectors
    const connectors = plugin.getConnectors?.() || [];
    connectors.forEach((conn) => this.registerConnector(conn));
  }

  private unregisterPluginComponents(plugin: Plugin): void {
    // Unregister commands
    const commands = plugin.getCommands?.() || [];
    commands.forEach((cmd) => {
      this.commands.delete(cmd.name);
      cmd.aliases?.forEach((alias) => this.commands.delete(alias));
    });

    // Unregister middleware
    const pluginMiddleware = plugin.getMiddleware?.() || [];
    this.middleware = this.middleware.filter(
      (mw) => !pluginMiddleware.some((pmw) => pmw.name === mw.name),
    );

    // Unregister connectors
    const connectors = plugin.getConnectors?.() || [];
    connectors.forEach((conn) => this.connectorRegistry.delete(conn.id));
  }

  private getPluginMetadata(plugin: Plugin): PluginMetadata {
    return {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      ...(plugin.author && { author: plugin.author }),
      ...(plugin.homepage && { homepage: plugin.homepage }),
      state: this.pluginStates.get(plugin.id) || PluginState.INSTALLED,
      installedAt: new Date(), // TODO: Track actual install time
      config: this.pluginConfigs.get(plugin.id),
    };
  }
}
