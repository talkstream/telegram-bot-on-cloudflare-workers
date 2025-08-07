/**
 * Factory for creating cloud platform connectors
 */

import { CloudflareConnector } from '../../connectors/cloud/cloudflare'
import type { ICloudPlatformConnector } from '../interfaces/cloud-platform'

export type CloudPlatform = 'cloudflare' | 'aws' | 'gcp' | 'azure' | 'local'

export interface CloudPlatformConfig {
  platform: CloudPlatform
  env: Record<string, unknown>
}

/**
 * Registry of available cloud platform connectors
 */
class CloudPlatformRegistry {
  private connectors = new Map<
    CloudPlatform,
    new (config: { env: Record<string, unknown> }) => ICloudPlatformConnector
  >()

  /**
   * Register a cloud platform connector
   */
  register<T extends { env: Record<string, unknown> }>(
    platform: CloudPlatform,
    ConnectorClass: new (config: T) => ICloudPlatformConnector
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.connectors.set(platform, ConnectorClass as any)
  }

  /**
   * Get connector class for platform
   */
  get(
    platform: CloudPlatform
  ): (new (config: { env: Record<string, unknown> }) => ICloudPlatformConnector) | undefined {
    return this.connectors.get(platform)
  }

  /**
   * Check if platform is registered
   */
  has(platform: CloudPlatform): boolean {
    return this.connectors.has(platform)
  }

  /**
   * Get list of registered platforms
   */
  list(): CloudPlatform[] {
    return Array.from(this.connectors.keys())
  }
}

// Global registry instance
export const cloudPlatformRegistry = new CloudPlatformRegistry()

/**
 * Factory for creating cloud platform connectors
 */
export class CloudPlatformFactory {
  /**
   * Create a cloud platform connector
   */
  static create(config: CloudPlatformConfig): ICloudPlatformConnector {
    const { platform, env } = config

    const ConnectorClass = cloudPlatformRegistry.get(platform)
    if (!ConnectorClass) {
      throw new Error(
        `Cloud platform '${platform}' is not registered. ` +
          `Available platforms: ${cloudPlatformRegistry.list().join(', ')}`
      )
    }

    return new ConnectorClass({ env })
  }

  /**
   * Create from environment
   */
  static createFromEnv(env: Record<string, unknown>): ICloudPlatformConnector {
    const platform = (env.CLOUD_PLATFORM as CloudPlatform) || 'cloudflare'
    return this.create({ platform, env })
  }

  /**
   * Create from typed environment
   */
  static createFromTypedEnv<T extends Record<string, unknown>>(env: T): ICloudPlatformConnector {
    const platform = (env.CLOUD_PLATFORM as CloudPlatform) || 'cloudflare'
    return this.create({ platform, env: env as Record<string, unknown> })
  }
}

// Register Cloudflare connector by default
cloudPlatformRegistry.register('cloudflare', CloudflareConnector)
