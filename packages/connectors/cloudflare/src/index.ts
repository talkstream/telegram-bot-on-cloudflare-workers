/**
 * @wireframe/connector-cloudflare
 *
 * Cloudflare Workers connector for Wireframe
 */

import type { Connector } from '@wireframe/core'
import { ConnectorType } from '@wireframe/core'

export interface CloudflareConfig {
  kv?: KVNamespace
  d1?: D1Database
  r2?: R2Bucket
  queue?: Queue
  durableObjects?: DurableObjectNamespace
  env?: Record<string, unknown>
}

export class CloudflareConnector implements Connector {
  name = '@wireframe/connector-cloudflare'
  version = '2.0.0-alpha.1'
  type = ConnectorType.CLOUD as ConnectorType

  private config?: CloudflareConfig

  async initialize(config: unknown): Promise<void> {
    this.config = config as CloudflareConfig
  }

  async dispose(): Promise<void> {
    this.config = undefined
  }

  /**
   * KV Storage operations
   */
  get kv() {
    if (!this.config?.kv) {
      throw new Error('KV namespace not configured')
    }

    return {
      get: async (key: string): Promise<string | null> => {
        if (!this.config?.kv) throw new Error('KV not configured')
        return await this.config.kv.get(key)
      },

      getWithMetadata: async <T = unknown>(
        key: string
      ): Promise<{ value: string | null; metadata: T | null }> => {
        if (!this.config?.kv) throw new Error('KV not configured')
        return await this.config.kv.getWithMetadata<T>(key)
      },

      put: async (
        key: string,
        value: string,
        options?: { expirationTtl?: number; metadata?: unknown }
      ): Promise<void> => {
        if (!this.config?.kv) throw new Error('KV not configured')
        await this.config.kv.put(key, value, options)
      },

      delete: async (key: string): Promise<void> => {
        if (!this.config?.kv) throw new Error('KV not configured')
        await this.config.kv.delete(key)
      },

      list: async (options?: {
        prefix?: string
        limit?: number
        cursor?: string
      }): Promise<KVNamespaceListResult<unknown>> => {
        if (!this.config?.kv) throw new Error('KV not configured')
        return await this.config.kv.list(options)
      }
    }
  }

  /**
   * D1 Database operations
   */
  get d1() {
    if (!this.config?.d1) {
      throw new Error('D1 database not configured')
    }

    return {
      prepare: (query: string) => {
        if (!this.config?.d1) throw new Error('D1 not configured')
        return this.config.d1.prepare(query)
      },

      exec: async (query: string): Promise<D1ExecResult> => {
        if (!this.config?.d1) throw new Error('D1 not configured')
        return await this.config.d1.exec(query)
      },

      batch: async <T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> => {
        if (!this.config?.d1) throw new Error('D1 not configured')
        return await this.config.d1.batch<T>(statements)
      },

      dump: async (): Promise<ArrayBuffer> => {
        if (!this.config?.d1) throw new Error('D1 not configured')
        return await this.config.d1.dump()
      }
    }
  }

  /**
   * R2 Storage operations
   */
  get r2() {
    if (!this.config?.r2) {
      throw new Error('R2 bucket not configured')
    }

    return {
      get: async (key: string): Promise<R2ObjectBody | null> => {
        if (!this.config?.r2) throw new Error('R2 not configured')
        return await this.config.r2.get(key)
      },

      put: async (
        key: string,
        value: ReadableStream | ArrayBuffer | string,
        options?: R2PutOptions
      ): Promise<R2Object> => {
        if (!this.config?.r2) throw new Error('R2 not configured')
        return await this.config.r2.put(key, value, options)
      },

      delete: async (key: string): Promise<void> => {
        if (!this.config?.r2) throw new Error('R2 not configured')
        await this.config.r2.delete(key)
      },

      list: async (options?: R2ListOptions): Promise<R2Objects> => {
        if (!this.config?.r2) throw new Error('R2 not configured')
        return await this.config.r2.list(options)
      },

      head: async (key: string): Promise<R2Object | null> => {
        if (!this.config?.r2) throw new Error('R2 not configured')
        return await this.config.r2.head(key)
      }
    }
  }

  /**
   * Queue operations
   */
  get queue() {
    if (!this.config?.queue) {
      throw new Error('Queue not configured')
    }

    return {
      send: async (message: unknown): Promise<void> => {
        if (!this.config?.queue) throw new Error('Queue not configured')
        await this.config.queue.send(message)
      },

      sendBatch: async (
        messages: Array<{ body: unknown; contentType?: string }>
      ): Promise<void> => {
        if (!this.config?.queue) throw new Error('Queue not configured')
        await this.config.queue.sendBatch(messages as MessageSendRequest[])
      }
    }
  }

  /**
   * Get environment variables
   */
  get env(): Record<string, unknown> {
    return this.config?.env || {}
  }

  /**
   * Create a scheduled handler
   */
  createScheduledHandler(handler: (event: ScheduledEvent) => Promise<void>) {
    return {
      scheduled: handler
    }
  }

  /**
   * Create a fetch handler
   */
  createFetchHandler(handler: (request: Request) => Promise<Response>) {
    return {
      fetch: handler
    }
  }
}

// Default export for easy registration
export default new CloudflareConnector()
