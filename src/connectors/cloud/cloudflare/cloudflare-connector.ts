/**
 * Cloudflare Workers platform connector
 * Adapts Cloudflare-specific APIs to our platform-agnostic interfaces
 */

import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types'

import { tierToResourceConstraints } from '../../../config/cloudflare-tiers'
import type {
  ICacheStore,
  ICloudPlatformConnector,
  IDatabaseStore,
  IKeyValueStore,
  IObjectStore,
  ResourceConstraints
} from '../../../core/interfaces'

import { CloudflareCacheStore } from './stores/cache-store'
import { CloudflareDatabaseStore } from './stores/database-store'
import { CloudflareKeyValueStore } from './stores/kv-store'
import { CloudflareObjectStore } from './stores/object-store'

export interface CloudflareConfig {
  env: {
    // KV Namespaces
    CACHE?: KVNamespace
    SESSIONS?: KVNamespace
    RATE_LIMIT?: KVNamespace

    // Databases
    DB?: D1Database

    // Object Storage
    R2?: R2Bucket

    // Cloudflare-specific tier
    TIER?: 'free' | 'paid'

    // Other env vars
    [key: string]: unknown
  }
}

export class CloudflareConnector implements ICloudPlatformConnector {
  readonly platform = 'cloudflare'

  constructor(private config: CloudflareConfig) {}

  getKeyValueStore(namespace: string): IKeyValueStore {
    const kv = this.config.env[namespace] as KVNamespace | undefined
    if (!kv) {
      throw new Error(`KV namespace '${namespace}' not found in environment`)
    }
    return new CloudflareKeyValueStore(kv)
  }

  getDatabaseStore(name: string): IDatabaseStore {
    const db = this.config.env[name] as D1Database | undefined
    if (!db) {
      throw new Error(`Database '${name}' not found in environment`)
    }
    return new CloudflareDatabaseStore(db)
  }

  getObjectStore(bucket: string): IObjectStore {
    const r2 = this.config.env[bucket] as R2Bucket | undefined
    if (!r2) {
      throw new Error(`R2 bucket '${bucket}' not found in environment`)
    }
    return new CloudflareObjectStore(r2)
  }

  getCacheStore(): ICacheStore {
    return new CloudflareCacheStore()
  }

  getEnv(): Record<string, string | undefined> {
    const env: Record<string, string | undefined> = {}
    for (const [key, value] of Object.entries(this.config.env)) {
      if (typeof value === 'string') {
        env[key] = value
      }
    }
    return env
  }

  getFeatures() {
    const tier = this.config.env.TIER || 'free'
    return {
      hasEdgeCache: true,
      hasWebSockets: false, // Workers don't support persistent WebSocket connections
      hasCron: true,
      hasQueues: tier === 'paid', // Only with paid plan
      maxRequestDuration: tier === 'paid' ? 30000 : 10, // 30s paid, 10ms free
      maxMemory: 128 // MB
    }
  }

  getResourceConstraints(): ResourceConstraints {
    // Get tier from environment, default to 'free'
    const tier = this.config.env.TIER || 'free'

    // Use the Cloudflare-specific mapping function
    return tierToResourceConstraints(tier)
  }
}
