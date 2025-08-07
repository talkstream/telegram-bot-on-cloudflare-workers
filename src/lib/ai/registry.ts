import { logger } from '../logger'

import type { AIProvider, ProviderInfo, ProviderRegistry } from './types'

export class AIProviderRegistry implements ProviderRegistry {
  private providers = new Map<string, AIProvider>()
  private defaultProviderId: string | null = null

  register(provider: AIProvider): void {
    if (this.providers.has(provider.id)) {
      logger.warn(`Provider ${provider.id} is already registered. Overwriting.`)
    }

    this.providers.set(provider.id, provider)
    logger.info(`Registered AI provider: ${provider.displayName} (${provider.id})`)

    // Set as default if it's the first provider
    if (this.providers.size === 1) {
      this.defaultProviderId = provider.id
    }
  }

  unregister(id: string): boolean {
    const removed = this.providers.delete(id)
    if (removed) {
      logger.info(`Unregistered AI provider: ${id}`)

      // Clear default if it was the removed provider
      if (this.defaultProviderId === id) {
        this.defaultProviderId =
          this.providers.size > 0 ? (this.providers.keys().next().value ?? null) : null
      }
    }
    return removed
  }

  get(id?: string): AIProvider | null {
    // If no ID provided, return default provider
    if (!id) {
      if (!this.defaultProviderId) {
        logger.warn('No default AI provider set')
        return null
      }
      return this.providers.get(this.defaultProviderId) || null
    }

    return this.providers.get(id) || null
  }

  list(): ProviderInfo[] {
    // eslint-disable-next-line db-mapping/use-field-mapper -- Not a database mapping, just in-memory object transformation
    return Array.from(this.providers.values()).map(provider => ({
      id: provider.id,
      displayName: provider.displayName,
      type: provider.type,
      enabled: true, // All registered providers are considered enabled
      capabilities: provider.getCapabilities()
    }))
  }

  setDefault(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Cannot set default: Provider ${id} is not registered`)
    }

    this.defaultProviderId = id
    logger.info(`Set default AI provider to: ${id}`)
  }

  getDefault(): string | null {
    return this.defaultProviderId
  }

  exists(id: string): boolean {
    return this.providers.has(id)
  }

  // Helper method to get provider health status
  async getProviderHealth(id: string): Promise<boolean> {
    const provider = this.get(id)
    if (!provider) {
      return false
    }

    try {
      const health = await provider.getHealthStatus()
      return health.healthy
    } catch (error) {
      logger.error(`Failed to get health status for provider ${id}:`, error)
      return false
    }
  }

  // Get all healthy providers
  async getHealthyProviders(): Promise<AIProvider[]> {
    const healthyProviders: AIProvider[] = []

    for (const provider of this.providers.values()) {
      try {
        const health = await provider.getHealthStatus()
        if (health.healthy) {
          healthyProviders.push(provider)
        }
      } catch (error) {
        logger.warn(`Provider ${provider.id} health check failed:`, error)
      }
    }

    return healthyProviders
  }

  // Initialize all providers
  async initializeAll(): Promise<void> {
    const initPromises: Promise<void>[] = []

    for (const provider of this.providers.values()) {
      if (provider.initialize) {
        initPromises.push(
          provider.initialize().catch(error => {
            logger.error(`Failed to initialize provider ${provider.id}:`, error)
          })
        )
      }
    }

    await Promise.all(initPromises)
  }

  // Dispose all providers
  async disposeAll(): Promise<void> {
    const disposePromises: Promise<void>[] = []

    for (const provider of this.providers.values()) {
      if (provider.dispose) {
        disposePromises.push(
          provider.dispose().catch(error => {
            logger.error(`Failed to dispose provider ${provider.id}:`, error)
          })
        )
      }
    }

    await Promise.all(disposePromises)
    this.providers.clear()
    this.defaultProviderId = null
  }
}

// Singleton instance
let registryInstance: AIProviderRegistry | null = null

export function getProviderRegistry(): AIProviderRegistry {
  if (!registryInstance) {
    registryInstance = new AIProviderRegistry()
  }
  return registryInstance
}

export function resetProviderRegistry(): void {
  if (registryInstance) {
    registryInstance.disposeAll().catch(error => {
      logger.error('Failed to dispose registry during reset:', error)
    })
  }
  registryInstance = null
}
