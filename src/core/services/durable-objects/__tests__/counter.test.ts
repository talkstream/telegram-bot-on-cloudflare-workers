import { describe, it, expect, beforeEach } from 'vitest';

import { Counter, NamedCounters } from '../counter';
import { SimpleState } from '../base-durable-object';

describe('Counter', () => {
  let counter: Counter;
  let state: SimpleState;

  beforeEach(() => {
    state = new SimpleState();
    counter = new Counter(state, {});
  });

  describe('HTTP API', () => {
    it('should get initial value', async () => {
      const response = await counter.fetch(new Request('http://test/value'));
      const data = await response.json();
      expect(data).toEqual({ value: 0 });
    });

    it('should increment', async () => {
      const response = await counter.fetch(
        new Request('http://test/increment', { method: 'POST' }),
      );
      const data = await response.json();
      expect(data).toEqual({ value: 1 });
    });

    it('should increment by amount', async () => {
      const response = await counter.fetch(
        new Request('http://test/increment', {
          method: 'POST',
          body: JSON.stringify({ amount: 5 }),
        }),
      );
      const data = await response.json();
      expect(data).toEqual({ value: 5 });
    });

    it('should decrement', async () => {
      await counter.increment(10);
      const response = await counter.fetch(
        new Request('http://test/decrement', { method: 'POST' }),
      );
      const data = await response.json();
      expect(data).toEqual({ value: 9 });
    });

    it('should decrement by amount', async () => {
      await counter.increment(10);
      const response = await counter.fetch(
        new Request('http://test/decrement', {
          method: 'POST',
          body: JSON.stringify({ amount: 3 }),
        }),
      );
      const data = await response.json();
      expect(data).toEqual({ value: 7 });
    });

    it('should set value', async () => {
      const response = await counter.fetch(
        new Request('http://test/value', {
          method: 'PUT',
          body: JSON.stringify({ value: 42 }),
        }),
      );
      const data = await response.json();
      expect(data).toEqual({ value: 42 });
    });

    it('should reset', async () => {
      await counter.increment(10);
      const response = await counter.fetch(new Request('http://test/reset', { method: 'DELETE' }));
      const data = await response.json();
      expect(data).toEqual({ value: 0 });
    });

    it('should validate value type', async () => {
      const response = await counter.fetch(
        new Request('http://test/value', {
          method: 'PUT',
          body: JSON.stringify({ value: 'not a number' }),
        }),
      );
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Value must be a number');
    });
  });

  describe('direct methods', () => {
    it('should increment', async () => {
      const value = await counter.increment();
      expect(value).toBe(1);
      expect(await counter.getValue()).toBe(1);
    });

    it('should increment by amount', async () => {
      const value = await counter.increment(5);
      expect(value).toBe(5);
      expect(await counter.getValue()).toBe(5);
    });

    it('should decrement', async () => {
      await counter.increment(10);
      const value = await counter.decrement();
      expect(value).toBe(9);
      expect(await counter.getValue()).toBe(9);
    });

    it('should decrement by amount', async () => {
      await counter.increment(10);
      const value = await counter.decrement(3);
      expect(value).toBe(7);
      expect(await counter.getValue()).toBe(7);
    });

    it('should reset', async () => {
      await counter.increment(10);
      await counter.reset();
      expect(await counter.getValue()).toBe(0);
    });
  });

  describe('persistence', () => {
    it('should persist value', async () => {
      await counter.increment(5);

      // Create new instance with same state
      const counter2 = new Counter(state, {});
      await counter2.fetch(new Request('http://test/')); // Trigger initialization

      expect(await counter2.getValue()).toBe(5);
    });
  });
});

describe('NamedCounters', () => {
  let counters: NamedCounters;
  let state: SimpleState;

  beforeEach(() => {
    state = new SimpleState();
    counters = new NamedCounters(state, {});
  });

  describe('HTTP API', () => {
    it('should list all counters', async () => {
      // Create some counters
      await counters.fetch(
        new Request('http://test/counter1', {
          method: 'POST',
          body: JSON.stringify({ action: 'increment', amount: 5 }),
        }),
      );
      await counters.fetch(
        new Request('http://test/counter2', {
          method: 'POST',
          body: JSON.stringify({ action: 'increment', amount: 10 }),
        }),
      );

      const response = await counters.fetch(new Request('http://test/'));
      const data = await response.json();
      expect(data).toEqual({
        counters: {
          counter1: 5,
          counter2: 10,
        },
      });
    });

    it('should get counter value', async () => {
      await counters.fetch(
        new Request('http://test/myCounter', {
          method: 'POST',
          body: JSON.stringify({ action: 'increment', amount: 3 }),
        }),
      );

      const response = await counters.fetch(new Request('http://test/myCounter'));
      const data = await response.json();
      expect(data).toEqual({ name: 'myCounter', value: 3 });
    });

    it('should increment counter', async () => {
      const response = await counters.fetch(
        new Request('http://test/myCounter', {
          method: 'POST',
          body: JSON.stringify({ action: 'increment', amount: 5 }),
        }),
      );
      const data = await response.json();
      expect(data).toEqual({ name: 'myCounter', value: 5 });
    });

    it('should decrement counter', async () => {
      // First increment
      await counters.fetch(
        new Request('http://test/myCounter', {
          method: 'POST',
          body: JSON.stringify({ action: 'increment', amount: 10 }),
        }),
      );

      // Then decrement
      const response = await counters.fetch(
        new Request('http://test/myCounter', {
          method: 'POST',
          body: JSON.stringify({ action: 'decrement', amount: 3 }),
        }),
      );
      const data = await response.json();
      expect(data).toEqual({ name: 'myCounter', value: 7 });
    });

    it('should set counter value', async () => {
      const response = await counters.fetch(
        new Request('http://test/myCounter', {
          method: 'PUT',
          body: JSON.stringify({ value: 42 }),
        }),
      );
      const data = await response.json();
      expect(data).toEqual({ name: 'myCounter', value: 42 });
    });

    it('should delete counter', async () => {
      // Create counter
      await counters.fetch(
        new Request('http://test/myCounter', {
          method: 'POST',
          body: JSON.stringify({ action: 'increment', amount: 5 }),
        }),
      );

      // Delete it
      const response = await counters.fetch(
        new Request('http://test/myCounter', { method: 'DELETE' }),
      );
      const data = await response.json();
      expect(data).toEqual({ name: 'myCounter', deleted: true });

      // Verify it's gone
      const getResponse = await counters.fetch(new Request('http://test/myCounter'));
      const getData = await getResponse.json();
      expect(getData).toEqual({ name: 'myCounter', value: 0 });
    });

    it('should handle invalid action', async () => {
      const response = await counters.fetch(
        new Request('http://test/myCounter', {
          method: 'POST',
          body: JSON.stringify({ action: 'invalid' }),
        }),
      );
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Unknown action');
    });

    it('should validate value type', async () => {
      const response = await counters.fetch(
        new Request('http://test/myCounter', {
          method: 'PUT',
          body: JSON.stringify({ value: 'not a number' }),
        }),
      );
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Value must be a number');
    });
  });

  describe('persistence', () => {
    it('should persist counters', async () => {
      // Create counters
      await counters.fetch(
        new Request('http://test/counter1', {
          method: 'POST',
          body: JSON.stringify({ action: 'increment', amount: 5 }),
        }),
      );
      await counters.fetch(
        new Request('http://test/counter2', {
          method: 'POST',
          body: JSON.stringify({ action: 'increment', amount: 10 }),
        }),
      );

      // Create new instance with same state
      const counters2 = new NamedCounters(state, {});
      const response = await counters2.fetch(new Request('http://test/'));
      const data = await response.json();
      expect(data).toEqual({
        counters: {
          counter1: 5,
          counter2: 10,
        },
      });
    });
  });

  describe('multiple counters', () => {
    it('should handle multiple independent counters', async () => {
      // Increment different counters
      await counters.fetch(
        new Request('http://test/apples', {
          method: 'POST',
          body: JSON.stringify({ action: 'increment', amount: 3 }),
        }),
      );
      await counters.fetch(
        new Request('http://test/oranges', {
          method: 'POST',
          body: JSON.stringify({ action: 'increment', amount: 5 }),
        }),
      );
      await counters.fetch(
        new Request('http://test/bananas', {
          method: 'POST',
          body: JSON.stringify({ action: 'increment', amount: 2 }),
        }),
      );

      // Verify all values
      const response = await counters.fetch(new Request('http://test/'));
      const data = await response.json();
      expect(data).toEqual({
        counters: {
          apples: 3,
          oranges: 5,
          bananas: 2,
        },
      });
    });
  });
});
