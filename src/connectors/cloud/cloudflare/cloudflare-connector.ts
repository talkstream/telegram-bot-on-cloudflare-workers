/**
 * Cloudflare Workers platform connector
 * Adapts Cloudflare-specific APIs to our platform-agnostic interfaces
 */

import type { KVNamespace, D1Database, R2Bucket } from '@cloudflare/workers-types';

import type {
  ICloudPlatformConnector,
  IKeyValueStore,
  IDatabaseStore,
  IObjectStore,
  ICacheStore,
} from '../../../core/interfaces';

import { CloudflareKeyValueStore } from './stores/kv-store';
import { CloudflareDatabaseStore } from './stores/database-store';
import { CloudflareObjectStore } from './stores/object-store';
import { CloudflareCacheStore } from './stores/cache-store';

export interface CloudflareConfig {
  env: {
    // KV Namespaces
    CACHE?: KVNamespace;
    SESSIONS?: KVNamespace;
    RATE_LIMIT?: KVNamespace;

    // Databases
    DB?: D1Database;

    // Object Storage
    R2?: R2Bucket;

    // Other env vars
    [key: string]: unknown;
  };
}

export class CloudflareConnector implements ICloudPlatformConnector {
  readonly platform = 'cloudflare';

  constructor(private config: CloudflareConfig) {}

  getKeyValueStore(namespace: string): IKeyValueStore {
    const kv = this.config.env[namespace] as KVNamespace | undefined;
    if (!kv) {
      throw new Error(`KV namespace '${namespace}' not found in environment`);
    }
    return new CloudflareKeyValueStore(kv);
  }

  getDatabaseStore(name: string): IDatabaseStore {
    const db = this.config.env[name] as D1Database | undefined;
    if (!db) {
      throw new Error(`Database '${name}' not found in environment`);
    }
    return new CloudflareDatabaseStore(db);
  }

  getObjectStore(bucket: string): IObjectStore {
    const r2 = this.config.env[bucket] as R2Bucket | undefined;
    if (!r2) {
      throw new Error(`R2 bucket '${bucket}' not found in environment`);
    }
    return new CloudflareObjectStore(r2);
  }

  getCacheStore(): ICacheStore {
    return new CloudflareCacheStore();
  }

  getEnv(): Record<string, string | undefined> {
    const env: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(this.config.env)) {
      if (typeof value === 'string') {
        env[key] = value;
      }
    }
    return env;
  }

  getFeatures() {
    return {
      hasEdgeCache: true,
      hasWebSockets: false, // Workers don't support persistent WebSocket connections
      hasCron: true,
      hasQueues: true, // With paid plan
      maxRequestDuration: this.config.env.TIER === 'paid' ? 30000 : 10, // 30s paid, 10ms free
      maxMemory: 128, // MB
    };
  }
}
