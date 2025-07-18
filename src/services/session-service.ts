import type { KVNamespace } from '@cloudflare/workers-types';

import { getTierConfig } from '@/config/tiers';
import { logger } from '@/lib/logger';
import { MultiLayerCache } from '@/lib/multi-layer-cache';

export interface UserSession {
  userId: number;
  step: string;
  data: Record<string, unknown>;
  lastActivity?: number;
  expiresAt?: number;
}

export interface SessionOptions {
  ttl?: number; // TTL in seconds
  tier?: 'free' | 'paid';
}

export class SessionService {
  private sessionsKv: KVNamespace;
  private cache?: MultiLayerCache;
  private tier: 'free' | 'paid';
  private config: ReturnType<typeof getTierConfig>;

  constructor(sessionsKv: KVNamespace, tier: 'free' | 'paid' = 'free', cache?: MultiLayerCache) {
    this.sessionsKv = sessionsKv;
    this.tier = tier;
    this.config = getTierConfig(tier);
    if (cache) {
      this.cache = cache;
    }
  }

  async getSession(userId: number): Promise<UserSession | null> {
    const key = this.getSessionKey(userId);

    // Try cache first if available
    if (this.cache) {
      const cached = await this.cache.get<UserSession>(key);
      if (cached) {
        // Check if session is expired
        if (this.isSessionExpired(cached)) {
          await this.deleteSession(userId);
          return null;
        }
        return cached;
      }
    }

    // Fallback to KV
    const sessionStr = await this.sessionsKv.get(key);
    if (!sessionStr) return null;

    const session = JSON.parse(sessionStr) as UserSession;

    // Check expiration
    if (this.isSessionExpired(session)) {
      await this.deleteSession(userId);
      return null;
    }

    // Update cache if available
    if (this.cache) {
      await this.cache.set(key, session, {
        ttl: this.config.performance.cacheTTL.session,
        tags: ['session'],
      });
    }

    return session;
  }

  async saveSession(session: UserSession, options?: SessionOptions): Promise<void> {
    const key = this.getSessionKey(session.userId);
    const ttl = options?.ttl || this.config.performance.cacheTTL.session;

    // Add session metadata
    const enrichedSession: UserSession = {
      ...session,
      lastActivity: Date.now(),
      expiresAt: Date.now() + ttl * 1000,
    };

    // Save to KV with TTL
    await this.sessionsKv.put(key, JSON.stringify(enrichedSession), {
      expirationTtl: ttl,
    });

    // Update cache if available
    if (this.cache) {
      await this.cache.set(key, enrichedSession, {
        ttl,
        tags: ['session', 'important'], // Mark as important for free tier
      });
    }

    logger.info('Session saved', {
      userId: session.userId,
      ttl,
      tier: this.tier,
    });
  }

  async deleteSession(userId: number): Promise<void> {
    const key = this.getSessionKey(userId);

    // Delete from both cache and KV
    const deletePromises: Promise<void>[] = [this.sessionsKv.delete(key)];

    if (this.cache) {
      deletePromises.push(this.cache.delete(key));
    }

    await Promise.all(deletePromises);

    logger.info('Session deleted', { userId });
  }

  async touchSession(userId: number): Promise<void> {
    const session = await this.getSession(userId);
    if (session) {
      await this.saveSession({
        ...session,
        lastActivity: Date.now(),
      });
    }
  }

  /**
   * Clean up expired sessions (for scheduled cleanup)
   */
  async cleanupExpiredSessions(limit = 100): Promise<number> {
    if (this.tier === 'free') {
      // Skip cleanup on free tier to save KV operations
      logger.info('Session cleanup skipped on free tier');
      return 0;
    }

    let cleaned = 0;
    const sessions = await this.sessionsKv.list({ limit });

    for (const key of sessions.keys) {
      try {
        const sessionStr = await this.sessionsKv.get(key.name);
        if (!sessionStr) continue;

        const session = JSON.parse(sessionStr) as UserSession;
        if (this.isSessionExpired(session)) {
          await this.sessionsKv.delete(key.name);
          cleaned++;
        }
      } catch (error) {
        logger.error('Error cleaning session', { key: key.name, error });
      }
    }

    logger.info('Sessions cleaned up', { cleaned, checked: sessions.keys.length });
    return cleaned;
  }

  private getSessionKey(userId: number): string {
    return `session:${userId}`;
  }

  private isSessionExpired(session: UserSession): boolean {
    if (!session.expiresAt) return false;
    return session.expiresAt < Date.now();
  }
}
