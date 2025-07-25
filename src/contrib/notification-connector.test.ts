import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NotificationConnector } from '@/connectors/notification/notification-connector';
import type { ITelegramConnector } from '@/connectors/telegram/interfaces/telegram-connector.interface';

describe('NotificationConnector', () => {
  let notificationConnector: NotificationConnector;
  let mockTelegramConnector: ITelegramConnector;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTelegramConnector = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    } as unknown as ITelegramConnector;

    notificationConnector = new NotificationConnector(mockTelegramConnector);
  });

  describe('sendNotification', () => {
    it('should send notification successfully', async () => {
      const result = await notificationConnector.sendNotification(123456, 'Test message');

      expect(result).toBe(true);
      expect(mockTelegramConnector.sendMessage).toHaveBeenCalledWith(123456, 'Test message');
      expect(mockTelegramConnector.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      vi.mocked(mockTelegramConnector.sendMessage)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(undefined);

      const result = await notificationConnector.sendNotification(123456, 'Test message');

      expect(result).toBe(true);
      expect(mockTelegramConnector.sendMessage).toHaveBeenCalledTimes(3);
    });

    it('should return false after max retries', async () => {
      vi.mocked(mockTelegramConnector.sendMessage).mockRejectedValue(new Error('Persistent error'));

      const result = await notificationConnector.sendNotification(123456, 'Test message');

      expect(result).toBe(false);
      expect(mockTelegramConnector.sendMessage).toHaveBeenCalledTimes(3);
    });

    it('should not retry if user blocked the bot', async () => {
      vi.mocked(mockTelegramConnector.sendMessage).mockRejectedValueOnce(
        new Error('Bot was blocked by the user'),
      );

      const result = await notificationConnector.sendNotification(123456, 'Test message');

      expect(result).toBe(false);
      expect(mockTelegramConnector.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should detect various blocked user errors', async () => {
      const blockedErrors = [
        'Bot was blocked by the user',
        'User is deactivated',
        'Chat not found',
        'Forbidden: bot was blocked',
      ];

      for (const errorMessage of blockedErrors) {
        vi.clearAllMocks();
        vi.mocked(mockTelegramConnector.sendMessage).mockRejectedValueOnce(new Error(errorMessage));

        const result = await notificationConnector.sendNotification(123456, 'Test message');

        expect(result).toBe(false);
        expect(mockTelegramConnector.sendMessage).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('sendBatchNotifications', () => {
    it('should send notifications in batches', async () => {
      const notifications = Array.from({ length: 75 }, (_, i) => ({
        userId: 100 + i,
        message: `Message ${i}`,
      }));

      await notificationConnector.sendBatchNotifications(notifications);

      // Should be called 75 times (once for each notification)
      expect(mockTelegramConnector.sendMessage).toHaveBeenCalledTimes(75);

      // Check first and last calls
      expect(mockTelegramConnector.sendMessage).toHaveBeenNthCalledWith(1, 100, 'Message 0');
      expect(mockTelegramConnector.sendMessage).toHaveBeenNthCalledWith(75, 174, 'Message 74');
    });

    it('should handle failures gracefully in batch', async () => {
      // Set up mixed success/failure responses
      vi.mocked(mockTelegramConnector.sendMessage)
        .mockResolvedValueOnce(undefined) // First message success
        .mockRejectedValue(new Error('Failed')); // All others fail

      const notifications = [
        { userId: 111, message: 'Message 1' },
        { userId: 222, message: 'Message 2' },
        { userId: 333, message: 'Message 3' },
      ];

      // Just verify it completes without throwing
      await expect(
        notificationConnector.sendBatchNotifications(notifications),
      ).resolves.toBeUndefined();

      // Verify at least the first successful call was made
      expect(mockTelegramConnector.sendMessage).toHaveBeenCalledWith(111, 'Message 1');
    });

    it('should delay between batches', async () => {
      const notifications = Array.from({ length: 31 }, (_, i) => ({
        userId: 100 + i,
        message: `Message ${i}`,
      }));

      const start = Date.now();
      await notificationConnector.sendBatchNotifications(notifications);
      const duration = Date.now() - start;

      // Should have delayed at least 1000ms between batches
      expect(duration).toBeGreaterThanOrEqual(1000);
      expect(mockTelegramConnector.sendMessage).toHaveBeenCalledTimes(31);
    });

    it('should handle empty notifications array', async () => {
      await notificationConnector.sendBatchNotifications([]);

      expect(mockTelegramConnector.sendMessage).not.toHaveBeenCalled();
    });
  });
});
