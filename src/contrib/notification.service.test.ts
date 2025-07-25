import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NotificationService } from '@/domain/services/kogotochki/notification.service';
import { NotificationConnector } from '@/connectors/notification/notification-connector';
import { UserService } from '@/domain/services/kogotochki/user.service';
import type { KogotochkiUser } from '@/types/kogotochki';
import type { AuctionResult } from '@/domain/models/kogotochki/auction-result.model';

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockNotificationConnector: NotificationConnector;
  let mockUserService: UserService;

  const mockUser: KogotochkiUser = {
    telegramId: 123456,
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    languageCode: 'ru',
    isProvider: true,
    isBlocked: false,
    starsBalance: 100,
    notificationEnabled: true,
    notificationCategories: ['auction', 'balance'],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActiveAt: new Date(),
  };

  beforeEach(() => {
    // Create mocks
    mockNotificationConnector = {
      sendNotification: vi.fn().mockResolvedValue(true),
      sendBatchNotifications: vi.fn().mockResolvedValue(undefined),
    } as unknown as NotificationConnector;

    mockUserService = {
      getUserByTelegramId: vi.fn().mockResolvedValue(mockUser),
      getUsersWithNotificationCategory: vi.fn().mockResolvedValue([mockUser]),
    } as unknown as UserService;

    notificationService = new NotificationService(mockNotificationConnector, mockUserService);
  });

  describe('sendAuctionWinNotification', () => {
    it('should send notification to winner', async () => {
      const result: AuctionResult = {
        userId: 123456,
        serviceId: 1,
        categoryId: 'nails',
        position: 1,
        bidAmount: 50,
        roundId: 1,
        timestamp: new Date(),
      };

      await notificationService.sendAuctionWinNotification(123456, result);

      expect(mockUserService.getUserByTelegramId).toHaveBeenCalledWith(123456);
      expect(mockNotificationConnector.sendNotification).toHaveBeenCalledWith(
        123456,
        expect.stringContaining('Поздравляем!'),
      );
    });

    it('should not send notification if user has notifications disabled', async () => {
      const disabledUser = { ...mockUser, notificationEnabled: false };
      vi.mocked(mockUserService.getUserByTelegramId).mockResolvedValueOnce(disabledUser);

      const result: AuctionResult = {
        userId: 123456,
        serviceId: 1,
        categoryId: 'nails',
        position: 1,
        bidAmount: 50,
        roundId: 1,
        timestamp: new Date(),
      };

      await notificationService.sendAuctionWinNotification(123456, result);

      expect(mockNotificationConnector.sendNotification).not.toHaveBeenCalled();
    });

    it('should not send notification if user does not have auction category enabled', async () => {
      const userWithoutAuction = { ...mockUser, notificationCategories: ['balance'] };
      vi.mocked(mockUserService.getUserByTelegramId).mockResolvedValueOnce(userWithoutAuction);

      const result: AuctionResult = {
        userId: 123456,
        serviceId: 1,
        categoryId: 'nails',
        position: 1,
        bidAmount: 50,
        roundId: 1,
        timestamp: new Date(),
      };

      await notificationService.sendAuctionWinNotification(123456, result);

      expect(mockNotificationConnector.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('sendBalanceChangeNotification', () => {
    it('should send balance change notification', async () => {
      await notificationService.sendBalanceChangeNotification(
        123456,
        100,
        150,
        'Пополнение баланса',
      );

      expect(mockNotificationConnector.sendNotification).toHaveBeenCalledWith(
        123456,
        expect.stringContaining('Было: 100 ⭐'),
      );
      expect(mockNotificationConnector.sendNotification).toHaveBeenCalledWith(
        123456,
        expect.stringContaining('Стало: 150 ⭐'),
      );
    });

    it('should not send if balance notifications disabled', async () => {
      const userWithoutBalance = { ...mockUser, notificationCategories: ['auction'] };
      vi.mocked(mockUserService.getUserByTelegramId).mockResolvedValueOnce(userWithoutBalance);

      await notificationService.sendBalanceChangeNotification(
        123456,
        100,
        150,
        'Пополнение баланса',
      );

      expect(mockNotificationConnector.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('sendNewAuctionNotification', () => {
    it('should send notifications to all users with category enabled', async () => {
      const users = [
        { ...mockUser, telegramId: 111 },
        { ...mockUser, telegramId: 222 },
        { ...mockUser, telegramId: 333 },
      ];
      vi.mocked(mockUserService.getUsersWithNotificationCategory).mockResolvedValueOnce(users);

      await notificationService.sendNewAuctionNotification('nails');

      expect(mockUserService.getUsersWithNotificationCategory).toHaveBeenCalledWith('nails');
      expect(mockNotificationConnector.sendBatchNotifications).toHaveBeenCalledWith([
        { userId: 111, message: expect.stringContaining('новый аукцион') },
        { userId: 222, message: expect.stringContaining('новый аукцион') },
        { userId: 333, message: expect.stringContaining('новый аукцион') },
      ]);
    });

    it('should not send if no users have category enabled', async () => {
      vi.mocked(mockUserService.getUsersWithNotificationCategory).mockResolvedValueOnce([]);

      await notificationService.sendNewAuctionNotification('nails');

      expect(mockNotificationConnector.sendBatchNotifications).not.toHaveBeenCalled();
    });
  });

  describe('sendSystemNotification', () => {
    it('should always send system notifications if enabled', async () => {
      const userWithNoCategories = { ...mockUser, notificationCategories: [] };
      vi.mocked(mockUserService.getUserByTelegramId).mockResolvedValueOnce(userWithNoCategories);

      await notificationService.sendSystemNotification(123456, 'Важное обновление системы');

      expect(mockNotificationConnector.sendNotification).toHaveBeenCalledWith(
        123456,
        expect.stringContaining('Важное обновление системы'),
      );
    });

    it('should not send if notifications disabled', async () => {
      const disabledUser = { ...mockUser, notificationEnabled: false };
      vi.mocked(mockUserService.getUserByTelegramId).mockResolvedValueOnce(disabledUser);

      await notificationService.sendSystemNotification(123456, 'Важное обновление системы');

      expect(mockNotificationConnector.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('sendBulkNotification', () => {
    it('should send to all provided user IDs', async () => {
      const userIds = [111, 222, 333];
      const message = 'Массовое уведомление';

      await notificationService.sendBulkNotification(userIds, message);

      expect(mockNotificationConnector.sendBatchNotifications).toHaveBeenCalledWith([
        { userId: 111, message },
        { userId: 222, message },
        { userId: 333, message },
      ]);
    });
  });
});
