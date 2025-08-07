/**
 * AWS DynamoDB-based key-value store (mock implementation)
 */

import type {
  IKeyValueStore,
  KVListOptions,
  KVListResult
} from '../../../../core/interfaces/storage'

export class AWSKeyValueStore implements IKeyValueStore {
  constructor(private tableName: string) {}

  async get<T = string>(key: string): Promise<T | null> {
    // Mock implementation
    console.info(`[AWS KV] Getting key ${key} from table ${this.tableName}`)
    return null
  }

  async getWithMetadata<T = string>(
    key: string
  ): Promise<{
    value: T | null
    metadata: Record<string, unknown> | null
  }> {
    // Mock implementation
    console.info(`[AWS KV] Getting key with metadata ${key} from table ${this.tableName}`)
    return {
      value: null,
      metadata: null
    }
  }

  async put(
    key: string,
    _value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: { expirationTtl?: number; metadata?: Record<string, unknown> }
  ): Promise<void> {
    // Mock implementation
    console.info(`[AWS KV] Putting key ${key} to table ${this.tableName}`, options)
  }

  async delete(key: string): Promise<void> {
    // Mock implementation
    console.info(`[AWS KV] Deleting key ${key} from table ${this.tableName}`)
  }

  async list(options?: KVListOptions): Promise<KVListResult> {
    // Mock implementation
    console.info(`[AWS KV] Listing keys in table ${this.tableName}`, options)
    return {
      keys: [],
      list_complete: true,
      cursor: undefined
    }
  }
}
