import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createMockD1Database, createD1Result, SQLMatcher } from '../database/d1-helpers.js';
import {
  TestQueryBuilder,
  createInsertQuery,
  createUpdateQuery,
} from '../database/query-builder.js';
import { createUserFixture, FixtureGenerator, TestDatabaseSeeder } from '../database/fixtures.js';
import { createMockKVNamespace, KVTestUtils } from '../storage/kv-helpers.js';
import { MockCacheService, CacheTestUtils } from '../storage/cache-helpers.js';
import {
  createMockWorkerEnv,
  createMockExecutionContext,
  EnvTestUtils,
} from '../platform/env-helpers.js';
import {
  waitFor,
  retry,
  parallelLimit,
  TestEventEmitter,
  AsyncQueue,
} from '../utils/async-helpers.js';

describe('Test Helpers Suite', () => {
  describe('D1 Database Helpers', () => {
    let mockDb: ReturnType<typeof createMockD1Database>;

    beforeEach(() => {
      mockDb = createMockD1Database();
    });

    it('should track queries', async () => {
      await mockDb.prepare('SELECT * FROM users').all();
      await mockDb.prepare('INSERT INTO users (name) VALUES (?)').bind('John').run();

      expect(mockDb._queries).toHaveLength(2);
      expect(mockDb._queries[0].sql).toBe('SELECT * FROM users');
      expect(mockDb._queries[0].params).toBeUndefined();
      expect(mockDb._queries[1].sql).toBe('INSERT INTO users (name) VALUES (?)');
      expect(mockDb._queries[1].params).toEqual(['John']);
    });

    it('should return configured results', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      mockDb._setQueryResult('SELECT * FROM users', users);

      const result = await mockDb.prepare('SELECT * FROM users').all();
      expect(result.results).toEqual(users);
    });

    it('should support regex patterns', async () => {
      const matcher = new SQLMatcher();
      matcher.when(/SELECT.*FROM users WHERE id = \?/).thenReturn({ id: 1, name: 'Test' });

      mockDb._setQueryResult(
        /SELECT.*FROM users/,
        matcher.match('SELECT * FROM users WHERE id = ?'),
      );

      const result = await mockDb.prepare('SELECT * FROM users WHERE id = ?').bind(1).first();
      expect(result).toEqual({ id: 1, name: 'Test' });
    });

    it('should create proper result objects', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const result = createD1Result(data, { duration: 0.5, rowsRead: 2 });

      expect(result.results).toEqual(data);
      expect(result.meta.duration).toBe(0.5);
      expect(result.meta.rows_read).toBe(2);
    });
  });

  describe('Query Builder', () => {
    it('should build SELECT queries', () => {
      const query = new TestQueryBuilder()
        .select('id', 'name')
        .from('users')
        .where('active', '=', true)
        .orderBy('created_at', 'DESC')
        .limit(10)
        .build();

      expect(query.sql).toBe(
        'SELECT id, name FROM users WHERE active = ? ORDER BY created_at DESC LIMIT 10',
      );
      expect(query.params).toEqual([true]);
    });

    it('should build INSERT queries', () => {
      const query = createInsertQuery('users', {
        name: 'John',
        email: 'john@example.com',
        active: true,
      });

      expect(query.sql).toBe('INSERT INTO users (name, email, active) VALUES (?, ?, ?)');
      expect(query.params).toEqual(['John', 'john@example.com', true]);
    });

    it('should build UPDATE queries', () => {
      const query = createUpdateQuery('users', { name: 'Jane', updated_at: new Date() }, { id: 1 });

      expect(query.sql).toMatch(/UPDATE users SET name = \?, updated_at = \? WHERE id = \?/);
      expect(query.params[0]).toBe('Jane');
      expect(query.params[2]).toBe(1);
    });
  });

  describe('Fixtures', () => {
    it('should create user fixtures', () => {
      const user = createUserFixture({
        username: 'testuser',
        role: 'admin',
      });

      expect(user.username).toBe('testuser');
      expect(user.role).toBe('admin');
      expect(user.telegramId).toBeDefined();
      expect(user.createdAt).toBeDefined();
    });

    it('should generate multiple fixtures', () => {
      const generator = new FixtureGenerator(createUserFixture);
      const users = generator.createMany(5, (index) => ({
        username: `user${index}`,
      }));

      expect(users).toHaveLength(5);
      expect(users[0].username).toBe('user0');
      expect(users[4].username).toBe('user4');
    });

    it('should create database seeder SQL', () => {
      const seeder = new TestDatabaseSeeder();
      const users = [
        createUserFixture({ id: 1, username: 'alice' }),
        createUserFixture({ id: 2, username: 'bob' }),
      ];

      seeder.add('users', users);
      const sql = seeder.generateSQL();

      expect(sql).toHaveLength(2);
      expect(sql[0]).toContain('INSERT INTO users');
      expect(sql[0]).toContain('alice');
    });
  });

  describe('KV Storage Helpers', () => {
    let mockKV: ReturnType<typeof createMockKVNamespace>;

    beforeEach(() => {
      mockKV = createMockKVNamespace();
    });

    it('should store and retrieve values', async () => {
      await mockKV.put('key1', 'value1');
      const value = await mockKV.get('key1');

      expect(value).toBe('value1');
      expect(mockKV._size()).toBe(1);
    });

    it('should handle JSON values', async () => {
      const data = { name: 'Test', count: 42 };
      await mockKV.put('json-key', JSON.stringify(data));

      const retrieved = await mockKV.get('json-key', { type: 'json' });
      expect(retrieved).toEqual(data);
    });

    it('should support expiration', async () => {
      vi.useFakeTimers();

      await mockKV.put('temp-key', 'temp-value', { expirationTtl: 60 });
      expect(await mockKV.get('temp-key')).toBe('temp-value');

      vi.advanceTimersByTime(61000);
      expect(await mockKV.get('temp-key')).toBeNull();

      vi.useRealTimers();
    });

    it('should create namespaced KV', async () => {
      const userKV = KVTestUtils.createNamespacedKV(mockKV, 'user');

      await userKV.put('123', 'Alice');
      await mockKV.put('other:456', 'Bob');

      const list = await userKV.list();
      expect(list.keys).toHaveLength(1);
      expect(list.keys[0].name).toBe('user:123');
    });
  });

  describe('Cache Helpers', () => {
    let cache: MockCacheService;

    beforeEach(() => {
      cache = new MockCacheService();
    });

    it('should track cache statistics', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1'); // hit
      await cache.get('key2'); // miss
      await cache.get('key1'); // hit

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });

    it('should support tag-based purging', async () => {
      await cache.set('user:1', { name: 'Alice' }, { tags: ['users'] });
      await cache.set('user:2', { name: 'Bob' }, { tags: ['users'] });
      await cache.set('post:1', { title: 'Hello' }, { tags: ['posts'] });

      await cache.purgeByTags(['users']);

      expect(await cache.get('user:1')).toBeNull();
      expect(await cache.get('user:2')).toBeNull();
      expect(await cache.get('post:1')).toEqual({ title: 'Hello' });
    });

    it('should simulate expiration', async () => {
      vi.useFakeTimers();

      await cache.set('temp', 'value', { ttl: 60 });
      expect(await cache.get('temp')).toBe('value');

      await CacheTestUtils.simulateExpiration(cache, 61);
      expect(await cache.get('temp')).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('Environment Helpers', () => {
    it('should create mock worker environment', () => {
      const env = createMockWorkerEnv({
        API_KEY: 'test-key',
        CUSTOM_VAR: 'custom-value',
      });

      expect(env.DB).toBeDefined();
      expect(env.KV).toBeDefined();
      expect(env.API_KEY).toBe('test-key');
      expect(env.ENVIRONMENT).toBe('test');
    });

    it('should create execution context', async () => {
      const ctx = createMockExecutionContext();
      const promise = Promise.resolve('done');

      ctx.waitUntil(promise);

      expect(ctx.waitUntil).toHaveBeenCalledWith(promise);
      expect(ctx._promises).toContain(promise);
    });

    it('should validate environment variables', () => {
      const validator = EnvTestUtils.createEnvValidator({
        API_KEY: (value) => typeof value === 'string' && value.length > 0,
        PORT: (value) => typeof value === 'number' && value > 0,
      });

      const result = validator.validate({
        API_KEY: 'valid-key',
        PORT: 3000,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Async Helpers', () => {
    it('should wait for condition', async () => {
      let ready = false;
      setTimeout(() => {
        ready = true;
      }, 100);

      await waitFor(() => ready, { timeout: 1000 });
      expect(ready).toBe(true);
    });

    it('should retry with backoff', async () => {
      let attempts = 0;

      const result = await retry(
        async () => {
          attempts++;
          if (attempts < 3) throw new Error('Not ready');
          return 'success';
        },
        { maxAttempts: 5, initialDelay: 10 },
      );

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should limit parallel execution', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const tasks = Array.from({ length: 10 }, () => async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((resolve) => setTimeout(resolve, 50));
        concurrent--;
        return concurrent;
      });

      await parallelLimit(tasks, 3);
      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });

    it('should handle event emitter', async () => {
      const emitter = new TestEventEmitter<{
        data: [string, number];
        error: [Error];
      }>();

      setTimeout(() => emitter.emit('data', 'test', 42), 50);

      const [message, value] = await emitter.waitForEvent('data');
      expect(message).toBe('test');
      expect(value).toBe(42);

      const history = emitter.getEventHistory();
      expect(history).toHaveLength(1);
      expect(history[0].event).toBe('data');
    });

    it('should handle async queue', async () => {
      const queue = new AsyncQueue<number>();

      queue.push(1);
      queue.push(2);
      queue.push(3);

      expect(await queue.pop()).toBe(1);
      expect(await queue.pop()).toBe(2);
      expect(queue.size()).toBe(1);
    });
  });
});
