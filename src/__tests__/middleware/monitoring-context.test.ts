import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { BotContext } from '@/lib/types.js';
import type { IMonitoringConnector, TransactionOptions } from '@/core/interfaces/monitoring.js';
import {
  createMonitoringContextMiddleware,
  trackCommand,
  trackError,
  createMonitoredCommand,
} from '@/middleware/monitoring-context.js';

describe('Monitoring Context Middleware', () => {
  let mockMonitoring: IMonitoringConnector;
  let mockContext: BotContext;
  let nextFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nextFn = vi.fn().mockResolvedValue(undefined);

    mockMonitoring = {
      initialize: vi.fn().mockResolvedValue(undefined),
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      setUserContext: vi.fn(),
      clearUserContext: vi.fn(),
      addBreadcrumb: vi.fn(),
      startTransaction: vi.fn().mockReturnValue({
        setStatus: vi.fn(),
        setData: vi.fn(),
        finish: vi.fn(),
      }),
      startSpan: vi.fn(),
      flush: vi.fn().mockResolvedValue(true),
      isAvailable: vi.fn().mockReturnValue(true),
    };

    mockContext = {
      from: {
        id: 123456,
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
        language_code: 'en',
        is_premium: true,
        is_bot: false,
      },
      chat: {
        id: -123456,
        type: 'private',
      },
      update: {
        update_id: 1,
        message: {
          message_id: 1,
          text: 'Test message',
          date: Date.now(),
          chat: {
            id: -123456,
            type: 'private',
          },
        },
      },
    } as unknown as BotContext;
  });

  describe('createMonitoringContextMiddleware', () => {
    it('should set user context when monitoring is available', async () => {
      const middleware = createMonitoringContextMiddleware(mockMonitoring);
      await middleware(mockContext, nextFn);

      expect(mockMonitoring.setUserContext).toHaveBeenCalledWith('123456', {
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        languageCode: 'en',
        isPremium: true,
        isBot: false,
      });
    });

    it('should add breadcrumb for message updates', async () => {
      const middleware = createMonitoringContextMiddleware(mockMonitoring);
      await middleware(mockContext, nextFn);

      expect(mockMonitoring.addBreadcrumb).toHaveBeenCalledWith({
        message: 'Message from user 123456',
        category: 'telegram.message',
        level: 'info',
        type: 'user',
        data: {
          chatId: -123456,
          chatType: 'private',
          messageId: 1,
          hasText: true,
          hasPhoto: false,
          hasDocument: false,
        },
      });
    });

    it('should add breadcrumb for callback queries', async () => {
      mockContext.update = {
        update_id: 1,
        callback_query: {
          id: 'callback_1',
          from: mockContext.from as NonNullable<BotContext['from']>,
          data: 'button_clicked',
          message: {
            message_id: 2,
            date: Date.now(),
            chat: mockContext.chat as NonNullable<BotContext['chat']>,
          },
        },
      } as BotContext['update'];

      const middleware = createMonitoringContextMiddleware(mockMonitoring);
      await middleware(mockContext, nextFn);

      expect(mockMonitoring.addBreadcrumb).toHaveBeenCalledWith({
        message: 'Callback query from user 123456',
        category: 'telegram.callback',
        level: 'info',
        type: 'user',
        data: {
          callbackData: 'button_clicked',
          messageId: 2,
        },
      });
    });

    it('should handle missing monitoring gracefully', async () => {
      const middleware = createMonitoringContextMiddleware(undefined);
      await expect(middleware(mockContext, nextFn)).resolves.not.toThrow();
      expect(nextFn).toHaveBeenCalled();
    });

    it('should handle monitoring not available', async () => {
      mockMonitoring.isAvailable = vi.fn().mockReturnValue(false);
      const middleware = createMonitoringContextMiddleware(mockMonitoring);
      await middleware(mockContext, nextFn);

      expect(mockMonitoring.setUserContext).not.toHaveBeenCalled();
      expect(mockMonitoring.addBreadcrumb).not.toHaveBeenCalled();
    });

    it('should handle missing from field', async () => {
      mockContext.from = undefined;
      const middleware = createMonitoringContextMiddleware(mockMonitoring);
      await middleware(mockContext, nextFn);

      expect(mockMonitoring.setUserContext).not.toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('trackCommand', () => {
    it('should add breadcrumb for command execution', () => {
      trackCommand(mockMonitoring, 'start', mockContext);

      expect(mockMonitoring.addBreadcrumb).toHaveBeenCalledWith({
        message: 'Command /start executed',
        category: 'command',
        level: 'info',
        type: 'user',
        data: {
          userId: 123456,
          chatId: -123456,
          chatType: 'private',
          args: undefined,
        },
      });
    });

    it('should handle missing monitoring', () => {
      expect(() => trackCommand(undefined, 'start', mockContext)).not.toThrow();
    });

    it('should handle monitoring not available', () => {
      mockMonitoring.isAvailable = vi.fn().mockReturnValue(false);
      trackCommand(mockMonitoring, 'start', mockContext);
      expect(mockMonitoring.addBreadcrumb).not.toHaveBeenCalled();
    });
  });

  describe('trackError', () => {
    const testError = new Error('Test error');

    it('should capture exception with context', () => {
      trackError(mockMonitoring, testError, mockContext);

      expect(mockMonitoring.captureException).toHaveBeenCalledWith(testError, {
        user: {
          id: 123456,
          username: 'testuser',
        },
        chat: {
          id: -123456,
          type: 'private',
        },
        update: {
          updateId: 1,
          hasMessage: true,
          hasCallback: false,
        },
      });
    });

    it('should include additional context', () => {
      trackError(mockMonitoring, testError, mockContext, { command: 'test' });

      expect(mockMonitoring.captureException).toHaveBeenCalledWith(
        testError,
        expect.objectContaining({
          command: 'test',
        }),
      );
    });

    it('should handle missing monitoring', () => {
      expect(() => trackError(undefined, testError, mockContext)).not.toThrow();
    });
  });

  describe('createMonitoredCommand', () => {
    it('should track successful command execution', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const monitoredCommand = createMonitoredCommand(mockMonitoring, 'test', handler);

      await monitoredCommand(mockContext);

      expect(mockMonitoring.startTransaction).toHaveBeenCalledWith({
        name: 'command.test',
        op: 'command',
        tags: {
          command: 'test',
          userId: '123456',
          chatType: 'private',
        },
      });

      expect(handler).toHaveBeenCalledWith(mockContext);

      const transaction = mockMonitoring.startTransaction?.({} as TransactionOptions);
      expect(transaction.setStatus).toHaveBeenCalledWith('ok');
      expect(transaction.finish).toHaveBeenCalled();
    });

    it('should track failed command execution', async () => {
      const testError = new Error('Command failed');
      const handler = vi.fn().mockRejectedValue(testError);
      const monitoredCommand = createMonitoredCommand(mockMonitoring, 'test', handler);

      await expect(monitoredCommand(mockContext)).rejects.toThrow('Command failed');

      const transaction = mockMonitoring.startTransaction?.({} as TransactionOptions);
      expect(transaction.setStatus).toHaveBeenCalledWith('internal_error');
      expect(transaction.finish).toHaveBeenCalled();
      expect(mockMonitoring.captureException).toHaveBeenCalled();
    });

    it('should handle missing monitoring', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const monitoredCommand = createMonitoredCommand(undefined, 'test', handler);

      await expect(monitoredCommand(mockContext)).resolves.not.toThrow();
      expect(handler).toHaveBeenCalledWith(mockContext);
    });

    it('should handle missing startTransaction method', async () => {
      mockMonitoring.startTransaction = undefined;
      const handler = vi.fn().mockResolvedValue(undefined);
      const monitoredCommand = createMonitoredCommand(mockMonitoring, 'test', handler);

      await expect(monitoredCommand(mockContext)).resolves.not.toThrow();
      expect(handler).toHaveBeenCalledWith(mockContext);
    });
  });
});
