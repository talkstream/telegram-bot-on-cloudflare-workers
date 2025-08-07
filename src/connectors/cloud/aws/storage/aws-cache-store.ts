/**
 * AWS ElastiCache/DynamoDB implementation of ICacheStore
 */

import type { ICacheStore } from '../../../../core/interfaces/storage'

export class AWSCacheStore implements ICacheStore {
  private cache: Map<string, { response: Response; expires: number }> = new Map()

  constructor(
    private cacheName: string,
    _useElastiCache: boolean = false
  ) {}

  /**
   * Match request in cache
   */
  async match(request: Request | string): Promise<Response | undefined> {
    const key = typeof request === 'string' ? request : request.url
    const item = this.cache.get(key)

    if (!item) return undefined

    if (item.expires > 0 && item.expires < Date.now()) {
      this.cache.delete(key)
      return undefined
    }

    console.info(`[Mock] Cache MATCH: ${this.cacheName}/${key}`)
    return item.response.clone()
  }

  /**
   * Store response in cache
   */
  async put(request: Request | string, response: Response): Promise<void> {
    const key = typeof request === 'string' ? request : request.url

    // Default TTL: 1 hour
    const ttl = 3600
    const expires = Date.now() + ttl * 1000

    this.cache.set(key, { response: response.clone(), expires })
    console.info(`[Mock] Cache PUT: ${this.cacheName}/${key}, TTL: ${ttl}s`)
  }

  /**
   * Delete from cache
   */
  async delete(request: Request | string): Promise<boolean> {
    const key = typeof request === 'string' ? request : request.url
    const deleted = this.cache.delete(key)
    console.info(`[Mock] Cache DELETE: ${this.cacheName}/${key}`)
    return deleted
  }

  // Legacy methods for compatibility
  async get(key: string): Promise<string | null> {
    const response = await this.match(key)
    if (!response) return null

    return response.text()
  }

  async set(key: string, value: string, _ttl?: number): Promise<void> {
    const response = new Response(value)
    await this.put(key, response)
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key)
    return value !== null
  }

  async clear(): Promise<void> {
    // In a real implementation:
    // await client.flush();

    this.cache.clear()
    console.info(`[Mock] Cache CLEAR: ${this.cacheName}`)
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys())

    if (!pattern) return allKeys

    // Simple pattern matching (real implementation would use Redis patterns)
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    return allKeys.filter(key => regex.test(key))
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    const results: (string | null)[] = []

    for (const key of keys) {
      results.push(await this.get(key))
    }

    return results
  }

  async mset(entries: Array<{ key: string; value: string; ttl?: number }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl)
    }
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key)
    const value = current ? parseInt(current, 10) : 0
    const newValue = value + 1

    await this.set(key, newValue.toString())
    return newValue
  }

  async decr(key: string): Promise<number> {
    const current = await this.get(key)
    const value = current ? parseInt(current, 10) : 0
    const newValue = value - 1

    await this.set(key, newValue.toString())
    return newValue
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    const item = this.cache.get(key)
    if (!item) return false

    item.expires = Date.now() + ttl * 1000
    return true
  }

  async ttl(key: string): Promise<number> {
    const item = this.cache.get(key)
    if (!item || item.expires === 0) return -1

    const remaining = Math.floor((item.expires - Date.now()) / 1000)
    return remaining > 0 ? remaining : -2
  }

  /**
   * AWS-specific: Use DynamoDB for persistent cache
   */
  async persistToDynamoDB(): Promise<void> {
    // In a real implementation:
    // const dynamoClient = new DynamoDBClient({ region: this.region });
    // for (const [key, item] of this.cache.entries()) {
    //   await dynamoClient.send(new PutItemCommand({
    //     TableName: this.cacheName,
    //     Item: {
    //       key: { S: key },
    //       value: { S: item.value },
    //       expires: { N: item.expires.toString() },
    //     },
    //   }));
    // }

    console.info(`[Mock] Persisting ${this.cache.size} items to DynamoDB`)
  }

  /**
   * AWS-specific: Load cache from DynamoDB
   */
  async loadFromDynamoDB(): Promise<void> {
    // In a real implementation:
    // const dynamoClient = new DynamoDBClient({ region: this.region });
    // const response = await dynamoClient.send(new ScanCommand({
    //   TableName: this.cacheName,
    // }));
    //
    // for (const item of response.Items || []) {
    //   this.cache.set(item.key.S!, {
    //     value: item.value.S!,
    //     expires: parseInt(item.expires.N!, 10),
    //   });
    // }

    console.info(`[Mock] Loading cache from DynamoDB`)
  }
}
