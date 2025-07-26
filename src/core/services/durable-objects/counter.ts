/**
 * Counter Durable Object for distributed counting
 */

import type { ICounterDurableObject } from '../../interfaces/durable-objects';

import { BaseDurableObject } from './base-durable-object';

/**
 * Distributed counter using Durable Objects
 * Provides atomic increment/decrement operations
 */
export class Counter extends BaseDurableObject implements ICounterDurableObject {
  private value = 0;

  protected async onInitialize(): Promise<void> {
    // Load current value from storage
    const storedValue = await this.get<number>('value');
    if (storedValue !== undefined) {
      this.value = storedValue;
    }
  }

  async fetch(request: Request): Promise<Response> {
    // Ensure initialized
    await this.initialize();

    const url = new URL(request.url);
    const path = url.pathname;

    switch (request.method) {
      case 'GET':
        return this.handleGet(path);

      case 'POST':
        return this.handlePost(path, request);

      case 'PUT':
        return this.handlePut(path, request);

      case 'DELETE':
        return this.handleDelete(path);

      default:
        return this.error('Method not allowed', 405);
    }
  }

  private async handleGet(path: string): Promise<Response> {
    switch (path) {
      case '/':
      case '/value': {
        const value = await this.getValue();
        return this.json({ value });
      }

      default:
        return this.error('Not found', 404);
    }
  }

  private async handlePost(path: string, request: Request): Promise<Response> {
    switch (path) {
      case '/increment': {
        const body = await this.parseBody(request);
        const amount = body?.amount || 1;
        const newValue = await this.increment(amount);
        return this.json({ value: newValue });
      }

      case '/decrement': {
        const body = await this.parseBody(request);
        const amount = body?.amount || 1;
        const newValue = await this.decrement(amount);
        return this.json({ value: newValue });
      }

      default:
        return this.error('Not found', 404);
    }
  }

  private async handlePut(path: string, request: Request): Promise<Response> {
    switch (path) {
      case '/':
      case '/value': {
        const body = await this.parseBody(request);
        if (typeof body?.value !== 'number') {
          return this.error('Value must be a number', 400);
        }
        this.value = body.value;
        await this.put('value', this.value);
        return this.json({ value: this.value });
      }

      default:
        return this.error('Not found', 404);
    }
  }

  private async handleDelete(path: string): Promise<Response> {
    switch (path) {
      case '/':
      case '/reset':
        await this.reset();
        return this.json({ value: 0 });

      default:
        return this.error('Not found', 404);
    }
  }

  async increment(amount = 1): Promise<number> {
    return this.blockConcurrencyWhile(async () => {
      this.value += amount;
      await this.put('value', this.value);
      return this.value;
    });
  }

  async decrement(amount = 1): Promise<number> {
    return this.blockConcurrencyWhile(async () => {
      this.value -= amount;
      await this.put('value', this.value);
      return this.value;
    });
  }

  async getValue(): Promise<number> {
    return this.value;
  }

  async reset(): Promise<void> {
    await this.blockConcurrencyWhile(async () => {
      this.value = 0;
      await this.put('value', this.value);
    });
  }

  private async parseBody(request: Request): Promise<Record<string, unknown> | null> {
    try {
      return (await request.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}

/**
 * Named counter that supports multiple counters in one Durable Object
 */
export class NamedCounters extends BaseDurableObject {
  private counters = new Map<string, number>();

  protected async onInitialize(): Promise<void> {
    // Load all counters from storage
    const stored = await this.list<number>({ prefix: 'counter:' });
    for (const [key, value] of stored) {
      const name = key.replace('counter:', '');
      this.counters.set(name, value);
    }
  }

  async fetch(request: Request): Promise<Response> {
    await this.initialize();

    const url = new URL(request.url);
    const path = url.pathname;
    const name = path.slice(1); // Remove leading slash

    if (!name && request.method === 'GET') {
      // List all counters
      return this.json({
        counters: Object.fromEntries(this.counters),
      });
    }

    if (!name) {
      return this.error('Counter name required', 400);
    }

    switch (request.method) {
      case 'GET':
        return this.json({
          name,
          value: this.counters.get(name) || 0,
        });

      case 'POST': {
        const body = await this.parseBody(request);
        const action = body?.action || 'increment';
        const amount = body?.amount || 1;

        let value: number;
        switch (action) {
          case 'increment':
            value = await this.incrementCounter(name, amount);
            break;
          case 'decrement':
            value = await this.decrementCounter(name, amount);
            break;
          default:
            return this.error(`Unknown action: ${action}`, 400);
        }

        return this.json({ name, value });
      }

      case 'PUT': {
        const body = await this.parseBody(request);
        if (typeof body?.value !== 'number') {
          return this.error('Value must be a number', 400);
        }
        await this.setCounter(name, body.value);
        return this.json({ name, value: body.value });
      }

      case 'DELETE':
        await this.deleteCounter(name);
        return this.json({ name, deleted: true });

      default:
        return this.error('Method not allowed', 405);
    }
  }

  private async incrementCounter(name: string, amount = 1): Promise<number> {
    return this.blockConcurrencyWhile(async () => {
      const current = this.counters.get(name) || 0;
      const newValue = current + amount;
      this.counters.set(name, newValue);
      await this.put(`counter:${name}`, newValue);
      return newValue;
    });
  }

  private async decrementCounter(name: string, amount = 1): Promise<number> {
    return this.incrementCounter(name, -amount);
  }

  private async setCounter(name: string, value: number): Promise<void> {
    await this.blockConcurrencyWhile(async () => {
      this.counters.set(name, value);
      await this.put(`counter:${name}`, value);
    });
  }

  private async deleteCounter(name: string): Promise<void> {
    await this.blockConcurrencyWhile(async () => {
      this.counters.delete(name);
      await this.delete(`counter:${name}`);
    });
  }

  private async parseBody(request: Request): Promise<Record<string, unknown> | null> {
    try {
      return (await request.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
