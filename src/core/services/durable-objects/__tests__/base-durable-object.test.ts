import { describe, it, expect, beforeEach } from 'vitest';

import { BaseDurableObject, SimpleState } from '../base-durable-object';
import type { IDurableObjectState } from '../../../interfaces/durable-objects';

// Test implementation of BaseDurableObject
class TestDurableObject extends BaseDurableObject {
  initializeCalled = false;
  cleanupCalled = false;

  protected async onInitialize(): Promise<void> {
    this.initializeCalled = true;
  }

  protected async onCleanup(): Promise<void> {
    this.cleanupCalled = true;
  }

  async fetch(request: Request): Promise<Response> {
    await this.initialize();

    const url = new URL(request.url);
    switch (url.pathname) {
      case '/get': {
        const value = await this.get('test');
        return this.json({ value });
      }

      case '/put':
        await this.put('test', 'value');
        return this.success();

      case '/delete': {
        const deleted = await this.delete('test');
        return this.json({ deleted });
      }

      case '/list': {
        const items = await this.list();
        return this.json({ items: Object.fromEntries(items) });
      }

      case '/error':
        return this.error('Test error', 400);

      default:
        return this.error('Not found', 404);
    }
  }

  // Expose protected methods for testing
  async testGet(key: string) {
    return this.get(key);
  }

  async testPut(key: string, value: unknown) {
    return this.put(key, value);
  }

  async testDelete(key: string) {
    return this.delete(key);
  }

  async testList(options?: Parameters<BaseDurableObject['list']>[0]) {
    return this.list(options);
  }
}

describe('BaseDurableObject', () => {
  let state: IDurableObjectState;
  let obj: TestDurableObject;

  beforeEach(() => {
    state = new SimpleState();
    obj = new TestDurableObject(state, {});
  });

  describe('initialization', () => {
    it('should initialize on first call', async () => {
      expect(obj.initializeCalled).toBe(false);
      await obj.initialize();
      expect(obj.initializeCalled).toBe(true);
    });

    it('should only initialize once', async () => {
      await obj.initialize();
      obj.initializeCalled = false;
      await obj.initialize();
      expect(obj.initializeCalled).toBe(false);
    });
  });

  describe('storage operations', () => {
    it('should get and put values', async () => {
      await obj.testPut('key1', 'value1');
      const value = await obj.testGet('key1');
      expect(value).toBe('value1');
    });

    it('should return undefined for non-existent keys', async () => {
      const value = await obj.testGet('nonexistent');
      expect(value).toBeUndefined();
    });

    it('should delete values', async () => {
      await obj.testPut('key1', 'value1');
      const deleted = await obj.testDelete('key1');
      expect(deleted).toBe(true);

      const value = await obj.testGet('key1');
      expect(value).toBeUndefined();
    });

    it('should list values', async () => {
      await obj.testPut('key1', 'value1');
      await obj.testPut('key2', 'value2');
      await obj.testPut('key3', 'value3');

      const items = await obj.testList();
      expect(items.size).toBe(3);
      expect(items.get('key1')).toBe('value1');
      expect(items.get('key2')).toBe('value2');
      expect(items.get('key3')).toBe('value3');
    });
  });

  describe('HTTP handling', () => {
    it('should handle GET requests', async () => {
      await obj.testPut('test', 'hello');
      const response = await obj.fetch(new Request('http://test/get'));
      const data = await response.json();
      expect(data).toEqual({ value: 'hello' });
    });

    it('should handle PUT requests', async () => {
      const response = await obj.fetch(new Request('http://test/put'));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ success: true });
    });

    it('should handle DELETE requests', async () => {
      await obj.testPut('test', 'value');
      const response = await obj.fetch(new Request('http://test/delete'));
      const data = await response.json();
      expect(data).toEqual({ deleted: true });
    });

    it('should handle errors', async () => {
      const response = await obj.fetch(new Request('http://test/error'));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ error: 'Test error' });
    });

    it('should handle 404', async () => {
      const response = await obj.fetch(new Request('http://test/unknown'));
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toEqual({ error: 'Not found' });
    });
  });

  describe('cleanup', () => {
    it('should call cleanup', async () => {
      expect(obj.cleanupCalled).toBe(false);
      await obj.cleanup();
      expect(obj.cleanupCalled).toBe(true);
    });
  });
});

describe('SimpleState', () => {
  let state: SimpleState;

  beforeEach(() => {
    state = new SimpleState();
  });

  describe('get/put operations', () => {
    it('should store and retrieve single values', async () => {
      await state.put('key', 'value');
      const result = await state.get('key');
      expect(result).toBe('value');
    });

    it('should store and retrieve multiple values', async () => {
      await state.put({ key1: 'value1', key2: 'value2' });
      const result = await state.get(['key1', 'key2']);
      expect(result.get('key1')).toBe('value1');
      expect(result.get('key2')).toBe('value2');
    });

    it('should handle missing keys in batch get', async () => {
      await state.put('key1', 'value1');
      const result = await state.get(['key1', 'key2']);
      expect(result.size).toBe(1);
      expect(result.get('key1')).toBe('value1');
      expect(result.has('key2')).toBe(false);
    });
  });

  describe('delete operations', () => {
    it('should delete single keys', async () => {
      await state.put('key', 'value');
      const deleted = await state.delete('key');
      expect(deleted).toBe(true);

      const value = await state.get('key');
      expect(value).toBeUndefined();
    });

    it('should delete multiple keys', async () => {
      await state.put({ key1: 'value1', key2: 'value2', key3: 'value3' });
      const count = await state.delete(['key1', 'key3']);
      expect(count).toBe(2);

      const remaining = await state.get(['key1', 'key2', 'key3']);
      expect(remaining.size).toBe(1);
      expect(remaining.has('key2')).toBe(true);
    });
  });

  describe('list operations', () => {
    beforeEach(async () => {
      await state.put({
        apple: 1,
        banana: 2,
        cherry: 3,
        date: 4,
        elderberry: 5,
      });
    });

    it('should list all items', async () => {
      const items = await state.list();
      expect(items.size).toBe(5);
    });

    it('should filter by prefix', async () => {
      const items = await state.list({ prefix: 'ch' });
      expect(items.size).toBe(1);
      expect(items.has('cherry')).toBe(true);
    });

    it('should filter by start', async () => {
      const items = await state.list({ start: 'cherry' });
      expect(items.size).toBe(3); // cherry, date, elderberry
    });

    it('should filter by startAfter', async () => {
      const items = await state.list({ startAfter: 'cherry' });
      expect(items.size).toBe(2); // date, elderberry
    });

    it('should filter by end', async () => {
      const items = await state.list({ end: 'cherry' });
      expect(items.size).toBe(2); // apple, banana
    });

    it('should reverse order', async () => {
      const items = await state.list({ reverse: true });
      const keys = Array.from(items.keys());
      expect(keys[0]).toBe('elderberry');
      expect(keys[keys.length - 1]).toBe('apple');
    });

    it('should limit results', async () => {
      const items = await state.list({ limit: 2 });
      expect(items.size).toBe(2);
    });
  });

  describe('storage operations', () => {
    it('should provide storage interface', async () => {
      expect(state.storage).toBeDefined();
      expect(state.storage.get).toBeDefined();
      expect(state.storage.put).toBeDefined();
      expect(state.storage.delete).toBeDefined();
    });

    it('should clear all data', async () => {
      await state.put({ key1: 'value1', key2: 'value2' });
      await state.storage.deleteAll();
      const items = await state.list();
      expect(items.size).toBe(0);
    });

    it('should handle transactions', async () => {
      await state.put('counter', 0);

      try {
        await state.storage.transaction(async (txn) => {
          await txn.put('counter', 1);
          throw new Error('Rollback');
        });
      } catch (_error) {
        // Expected
      }

      // Should rollback
      const value = await state.get('counter');
      expect(value).toBe(0);
    });

    it('should commit successful transactions', async () => {
      await state.put('counter', 0);

      await state.storage.transaction(async (txn) => {
        await txn.put('counter', 1);
      });

      const value = await state.get('counter');
      expect(value).toBe(1);
    });
  });
});
