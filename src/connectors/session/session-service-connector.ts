/**
 * Session Service integration through EventBus
 * Bridges the existing SessionService with the new connector architecture
 */

import type { EventBus } from '../../core/events/event-bus';
import type { UserSession, SessionOptions } from '../../services/session-service';
import type { MultiLayerCache } from '../../lib/multi-layer-cache';
import { SessionService } from '../../services/session-service';
import { logger } from '../../lib/logger';

import type { IKeyValueStore } from '@/core/interfaces/storage';
import type { ResourceConstraints } from '@/core/interfaces/resource-constraints';

export interface SessionServiceConfig {
  sessionsKv: IKeyValueStore;
  constraints?: ResourceConstraints;
  cache?: MultiLayerCache;
}

export class SessionServiceConnector {
  private sessionService: SessionService;

  constructor(
    private eventBus: EventBus,
    config: SessionServiceConfig,
  ) {
    // Map constraints to tier for backward compatibility with SessionService
    // TODO: Refactor SessionService to use ResourceConstraints directly
    const tier = this.constraintsToTier(config.constraints);
    this.sessionService = new SessionService(config.sessionsKv, tier, config.cache);
    this.setupEventHandlers();
  }

  /**
   * Convert ResourceConstraints to tier for backward compatibility
   * This is a temporary solution until SessionService is refactored
   */
  private constraintsToTier(constraints?: ResourceConstraints): 'free' | 'paid' {
    if (!constraints) return 'free';

    // If sessions feature is available and has sufficient resources
    if (constraints.features.has('sessions') && constraints.storage.maxKVWritesPerDay > 10000) {
      return 'paid';
    }

    return 'free';
  }

  /**
   * Setup event handlers for session requests
   */
  private setupEventHandlers(): void {
    // Handle session retrieval
    this.eventBus.on('session:get', async (event) => {
      const { userId, requestId } = event.payload as {
        userId: number;
        requestId: string;
      };

      try {
        const session = await this.sessionService.getSession(userId);

        // Emit success event
        this.eventBus.emit(
          'session:get:success',
          {
            requestId,
            session,
          },
          'SessionServiceConnector',
        );
      } catch (error) {
        // Emit error event
        this.eventBus.emit(
          'session:get:error',
          {
            requestId,
            error: error instanceof Error ? error.message : 'Failed to get session',
          },
          'SessionServiceConnector',
        );

        logger.error('Failed to get session', { error, userId, requestId });
      }
    });

    // Handle session save
    this.eventBus.on('session:save', async (event) => {
      const { session, options, requestId } = event.payload as {
        session: UserSession;
        options?: SessionOptions;
        requestId: string;
      };

      try {
        await this.sessionService.saveSession(session, options);

        // Emit success event
        this.eventBus.emit(
          'session:save:success',
          {
            requestId,
            userId: session.userId,
          },
          'SessionServiceConnector',
        );
      } catch (error) {
        // Emit error event
        this.eventBus.emit(
          'session:save:error',
          {
            requestId,
            error: error instanceof Error ? error.message : 'Failed to save session',
          },
          'SessionServiceConnector',
        );

        logger.error('Failed to save session', { error, session, requestId });
      }
    });

    // Handle session deletion
    this.eventBus.on('session:delete', async (event) => {
      const { userId, requestId } = event.payload as {
        userId: number;
        requestId: string;
      };

      try {
        await this.sessionService.deleteSession(userId);

        // Emit success event
        this.eventBus.emit(
          'session:delete:success',
          {
            requestId,
            userId,
          },
          'SessionServiceConnector',
        );
      } catch (error) {
        // Emit error event
        this.eventBus.emit(
          'session:delete:error',
          {
            requestId,
            error: error instanceof Error ? error.message : 'Failed to delete session',
          },
          'SessionServiceConnector',
        );

        logger.error('Failed to delete session', { error, userId, requestId });
      }
    });

    // Handle session touch (update last activity)
    this.eventBus.on('session:touch', async (event) => {
      const { userId, requestId } = event.payload as {
        userId: number;
        requestId?: string;
      };

      try {
        await this.sessionService.touchSession(userId);

        // Emit success event if requestId provided
        if (requestId) {
          this.eventBus.emit(
            'session:touch:success',
            {
              requestId,
              userId,
            },
            'SessionServiceConnector',
          );
        }
      } catch (error) {
        // Emit error event if requestId provided
        if (requestId) {
          this.eventBus.emit(
            'session:touch:error',
            {
              requestId,
              error: error instanceof Error ? error.message : 'Failed to touch session',
            },
            'SessionServiceConnector',
          );
        }

        logger.error('Failed to touch session', { error, userId });
      }
    });

    // Handle cleanup of expired sessions
    this.eventBus.on('session:cleanup', async (event) => {
      const { limit, requestId } = event.payload as {
        limit?: number;
        requestId?: string;
      };

      try {
        const cleaned = await this.sessionService.cleanupExpiredSessions(limit);

        // Emit success event if requestId provided
        if (requestId) {
          this.eventBus.emit(
            'session:cleanup:success',
            {
              requestId,
              cleaned,
            },
            'SessionServiceConnector',
          );
        }

        logger.info('Session cleanup completed', { cleaned });
      } catch (error) {
        // Emit error event if requestId provided
        if (requestId) {
          this.eventBus.emit(
            'session:cleanup:error',
            {
              requestId,
              error: error instanceof Error ? error.message : 'Cleanup failed',
            },
            'SessionServiceConnector',
          );
        }

        logger.error('Session cleanup failed', { error });
      }
    });
  }

  /**
   * Get the underlying session service instance
   */
  getService(): SessionService {
    return this.sessionService;
  }
}
