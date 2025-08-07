/**
 * Cloudflare Cache API implementation of ICacheStore
 */

import type { ICacheStore } from '../../../../core/interfaces/storage'

export class CloudflareCacheStore implements ICacheStore {
  private cache = caches.default

  async match(request: Request | string): Promise<Response | undefined> {
    return await this.cache.match(request)
  }

  async put(request: Request | string, response: Response): Promise<void> {
    await this.cache.put(request, response)
  }

  async delete(request: Request | string): Promise<boolean> {
    return await this.cache.delete(request)
  }
}
