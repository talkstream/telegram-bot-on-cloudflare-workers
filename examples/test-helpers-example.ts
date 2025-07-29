/**
 * Test Helpers Example
 *
 * This example demonstrates how to use the comprehensive test helpers
 * suite for testing a Cloudflare Workers application.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMockWorkerEnv,
  createMockD1Database,
  createMockKVNamespace,
  createUserFixture,
  FixtureGenerator,
  TestQueryBuilder,
  MockCacheService,
  waitFor,
  retry,
  TestEventEmitter,
} from '../src/test-helpers/index.js';

// Example service to test
class UserService {
  constructor(
    private db: D1Database,
    private kv: KVNamespace,
    private cache: MockCacheService,
  ) {}

  async getUser(id: number) {
    // Try cache first
    const cached = await this.cache.get(`user:${id}`);
    if (cached) return cached;

    // Query database
    const query = new TestQueryBuilder().select('*').from('users').where('id', '=', id).build();

    const result = await this.db
      .prepare(query.sql)
      .bind(...query.params)
      .first();

    if (result) {
      // Cache for 5 minutes
      await this.cache.set(`user:${id}`, result, { ttl: 300, tags: ['users'] });
    }

    return result;
  }

  async createUser(data: { name: string; email: string }) {
    const id = Math.floor(Math.random() * 1000000);

    await this.db
      .prepare('INSERT INTO users (id, name, email) VALUES (?, ?, ?)')
      .bind(id, data.name, data.email)
      .run();

    // Store in KV for quick access
    await this.kv.put(`user:${id}`, JSON.stringify({ id, ...data }));

    // Invalidate cache
    await this.cache.purgeByTags(['users']);

    return { id, ...data };
  }

  async searchUsers(query: string) {
    return await retry(
      async () => {
        const result = await this.db
          .prepare('SELECT * FROM users WHERE name LIKE ?')
          .bind(`%${query}%`)
          .all();

        if (!result.success) throw new Error('Query failed');
        return result.results;
      },
      { maxAttempts: 3, initialDelay: 100 },
    );
  }
}

// Example event-driven system
class NotificationService extends TestEventEmitter<{
  userCreated: [{ id: number; name: string }];
  userDeleted: [number];
  error: [Error];
}> {
  async notifyUserCreated(user: { id: number; name: string }) {
    // Simulate async notification
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.emit('userCreated', user);
  }
}

describe('UserService with Test Helpers', () => {
  let env: ReturnType<typeof createMockWorkerEnv>;
  let userService: UserService;
  let notificationService: NotificationService;
  let cache: MockCacheService;

  beforeEach(() => {
    // Create mock environment
    env = createMockWorkerEnv({
      API_KEY: 'test-api-key',
      RATE_LIMIT: createMockKVNamespace(),
    });

    // Create services
    cache = new MockCacheService();
    userService = new UserService(env.DB!, env.KV!, cache);
    notificationService = new NotificationService();
  });

  afterEach(() => {
    // Clean up
    env.DB!._reset();
    env.KV!._reset();
    cache.resetStats();
    notificationService.removeAllListeners();
    vi.clearAllMocks();
  });

  describe('getUser', () => {
    it('should return user from database', async () => {
      const user = createUserFixture({ id: 123, username: 'alice' });

      env.DB!._setQueryResult(/SELECT.*FROM users.*WHERE id = \?/, user);

      const result = await userService.getUser(123);

      expect(result).toEqual(user);
      expect(env.DB!._queries).toHaveLength(1);
      expect(env.DB!._queries[0].params).toEqual([123]);
    });

    it('should cache user data', async () => {
      const user = createUserFixture({ id: 456 });
      env.DB!._setQueryResult(/SELECT.*FROM users/, user);

      // First call - from database
      await userService.getUser(456);
      expect(cache.getStats().misses).toBe(1);

      // Second call - from cache
      const cached = await userService.getUser(456);
      expect(cached).toEqual(user);
      expect(cache.getStats().hits).toBe(1);
      expect(env.DB!._queries).toHaveLength(1); // Only one DB query
    });

    it('should handle cache expiration', async () => {
      vi.useFakeTimers();

      const user = createUserFixture({ id: 789 });
      env.DB!._setQueryResult(/SELECT.*FROM users/, user);

      // Cache user
      await userService.getUser(789);

      // Advance time past TTL
      vi.advanceTimersByTime(301000); // 301 seconds

      // Should query database again
      await userService.getUser(789);
      expect(env.DB!._queries).toHaveLength(2);

      vi.useRealTimers();
    });
  });

  describe('createUser', () => {
    it('should create user and update caches', async () => {
      const userData = { name: 'Bob', email: 'bob@example.com' };

      env.DB!._setQueryResult(/INSERT/, { success: true });

      const user = await userService.createUser(userData);

      expect(user).toMatchObject(userData);
      expect(user.id).toBeDefined();

      // Check KV was updated
      const kvData = await env.KV!.get(`user:${user.id}`, { type: 'json' });
      expect(kvData).toEqual(user);

      // Check cache was purged
      expect(cache.dump()).toEqual({});
    });

    it('should emit notification on user creation', async () => {
      const userData = { name: 'Charlie', email: 'charlie@example.com' };
      env.DB!._setQueryResult(/INSERT/, { success: true });

      const user = await userService.createUser(userData);

      // Set up listener and notify
      const notificationPromise = notificationService.waitForEvent('userCreated');
      await notificationService.notifyUserCreated(user);

      const [notifiedUser] = await notificationPromise;
      expect(notifiedUser).toEqual(user);

      // Check event history
      const history = notificationService.getEventHistory();
      expect(history).toHaveLength(1);
      expect(history[0].event).toBe('userCreated');
    });
  });

  describe('searchUsers', () => {
    it('should retry on failure', async () => {
      const users = new FixtureGenerator(createUserFixture).createMany(3);
      let attempts = 0;

      env.DB!.prepare = vi.fn().mockImplementation(() => ({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockImplementation(async () => {
          attempts++;
          if (attempts < 2) {
            return { success: false };
          }
          return { success: true, results: users };
        }),
      }));

      const results = await userService.searchUsers('test');

      expect(results).toEqual(users);
      expect(attempts).toBe(2);
    });
  });

  describe('Integration Testing', () => {
    it('should handle complete user flow', async () => {
      // Set up fixtures
      const existingUsers = new FixtureGenerator(createUserFixture).createMany(5);

      env.DB!._setMultipleResults(
        new Map([
          [/SELECT.*FROM users WHERE id = \?/, existingUsers[0]],
          [/SELECT.*FROM users WHERE name LIKE \?/, existingUsers.slice(0, 3)],
          [/INSERT INTO users/, { success: true }],
        ]),
      );

      // Test flow
      const user = await userService.getUser(existingUsers[0].id as number);
      expect(user).toEqual(existingUsers[0]);

      const searchResults = await userService.searchUsers('test');
      expect(searchResults).toHaveLength(3);

      const newUser = await userService.createUser({
        name: 'New User',
        email: 'new@example.com',
      });
      expect(newUser.id).toBeDefined();

      // Verify final state
      expect(cache.getStats().hits).toBeGreaterThan(0);
      expect(env.KV!._size()).toBe(1);
      expect(env.DB!._queries).toHaveLength(3);
    });
  });
});

// Performance testing example
describe('Performance Testing', () => {
  it('should handle concurrent operations', async () => {
    const env = createMockWorkerEnv();
    const cache = new MockCacheService();
    const service = new UserService(env.DB!, env.KV!, cache);

    // Create many users concurrently
    const operations = Array.from({ length: 100 }, (_, i) => async () => {
      return await service.createUser({
        name: `User ${i}`,
        email: `user${i}@example.com`,
      });
    });

    const start = Date.now();
    const results = await Promise.all(operations);
    const duration = Date.now() - start;

    expect(results).toHaveLength(100);
    expect(duration).toBeLessThan(1000); // Should complete within 1 second

    console.log(`Created ${results.length} users in ${duration}ms`);
    console.log(`Average: ${(duration / results.length).toFixed(2)}ms per user`);
  });
});

// Advanced mocking example
describe('Advanced Mocking', () => {
  it('should simulate complex database behavior', async () => {
    const db = createMockD1Database();

    // Simulate pagination
    const allUsers = new FixtureGenerator(createUserFixture).createMany(100);

    db.prepare = vi.fn().mockImplementation((sql: string) => {
      const limitMatch = sql.match(/LIMIT (\d+)/);
      const offsetMatch = sql.match(/OFFSET (\d+)/);

      const limit = limitMatch ? parseInt(limitMatch[1]) : 10;
      const offset = offsetMatch ? parseInt(offsetMatch[1]) : 0;

      return {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: allUsers.slice(offset, offset + limit),
          success: true,
        }),
      };
    });

    // Test pagination
    const page1 = await db.prepare('SELECT * FROM users LIMIT 10 OFFSET 0').all();
    const page2 = await db.prepare('SELECT * FROM users LIMIT 10 OFFSET 10').all();

    expect(page1.results).toHaveLength(10);
    expect(page2.results).toHaveLength(10);
    expect(page1.results[0]).not.toEqual(page2.results[0]);
  });
});
