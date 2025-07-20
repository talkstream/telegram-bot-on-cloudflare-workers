/**
 * Cloud platform connector interface
 * Allows switching between Cloudflare, AWS, Google Cloud, etc.
 */

import type { IKeyValueStore, IDatabaseStore, IObjectStore, ICacheStore } from './storage';

/**
 * Cloud platform capabilities
 */
export interface ICloudPlatformConnector {
  /**
   * Platform name
   */
  readonly platform: string;

  /**
   * Get key-value storage
   */
  getKeyValueStore(namespace: string): IKeyValueStore;

  /**
   * Get database storage
   */
  getDatabaseStore(name: string): IDatabaseStore;

  /**
   * Get object storage
   */
  getObjectStore(bucket: string): IObjectStore;

  /**
   * Get cache storage
   */
  getCacheStore(): ICacheStore;

  /**
   * Get environment variables
   */
  getEnv(): Record<string, string | undefined>;

  /**
   * Platform-specific features
   */
  getFeatures(): {
    hasEdgeCache: boolean;
    hasWebSockets: boolean;
    hasCron: boolean;
    hasQueues: boolean;
    maxRequestDuration: number; // in milliseconds
    maxMemory: number; // in MB
  };
}

/**
 * Factory for creating platform connectors
 */
export interface ICloudPlatformFactory {
  /**
   * Create connector for specific platform
   */
  create(
    platform: 'cloudflare' | 'aws' | 'gcp' | 'local',
    config: unknown,
  ): ICloudPlatformConnector;
}
