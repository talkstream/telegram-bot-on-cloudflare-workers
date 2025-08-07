/**
 * Cloudflare KV implementation of IKeyValueStore
 */

import type { KVNamespace } from '@cloudflare/workers-types'

import type { IKeyValueStore } from '../../../../core/interfaces/storage'

export class CloudflareKeyValueStore implements IKeyValueStore {
  constructor(private kv: KVNamespace) {}

  async get<T = string>(key: string): Promise<T | null> {
    const value = await this.kv.get(key)
    if (value === null) return null

    // Try to parse as JSON, fall back to raw value
    try {
      return JSON.parse(value) as T
    } catch {
      return value as T
    }
  }

  async getWithMetadata<T = string>(
    key: string
  ): Promise<{
    value: T | null
    metadata: Record<string, unknown> | null
  }> {
    const result = await this.kv.getWithMetadata(key)
    if (result.value === null) {
      return { value: null, metadata: null }
    }

    // Try to parse value as JSON
    let value: T
    try {
      value = JSON.parse(result.value as string) as T
    } catch {
      value = result.value as T
    }

    return {
      value,
      metadata: result.metadata as Record<string, unknown> | null
    }
  }

  async put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: {
      expirationTtl?: number
      metadata?: Record<string, unknown>
    }
  ): Promise<void> {
    // If value is an object, stringify it
    let finalValue = value
    if (
      typeof value === 'object' &&
      !(value instanceof ArrayBuffer) &&
      !(value instanceof ReadableStream) &&
      !ArrayBuffer.isView(value)
    ) {
      finalValue = JSON.stringify(value)
    }

    await this.kv.put(key, finalValue, {
      expirationTtl: options?.expirationTtl,
      metadata: options?.metadata
    })
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key)
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string; metadata?: Record<string, unknown> }>
    list_complete: boolean
    cursor?: string
  }> {
    const result = await this.kv.list({
      prefix: options?.prefix,
      limit: options?.limit,
      cursor: options?.cursor
    })

    return {
      keys: result.keys.map(key => ({
        name: key.name,
        metadata: key.metadata as Record<string, unknown> | undefined
      })),
      list_complete: result.list_complete,
      cursor: 'cursor' in result ? result.cursor : undefined
    }
  }
}
