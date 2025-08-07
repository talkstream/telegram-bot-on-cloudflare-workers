import type {
  CloudCapabilities,
  CloudConnector,
  Cost,
  DatabaseAdapter,
  DeployConfig,
  DeployResult,
  Deployment,
  DeploymentStatus,
  ListOptions,
  LogEntry,
  LogOptions,
  MetricOptions,
  Metrics,
  QueueAdapter,
  ResourceUsage,
  SecretsAdapter,
  StorageAdapter
} from '../../core/interfaces/cloud.js'
import type { ConnectorCapabilities, ConnectorConfig } from '../../core/interfaces/connector.js'
import { ConnectorType } from '../../core/interfaces/connector.js'

import { BaseConnector } from './base-connector.js'

/**
 * Base implementation for cloud connectors
 */
export abstract class BaseCloudConnector extends BaseConnector implements CloudConnector {
  type = ConnectorType.CLOUD

  protected region?: string
  protected projectId?: string
  protected credentials?: unknown

  /**
   * Deploy application
   */
  async deploy(config: DeployConfig): Promise<DeployResult> {
    // Validate deployment config
    const validation = this.validateDeployConfig(config)
    if (!validation.valid) {
      throw new Error(`Invalid deploy config: ${validation.error}`)
    }

    // Check capabilities
    const capabilities = this.getCloudCapabilities()
    if (!this.isRuntimeSupported(config.runtime.type, capabilities)) {
      throw new Error(`Runtime ${config.runtime.type} not supported`)
    }

    // Execute deployment
    const result = await this.doDeploy(config)

    // Log deployment
    this.emitEvent('cloud:deployment:created', {
      deployment: result,
      config
    })

    return result
  }

  /**
   * Rollback deployment
   */
  async rollback(deploymentId: string): Promise<void> {
    // Get deployment info
    const deployment = await this.getDeploymentInfo(deploymentId)
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`)
    }

    // Execute rollback
    await this.doRollback(deploymentId)

    this.emitEvent('cloud:deployment:rolledback', {
      deploymentId
    })
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus> {
    const deployment = await this.getDeploymentInfo(deploymentId)
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`)
    }

    return deployment.status
  }

  /**
   * List deployments
   */
  async listDeployments(options?: ListOptions): Promise<Deployment[]> {
    return this.doListDeployments(options)
  }

  /**
   * Get logs
   */
  async *getLogs(options?: LogOptions): AsyncGenerator<LogEntry> {
    yield* this.doGetLogs(options)
  }

  /**
   * Get metrics
   */
  async getMetrics(options?: MetricOptions): Promise<Metrics> {
    if (!options) {
      throw new Error('Metric options required')
    }

    return this.doGetMetrics(options)
  }

  /**
   * Estimate costs
   */
  estimateCost(usage: ResourceUsage): Cost {
    const capabilities = this.getCloudCapabilities()
    const pricing = capabilities.pricing

    if (pricing.model === 'pay-per-use') {
      return this.calculatePayPerUseCost(usage)
    }

    // For subscription or hybrid, return base estimate
    return {
      amount: 0,
      currency: 'USD',
      breakdown: {
        compute: 0,
        storage: 0,
        network: 0,
        database: 0
      }
    }
  }

  /**
   * Get base capabilities
   */
  getCapabilities(): ConnectorCapabilities {
    const cloudCaps = this.getCloudCapabilities()
    return {
      features: [
        'deployment',
        'storage',
        'database',
        'secrets',
        'queue',
        'logs',
        'metrics',
        ...cloudCaps.services
      ]
    }
  }

  /**
   * Validate deployment configuration
   */
  protected validateDeployConfig(config: DeployConfig): { valid: boolean; error?: string } {
    if (!config.name) {
      return { valid: false, error: 'Name is required' }
    }

    if (!config.environment) {
      return { valid: false, error: 'Environment is required' }
    }

    if (!config.source) {
      return { valid: false, error: 'Source is required' }
    }

    if (!config.runtime || !config.runtime.type) {
      return { valid: false, error: 'Runtime type is required' }
    }

    const capabilities = this.getCloudCapabilities()

    // Check resource limits
    if (config.resources) {
      const limits = capabilities.limits

      if (
        config.resources.timeout &&
        limits.max_timeout &&
        config.resources.timeout > limits.max_timeout
      ) {
        return { valid: false, error: `Timeout exceeds limit of ${limits.max_timeout}s` }
      }

      if (
        config.env &&
        limits.max_env_vars &&
        Object.keys(config.env).length > limits.max_env_vars
      ) {
        return {
          valid: false,
          error: `Too many environment variables (max: ${limits.max_env_vars})`
        }
      }
    }

    return { valid: true }
  }

  /**
   * Check if runtime is supported
   */
  protected isRuntimeSupported(runtime: string, capabilities: CloudCapabilities): boolean {
    return capabilities.runtimes.some(r => r.name === runtime)
  }

  /**
   * Calculate pay-per-use costs
   */
  protected calculatePayPerUseCost(usage: ResourceUsage): Cost {
    let total = 0
    const breakdown: Record<string, number> = {}

    // Compute costs (example rates)
    if (usage.compute) {
      const computeCost =
        (usage.compute.cpu_hours || 0) * 0.05 +
        (usage.compute.memory_gb_hours || 0) * 0.01 +
        (usage.compute.requests || 0) * 0.0000002
      breakdown.compute = computeCost
      total += computeCost
    }

    // Storage costs
    if (usage.storage) {
      const storageCost =
        (usage.storage.gb_months || 0) * 0.023 +
        ((usage.storage.read_operations || 0) * 0.0004) / 1000 +
        ((usage.storage.write_operations || 0) * 0.005) / 1000
      breakdown.storage = storageCost
      total += storageCost
    }

    // Network costs
    if (usage.network) {
      const networkCost = (usage.network.egress_gb || 0) * 0.09
      breakdown.network = networkCost
      total += networkCost
    }

    // Database costs
    if (usage.database) {
      const dbCost =
        (usage.database.read_units || 0) * 0.00025 +
        (usage.database.write_units || 0) * 0.00125 +
        (usage.database.storage_gb || 0) * 0.25
      breakdown.database = dbCost
      total += dbCost
    }

    return {
      amount: total,
      currency: 'USD',
      breakdown
    }
  }

  /**
   * Initialize cloud connector
   */
  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    this.region = config.region as string | undefined
    this.projectId = config.projectId as string | undefined
    this.credentials = config.credentials

    if (!this.credentials) {
      throw new Error('Cloud credentials required')
    }

    // Validate credentials
    await this.validateCloudCredentials()
  }

  /**
   * Abstract methods for implementations
   */
  protected abstract doDeploy(config: DeployConfig): Promise<DeployResult>
  protected abstract doRollback(deploymentId: string): Promise<void>
  protected abstract getDeploymentInfo(deploymentId: string): Promise<Deployment | null>
  protected abstract doListDeployments(options?: ListOptions): Promise<Deployment[]>
  protected abstract doGetLogs(options?: LogOptions): AsyncGenerator<LogEntry>
  protected abstract doGetMetrics(options: MetricOptions): Promise<Metrics>
  protected abstract validateCloudCredentials(): Promise<void>

  abstract getStorage(): StorageAdapter
  abstract getDatabase(): DatabaseAdapter
  abstract getSecrets(): SecretsAdapter
  abstract getQueue(): QueueAdapter
  abstract getCloudCapabilities(): CloudCapabilities
}
