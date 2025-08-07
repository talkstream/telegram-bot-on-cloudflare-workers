/**
 * CloudPlatform Singleton Cache
 *
 * Production optimization from Kogotochki bot:
 * - Reduces CloudPlatformFactory calls from 33 to 1 per request
 * - Improves response time by 80%+ (3-5s → ~500ms)
 * - Critical for Cloudflare Workers free tier (10ms CPU limit)
 */

import type { Env } from '../../config/env'
import type { ICloudPlatformConnector } from '../interfaces/cloud-platform'

import { CloudPlatformFactory } from './platform-factory'

// Cache for platform connectors
const connectorCache = new Map<string, ICloudPlatformConnector>()

/**
 * Generate unique cache key based on environment
 */
function getCacheKey(env: Env): string {
  // Create unique key based on platform and environment
  // This ensures different instances for dev/staging/prod
  const platform = env.CLOUD_PLATFORM || 'cloudflare'
  const environment = env.ENVIRONMENT || 'production'
  return `${platform}_${environment}`
}

/**
 * Get cached CloudPlatform connector instance
 *
 * @param env - Environment configuration
 * @returns Cached or new CloudPlatform connector instance
 */
export function getCloudPlatformConnector(env: Env): ICloudPlatformConnector {
  const key = getCacheKey(env)

  // Return cached instance if available
  const cached = connectorCache.get(key)
  if (cached) {
    return cached
  }

  // Create new instance and cache it
  const connector = CloudPlatformFactory.createFromTypedEnv(env)
  connectorCache.set(key, connector)

  return connector
}

/**
 * Clear the connector cache
 * Useful for testing and memory management
 */
export function clearCloudPlatformCache(): void {
  connectorCache.clear()
}

/**
 * Get cache statistics for monitoring
 */
export function getCloudPlatformCacheStats(): {
  size: number
  keys: string[]
} {
  return {
    size: connectorCache.size,
    keys: Array.from(connectorCache.keys())
  }
}
