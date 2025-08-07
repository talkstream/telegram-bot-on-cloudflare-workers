/**
 * Example: Cached User Service
 *
 * Shows how to add caching to existing services
 * without modifying the original implementation
 */

import type { IDatabaseStore, IKeyValueStore } from '@/core/interfaces/storage'
import type { IRepository } from '../cached-service'
import { CachedRepository } from '../cached-service'
import { KVCache, getMediumTTL } from '../kv-cache'

// Example User type - in real app, import from domain
interface User {
  id: number
  telegram_id: number
  username?: string
  has_access: boolean
  created_at?: Date
}

/**
 * Original UserService (example)
 */
export class UserService {
  constructor(private db: IDatabaseStore) {}

  async getUserByTelegramId(telegramId: number): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE telegram_id = ?')
      .bind(telegramId)
      .first<User>()
    return result || null
  }

  async updateUser(telegramId: number, data: Partial<User>): Promise<void> {
    const fields = Object.keys(data)
      .map(key => `${key} = ?`)
      .join(', ')
    const values = Object.values(data)

    await this.db
      .prepare(`UPDATE users SET ${fields} WHERE telegram_id = ?`)
      .bind(...values, telegramId)
      .run()
  }

  async createUser(data: Omit<User, 'id'>): Promise<User> {
    const result = await this.db
      .prepare('INSERT INTO users (telegram_id, username, has_access) VALUES (?, ?, ?) RETURNING *')
      .bind(data.telegram_id, data.username, data.has_access)
      .first<User>()

    if (!result) {
      throw new Error('Failed to create user')
    }

    return result
  }
}

/**
 * Cached version of UserService
 */
export class CachedUserService extends UserService {
  constructor(
    db: IDatabaseStore,
    private cache: KVCache
  ) {
    super(db)
  }

  override async getUserByTelegramId(telegramId: number): Promise<User | null> {
    return this.cache.getOrSet(
      `user:telegram:${telegramId}`,
      () => super.getUserByTelegramId(telegramId),
      {
        ttl: getMediumTTL(30), // Cache for 30 minutes
        namespace: 'users'
      }
    )
  }

  override async updateUser(telegramId: number, data: Partial<User>): Promise<void> {
    await super.updateUser(telegramId, data)
    // Invalidate cache after update
    await this.cache.delete(`user:telegram:${telegramId}`, 'users')
  }

  override async createUser(data: Omit<User, 'id'>): Promise<User> {
    const user = await super.createUser(data)
    // Pre-populate cache with new user
    await this.cache.set(`user:telegram:${user.telegram_id}`, user, {
      ttl: getMediumTTL(30),
      namespace: 'users'
    })
    return user
  }

  /**
   * Additional method to warm up cache
   */
  async warmUpCache(telegramIds: number[]): Promise<void> {
    const promises = telegramIds.map(id => this.getUserByTelegramId(id))
    await Promise.all(promises)
  }

  /**
   * Clear user cache
   */
  async clearUserCache(telegramId: number): Promise<void> {
    await this.cache.delete(`user:telegram:${telegramId}`, 'users')
  }
}

/**
 * Alternative: Repository adapter for UserService
 */
class UserServiceRepositoryAdapter implements IRepository<User, number> {
  constructor(private userService: UserService) {}

  async getById(id: number): Promise<User | null> {
    return this.userService.getUserByTelegramId(id)
  }

  async update(id: number, data: Partial<User>): Promise<void> {
    await this.userService.updateUser(id, data)
  }

  async delete(_id: number): Promise<void> {
    // Implement delete if needed
    throw new Error('Delete not implemented')
  }

  async create(data: Omit<User, 'id'>): Promise<User> {
    return this.userService.createUser(data as User)
  }
}

/**
 * Alternative: Using CachedRepository base class
 */
export class CachedUserRepository extends CachedRepository<User, number> {
  constructor(userService: UserService, cache: KVCache) {
    const adapter = new UserServiceRepositoryAdapter(userService)
    super(adapter, cache, {
      namespace: 'users',
      ttl: getMediumTTL(30),
      keyPrefix: 'user:telegram'
    })
  }

  async getUserByTelegramId(telegramId: number): Promise<User | null> {
    return this.getById(telegramId)
  }

  async updateUser(telegramId: number, data: Partial<User>): Promise<void> {
    return this.update(telegramId, data)
  }
}

/**
 * Factory function to create cached user service
 */
export function createCachedUserService(db: IDatabaseStore, kv: IKeyValueStore): CachedUserService {
  const cache = new KVCache(kv, {
    ttl: getMediumTTL(30),
    namespace: 'users'
  })

  return new CachedUserService(db, cache)
}
