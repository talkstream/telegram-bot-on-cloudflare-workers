/**
 * Plugin system for extending functionality
 */

import type { Bot, Plugin } from './interfaces'

export interface PluginOptions {
  name: string
  version: string
  description?: string
  initialize: (bot: Bot) => Promise<void> | void
  dispose?: () => Promise<void> | void
}

/**
 * Create a plugin
 */
export function createPlugin(options: PluginOptions): Plugin {
  return {
    name: options.name,
    version: options.version,
    async initialize(bot: Bot): Promise<void> {
      await Promise.resolve(options.initialize(bot))
    },
    async dispose(): Promise<void> {
      if (options.dispose) {
        await Promise.resolve(options.dispose())
      }
    }
  }
}

/**
 * Plugin manager
 */
export class PluginManager {
  private plugins: Map<string, Plugin> = new Map()
  private initialized: Set<string> = new Set()

  /**
   * Add a plugin
   */
  add(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} already exists`)
    }
    this.plugins.set(plugin.name, plugin)
  }

  /**
   * Remove a plugin
   */
  async remove(name: string): Promise<void> {
    const plugin = this.plugins.get(name)
    if (plugin && this.initialized.has(name)) {
      if (plugin.dispose) {
        await plugin.dispose()
      }
      this.initialized.delete(name)
    }
    this.plugins.delete(name)
  }

  /**
   * Initialize all plugins
   */
  async initializeAll(bot: Bot): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      if (!this.initialized.has(name)) {
        await plugin.initialize(bot)
        this.initialized.add(name)
      }
    }
  }

  /**
   * Dispose all plugins
   */
  async disposeAll(): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      if (this.initialized.has(name)) {
        if (plugin.dispose) {
          await plugin.dispose()
        }
        this.initialized.delete(name)
      }
    }
  }

  /**
   * Get a plugin
   */
  get(name: string): Plugin | undefined {
    return this.plugins.get(name)
  }

  /**
   * Check if plugin exists
   */
  has(name: string): boolean {
    return this.plugins.has(name)
  }

  /**
   * List all plugins
   */
  list(): string[] {
    return Array.from(this.plugins.keys())
  }
}
