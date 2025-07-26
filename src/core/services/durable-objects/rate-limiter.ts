/**
 * Rate limiter Durable Object for distributed rate limiting
 */

import type { IRateLimiterDurableObject } from '../../interfaces/durable-objects';

import { BaseDurableObject } from './base-durable-object';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Distributed rate limiter using Durable Objects
 * Provides accurate rate limiting across all instances
 */
export class RateLimiter extends BaseDurableObject implements IRateLimiterDurableObject {
  private limits = new Map<string, RateLimitEntry>();

  protected async onInitialize(): Promise<void> {
    // Load current limits from storage
    const stored = await this.list<RateLimitEntry>({ prefix: 'limit:' });
    const now = Date.now();

    for (const [key, entry] of stored) {
      const limitKey = key.replace('limit:', '');
      // Only load non-expired entries
      if (entry.resetAt > now) {
        this.limits.set(limitKey, entry);
      } else {
        // Clean up expired entries
        await this.delete(key);
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    await this.initialize();

    const url = new URL(request.url);
    const path = url.pathname;

    switch (request.method) {
      case 'POST':
        return this.handlePost(path, request);

      case 'GET':
        return this.handleGet(path, request);

      case 'DELETE':
        return this.handleDelete(path, request);

      default:
        return this.error('Method not allowed', 405);
    }
  }

  private async handlePost(path: string, request: Request): Promise<Response> {
    if (path !== '/check') {
      return this.error('Not found', 404);
    }

    const body = await this.parseBody(request);
    const { key, limit, window } = body;

    if (!key || typeof limit !== 'number' || typeof window !== 'number') {
      return this.error('Invalid parameters: key, limit, and window are required', 400);
    }

    const allowed = await this.checkLimit(key, limit, window);
    const usage = await this.getUsage(key);

    return this.json({
      allowed,
      ...usage,
      limit,
    });
  }

  private async handleGet(path: string, request: Request): Promise<Response> {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');

    if (!key) {
      // Return all current limits
      const allLimits: Record<string, RateLimitEntry> = {};
      for (const [k, v] of this.limits) {
        allLimits[k] = v;
      }
      return this.json({ limits: allLimits });
    }

    const usage = await this.getUsage(key);
    return this.json(usage);
  }

  private async handleDelete(path: string, request: Request): Promise<Response> {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');

    if (!key) {
      return this.error('Key parameter required', 400);
    }

    await this.resetKey(key);
    return this.json({ reset: true, key });
  }

  async checkLimit(key: string, limit: number, window: number): Promise<boolean> {
    return this.blockConcurrencyWhile(async () => {
      const now = Date.now();
      const entry = this.limits.get(key);

      // Check if we need to reset the window
      if (!entry || entry.resetAt <= now) {
        // Start a new window
        const newEntry: RateLimitEntry = {
          count: 1,
          resetAt: now + window,
        };
        this.limits.set(key, newEntry);
        await this.put(`limit:${key}`, newEntry);
        return true;
      }

      // Check if limit exceeded
      if (entry.count >= limit) {
        return false;
      }

      // Increment counter
      entry.count++;
      await this.put(`limit:${key}`, entry);
      return true;
    });
  }

  async getUsage(key: string): Promise<{ count: number; resetAt: number }> {
    const entry = this.limits.get(key);

    if (!entry || entry.resetAt <= Date.now()) {
      return { count: 0, resetAt: 0 };
    }

    return {
      count: entry.count,
      resetAt: entry.resetAt,
    };
  }

  async resetKey(key: string): Promise<void> {
    await this.blockConcurrencyWhile(async () => {
      this.limits.delete(key);
      await this.delete(`limit:${key}`);
    });
  }

  private async parseBody(request: Request): Promise<any> {
    try {
      return await request.json();
    } catch {
      return {};
    }
  }

  /**
   * Clean up expired entries periodically
   */
  private async cleanupExpired(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.limits) {
      if (entry.resetAt <= now) {
        expiredKeys.push(key);
      }
    }

    if (expiredKeys.length > 0) {
      await this.blockConcurrencyWhile(async () => {
        for (const key of expiredKeys) {
          this.limits.delete(key);
          await this.delete(`limit:${key}`);
        }
      });
    }
  }
}

/**
 * Advanced rate limiter with multiple strategies
 */
export class AdvancedRateLimiter extends RateLimiter {
  async fetch(request: Request): Promise<Response> {
    await this.initialize();

    const url = new URL(request.url);
    const path = url.pathname;

    // Add support for different rate limiting strategies
    switch (path) {
      case '/check/sliding-window':
        return this.handleSlidingWindow(request);

      case '/check/token-bucket':
        return this.handleTokenBucket(request);

      case '/check/leaky-bucket':
        return this.handleLeakyBucket(request);

      default:
        return super.fetch(request);
    }
  }

  private async handleSlidingWindow(request: Request): Promise<Response> {
    const body = await this.parseBody(request);
    const { key, limit, window } = body;

    if (!key || typeof limit !== 'number' || typeof window !== 'number') {
      return this.error('Invalid parameters', 400);
    }

    // Implement sliding window algorithm
    const now = Date.now();
    const windowStart = now - window;

    // Get all requests in the current window
    const requests = await this.getSlidingWindowRequests(key, windowStart);

    if (requests.length >= limit) {
      return this.json({
        allowed: false,
        count: requests.length,
        limit,
        oldestRequest: Math.min(...requests),
        resetAt: Math.min(...requests) + window,
      });
    }

    // Add new request
    await this.addSlidingWindowRequest(key, now);

    return this.json({
      allowed: true,
      count: requests.length + 1,
      limit,
    });
  }

  private async handleTokenBucket(request: Request): Promise<Response> {
    const body = await this.parseBody(request);
    const { key, capacity, refillRate, tokens = 1 } = body;

    if (!key || typeof capacity !== 'number' || typeof refillRate !== 'number') {
      return this.error('Invalid parameters', 400);
    }

    const allowed = await this.checkTokenBucket(key, capacity, refillRate, tokens);
    const bucket = await this.getTokenBucket(key);

    return this.json({
      allowed,
      ...bucket,
      capacity,
      refillRate,
    });
  }

  private async handleLeakyBucket(request: Request): Promise<Response> {
    const body = await this.parseBody(request);
    const { key, capacity, leakRate } = body;

    if (!key || typeof capacity !== 'number' || typeof leakRate !== 'number') {
      return this.error('Invalid parameters', 400);
    }

    const allowed = await this.checkLeakyBucket(key, capacity, leakRate);
    const bucket = await this.getLeakyBucket(key);

    return this.json({
      allowed,
      ...bucket,
      capacity,
      leakRate,
    });
  }

  private async getSlidingWindowRequests(key: string, windowStart: number): Promise<number[]> {
    const requests = (await this.get<number[]>(`sliding:${key}`)) || [];
    return requests.filter((timestamp) => timestamp >= windowStart);
  }

  private async addSlidingWindowRequest(key: string, timestamp: number): Promise<void> {
    await this.blockConcurrencyWhile(async () => {
      const requests = await this.getSlidingWindowRequests(key, timestamp - 3600000); // Keep 1 hour of data
      requests.push(timestamp);
      await this.put(`sliding:${key}`, requests);
    });
  }

  private async checkTokenBucket(
    key: string,
    capacity: number,
    refillRate: number,
    tokens: number,
  ): Promise<boolean> {
    return this.blockConcurrencyWhile(async () => {
      const now = Date.now();
      const bucket = await this.get<{ tokens: number; lastRefill: number }>(`token:${key}`);

      let currentTokens: number;
      if (!bucket) {
        currentTokens = capacity;
      } else {
        // Calculate tokens to add based on time passed
        const timePassed = now - bucket.lastRefill;
        const tokensToAdd = Math.floor((timePassed * refillRate) / 1000);
        currentTokens = Math.min(capacity, bucket.tokens + tokensToAdd);
      }

      if (currentTokens < tokens) {
        // Not enough tokens
        await this.put(`token:${key}`, { tokens: currentTokens, lastRefill: now });
        return false;
      }

      // Consume tokens
      currentTokens -= tokens;
      await this.put(`token:${key}`, { tokens: currentTokens, lastRefill: now });
      return true;
    });
  }

  private async getTokenBucket(key: string): Promise<{ tokens: number; lastRefill: number }> {
    const bucket = await this.get<{ tokens: number; lastRefill: number }>(`token:${key}`);
    return bucket || { tokens: 0, lastRefill: 0 };
  }

  private async checkLeakyBucket(
    key: string,
    capacity: number,
    leakRate: number,
  ): Promise<boolean> {
    return this.blockConcurrencyWhile(async () => {
      const now = Date.now();
      const bucket = await this.get<{ level: number; lastLeak: number }>(`leaky:${key}`);

      let currentLevel: number;
      if (!bucket) {
        currentLevel = 0;
      } else {
        // Calculate how much has leaked
        const timePassed = now - bucket.lastLeak;
        const leaked = (timePassed * leakRate) / 1000;
        currentLevel = Math.max(0, bucket.level - leaked);
      }

      if (currentLevel >= capacity) {
        // Bucket is full
        await this.put(`leaky:${key}`, { level: currentLevel, lastLeak: now });
        return false;
      }

      // Add to bucket
      currentLevel += 1;
      await this.put(`leaky:${key}`, { level: currentLevel, lastLeak: now });
      return true;
    });
  }

  private async getLeakyBucket(key: string): Promise<{ level: number; lastLeak: number }> {
    const bucket = await this.get<{ level: number; lastLeak: number }>(`leaky:${key}`);
    return bucket || { level: 0, lastLeak: 0 };
  }

  private async parseBody(request: Request): Promise<any> {
    try {
      return await request.json();
    } catch {
      return {};
    }
  }
}
