import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { MonitoringPlugin } from '../monitoring-plugin';

import type { Event } from '@/core/events/interfaces';
import type { IMonitoringConnector } from '@/core/interfaces/monitoring';

// Mock the sentry config
vi.mock('@/config/sentry', () => ({
  getMonitoringConnector: vi.fn(),
}));

describe('MonitoringPlugin', () => {
  let plugin: MonitoringPlugin;
  let mockMonitoring: IMonitoringConnector;
  let getMonitoringConnector: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Create mock monitoring connector
    mockMonitoring = {
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      addBreadcrumb: vi.fn(),
      setUserContext: vi.fn(),
      clearUserContext: vi.fn(),
      startTransaction: vi.fn(),
      startSpan: vi.fn(),
      flush: vi.fn(),
      initialize: vi.fn(),
    };

    // Setup the mock
    getMonitoringConnector = vi.fn().mockReturnValue(mockMonitoring);
    const sentryModule = await import('@/config/sentry');
    (sentryModule.getMonitoringConnector as any) = getMonitoringConnector;

    plugin = new MonitoringPlugin();
    await plugin.initialize();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Error Event Handling', () => {
    it('should capture exceptions from error events', async () => {
      const error = new Error('Test error');
      const event: Event = {
        type: 'telegram.error',
        data: { error },
        timestamp: Date.now(),
      };

      await plugin.onEvent(event);

      expect(mockMonitoring.captureException).toHaveBeenCalledWith(error, {
        eventType: 'telegram.error',
        eventData: { error },
        timestamp: event.timestamp,
      });
    });

    it('should capture error messages for non-Error objects', async () => {
      const event: Event = {
        type: 'payment.error',
        data: { message: 'Payment failed' },
        timestamp: Date.now(),
      };

      await plugin.onEvent(event);

      expect(mockMonitoring.captureMessage).toHaveBeenCalledWith(
        'Event Error: payment.error',
        'error',
        expect.objectContaining({
          error: '[object Object]',
          eventData: { message: 'Payment failed' },
        }),
      );
    });

    it('should detect error events by suffix', async () => {
      const event: Event = {
        type: 'custom.module.error',
        data: { details: 'Something went wrong' },
        timestamp: Date.now(),
      };

      await plugin.onEvent(event);

      expect(mockMonitoring.captureMessage).toHaveBeenCalled();
    });
  });

  describe('Performance Event Handling', () => {
    it('should track performance events with breadcrumbs', async () => {
      const event: Event = {
        type: 'ai.complete',
        data: { duration: 1500, model: 'gpt-4' },
        timestamp: Date.now(),
      };

      await plugin.onEvent(event);

      expect(mockMonitoring.addBreadcrumb).toHaveBeenCalledWith({
        message: 'Performance: ai.complete',
        category: 'performance',
        level: 'info',
        data: { duration: 1500, model: 'gpt-4' },
        timestamp: event.timestamp,
      });
    });

    it('should alert on slow operations', async () => {
      const event: Event = {
        type: 'ai.complete',
        data: { duration: 6000 }, // Over 5s threshold
        timestamp: Date.now(),
      };

      await plugin.onEvent(event);

      expect(mockMonitoring.captureMessage).toHaveBeenCalledWith(
        'Slow operation detected: ai.complete',
        'warning',
        expect.objectContaining({
          duration: 6000,
          threshold: 5000,
        }),
      );
    });

    it('should use appropriate thresholds for different operations', async () => {
      // DB operation - 1s threshold
      await plugin.onEvent({
        type: 'db.query',
        data: { duration: 1500 },
        timestamp: Date.now(),
      });

      expect(mockMonitoring.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('Slow operation'),
        'warning',
        expect.objectContaining({ threshold: 1000 }),
      );

      // Clear only the mock history, not the implementation
      (mockMonitoring.captureMessage as ReturnType<typeof vi.fn>).mockClear();

      // Telegram operation - 2s threshold
      await plugin.onEvent({
        type: 'telegram.sendMessage',
        data: { duration: 2500 },
        timestamp: Date.now(),
      });

      expect(mockMonitoring.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('Slow operation'),
        'warning',
        expect.objectContaining({ threshold: 2000 }),
      );
    });
  });

  describe('General Event Tracking', () => {
    it('should track command events', async () => {
      const event: Event = {
        type: 'command.start',
        data: { userId: 123 },
        timestamp: Date.now(),
      };

      await plugin.onEvent(event);

      expect(mockMonitoring.addBreadcrumb).toHaveBeenCalledWith({
        message: 'command.start',
        category: 'event',
        level: 'info',
        data: { userId: 123 },
        timestamp: event.timestamp,
      });
    });

    it('should track state change events', async () => {
      const events = [
        { type: 'task.started', data: {} },
        { type: 'process.completed', data: {} },
        { type: 'operation.failed', data: {} },
      ];

      for (const event of events) {
        await plugin.onEvent({ ...event, timestamp: Date.now() });
      }

      expect(mockMonitoring.addBreadcrumb).toHaveBeenCalledTimes(3);
    });

    it('should not track unimportant events', async () => {
      const event: Event = {
        type: 'internal.cache.hit',
        data: {},
        timestamp: Date.now(),
      };

      await plugin.onEvent(event);

      expect(mockMonitoring.addBreadcrumb).not.toHaveBeenCalled();
      expect(mockMonitoring.captureMessage).not.toHaveBeenCalled();
    });
  });

  describe('Data Sanitization', () => {
    it('should redact sensitive fields', async () => {
      const event: Event = {
        type: 'auth.login',
        data: {
          username: 'user123',
          password: 'secret123',
          token: 'abc123',
          apiKey: 'key123',
        },
        timestamp: Date.now(),
      };

      await plugin.onEvent(event);

      expect(mockMonitoring.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            username: 'user123',
            password: '[REDACTED]',
            token: '[REDACTED]',
            apiKey: 'key123', // 'apiKey' not in sensitive list
          },
        }),
      );
    });

    it('should truncate long strings', async () => {
      const longString = 'a'.repeat(300);
      const event: Event = {
        type: 'command.process',
        data: { message: longString },
        timestamp: Date.now(),
      };

      await plugin.onEvent(event);

      expect(mockMonitoring.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            message: 'a'.repeat(200) + '...',
          },
        }),
      );
    });

    it('should limit array items', async () => {
      const event: Event = {
        type: 'user.action',
        data: { items: Array(20).fill('item') },
        timestamp: Date.now(),
      };

      await plugin.onEvent(event);

      expect(mockMonitoring.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            items: Array(10).fill('item'), // Limited to 10
          },
        }),
      );
    });
  });

  describe('Statistics', () => {
    it('should track event counts', async () => {
      await plugin.onEvent({ type: 'command.start', data: {}, timestamp: Date.now() });
      await plugin.onEvent({ type: 'command.start', data: {}, timestamp: Date.now() });
      await plugin.onEvent({ type: 'command.help', data: {}, timestamp: Date.now() });

      await plugin.destroy();

      expect(mockMonitoring.captureMessage).toHaveBeenCalledWith(
        'EventBus session statistics',
        'info',
        expect.objectContaining({
          eventCounts: {
            'command.start': 2,
            'command.help': 1,
          },
          totalEvents: 3,
        }),
      );
    });
  });

  describe('No Monitoring', () => {
    it('should handle case when monitoring is not available', async () => {
      const sentryModule = await import('@/config/sentry');
      (sentryModule.getMonitoringConnector as any).mockReturnValue(null);

      const pluginNoMonitoring = new MonitoringPlugin();
      await pluginNoMonitoring.initialize();

      // Should not throw
      await expect(
        pluginNoMonitoring.onEvent({
          type: 'test.event',
          data: {},
          timestamp: Date.now(),
        }),
      ).resolves.toBeUndefined();
    });
  });
});
