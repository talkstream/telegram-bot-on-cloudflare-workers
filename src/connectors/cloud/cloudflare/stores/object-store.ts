/**
 * Cloudflare R2 implementation of IObjectStore
 */

import type { R2Bucket } from '@cloudflare/workers-types';

import type { IObjectStore } from '../../../../core/interfaces/storage';

export class CloudflareObjectStore implements IObjectStore {
  constructor(private r2: R2Bucket) {}

  async put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: {
      httpMetadata?: Record<string, string>;
      customMetadata?: Record<string, string>;
    },
  ): Promise<void> {
    await this.r2.put(key, value, {
      httpMetadata: options?.httpMetadata,
      customMetadata: options?.customMetadata,
    });
  }

  async get(key: string): Promise<{
    body: ReadableStream;
    httpMetadata?: Record<string, string>;
    customMetadata?: Record<string, string>;
  } | null> {
    const object = await this.r2.get(key);
    if (!object) return null;

    return {
      body: object.body,
      httpMetadata: object.httpMetadata as Record<string, string> | undefined,
      customMetadata: object.customMetadata,
    };
  }

  async head(key: string): Promise<{
    httpMetadata?: Record<string, string>;
    customMetadata?: Record<string, string>;
  } | null> {
    const object = await this.r2.head(key);
    if (!object) return null;

    return {
      httpMetadata: object.httpMetadata as Record<string, string> | undefined,
      customMetadata: object.customMetadata,
    };
  }

  async delete(key: string): Promise<void> {
    await this.r2.delete(key);
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    objects: Array<{
      key: string;
      size: number;
      uploaded: Date;
    }>;
    truncated: boolean;
    cursor?: string;
  }> {
    const result = await this.r2.list({
      prefix: options?.prefix,
      limit: options?.limit,
      cursor: options?.cursor,
    });

    return {
      objects: result.objects.map((obj) => ({
        key: obj.key,
        size: obj.size,
        uploaded: new Date(obj.uploaded),
      })),
      truncated: result.truncated,
      cursor: 'cursor' in result ? result.cursor : undefined,
    };
  }
}
