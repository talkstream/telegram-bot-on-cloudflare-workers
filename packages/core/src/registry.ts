/**
 * Package Registry for dynamic loading
 */

import type { Connector, Plugin } from './interfaces'

export interface PackageInfo {
  name: string
  version: string
  type: 'connector' | 'plugin'
  description?: string
  author?: string
  license?: string
}

export class Registry {
  // Removed unused packages map
  private instances: Map<string, Connector | Plugin> = new Map()
  private loaders: Map<string, () => Promise<unknown>> = new Map()

  /**
   * Register a package loader
   */
  register(name: string, loader: () => Promise<unknown>): void {
    this.loaders.set(name, loader)
  }

  /**
   * Load a package dynamically
   */
  async load(name: string): Promise<Connector | Plugin> {
    // Check if already loaded
    const existing = this.instances.get(name)
    if (existing) {
      return existing
    }

    // Try to load from registered loaders
    const loader = this.loaders.get(name)
    if (loader) {
      const module = await loader()
      const instance = ((module as { default?: Connector | Plugin }).default || module) as Connector | Plugin
      this.instances.set(name, instance)
      return instance
    }

    // Try to load from npm package
    try {
      const packageName = name.startsWith('@wireframe/') ? name : `@wireframe/${name}`
      const module = await import(packageName)
      const instance = module.default || module
      this.instances.set(name, instance)
      return instance
    } catch (_error) {
      throw new Error(`Failed to load package: ${name}`)
    }
  }

  /**
   * Get loaded instance
   */
  get(name: string): Connector | Plugin | undefined {
    return this.instances.get(name)
  }

  /**
   * Check if package is loaded
   */
  has(name: string): boolean {
    return this.instances.has(name)
  }

  /**
   * Unload a package
   */
  async unload(name: string): Promise<void> {
    const instance = this.instances.get(name)
    if (instance && 'dispose' in instance && typeof instance.dispose === 'function') {
      await instance.dispose()
    }
    this.instances.delete(name)
  }

  /**
   * List all loaded packages
   */
  list(): string[] {
    return Array.from(this.instances.keys())
  }

  /**
   * Clear all packages
   */
  async clear(): Promise<void> {
    for (const name of this.instances.keys()) {
      await this.unload(name)
    }
  }
}
