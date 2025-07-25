import type { INotificationConnector } from '@/connectors/notification/notification-connector';
import type { IUserService } from '@/domain/services/kogotochki/user.service.interface';
import type { KogotochkiUser } from '@/types/kogotochki';
import type { AuctionResult } from '@/domain/models/kogotochki/auction-result.model';
import { CATEGORIES } from '@/constants/kogotochki';
import { captureException } from '@/config/sentry';

export interface NotificationTemplate {
  auctionWin: (position: number, amount: number, category: string) => string;
  auctionOutbid: (newAmount: number, category: string) => string;
  auctionRefund: (amount: number, category: string) => string;
  auctionNew: (category: string) => string;
  balanceChanged: (oldBalance: number, newBalance: number, reason: string) => string;
  serviceExpiring: (daysLeft: number) => string;
  systemUpdate: (message: string) => string;
}

export interface INotificationService {
  sendAuctionWinNotification(userId: number, result: AuctionResult): Promise<void>;
  sendAuctionOutbidNotification(
    userId: number,
    categoryId: string,
    newAmount: number,
  ): Promise<void>;
  sendAuctionRefundNotification(userId: number, categoryId: string, amount: number): Promise<void>;
  sendNewAuctionNotification(categoryId: string): Promise<void>;
  sendBalanceChangeNotification(
    userId: number,
    oldBalance: number,
    newBalance: number,
    reason: string,
  ): Promise<void>;
  sendServiceExpiringNotification(userId: number, daysLeft: number): Promise<void>;
  sendSystemNotification(userId: number, message: string): Promise<void>;
  sendBulkNotification(userIds: number[], message: string): Promise<void>;
}

export class NotificationService implements INotificationService {
  private readonly templates: NotificationTemplate = {
    auctionWin: (position: number, amount: number, category: string) =>
      `🎉 Поздравляем! Вы выиграли ${position} место в категории "${category}"!\n` +
      `💫 Потрачено Stars: ${amount}\n\n` +
      `Ваше объявление теперь отображается в топе категории.`,

    auctionOutbid: (newAmount: number, category: string) =>
      `⚠️ Вашу ставку перебили в категории "${category}"!\n` +
      `💫 Новая минимальная ставка: ${newAmount} Stars\n\n` +
      `Сделайте новую ставку, чтобы вернуться в топ.`,

    auctionRefund: (amount: number, category: string) =>
      `💰 Возврат средств за аукцион в категории "${category}"\n` +
      `💫 Возвращено Stars: ${amount}\n\n` +
      `Спасибо за участие! Попробуйте в следующий раз.`,

    auctionNew: (category: string) =>
      `🔔 Начался новый аукцион в категории "${category}"!\n\n` +
      `Успейте занять лучшие места для вашего объявления.`,

    balanceChanged: (oldBalance: number, newBalance: number, reason: string) =>
      `💳 Изменение баланса Stars\n` +
      `Было: ${oldBalance} ⭐\n` +
      `Стало: ${newBalance} ⭐\n` +
      `Причина: ${reason}`,

    serviceExpiring: (daysLeft: number) =>
      `⏰ Ваше объявление истекает через ${daysLeft} ${daysLeft === 1 ? 'день' : 'дня'}!\n\n` +
      `Не забудьте продлить размещение.`,

    systemUpdate: (message: string) => `📢 Системное уведомление\n\n${message}`,
  };

  constructor(
    private readonly notificationConnector: INotificationConnector,
    private readonly userService: IUserService,
  ) {}

  async sendAuctionWinNotification(userId: number, result: AuctionResult): Promise<void> {
    try {
      const user = await this.userService.getUserByTelegramId(userId);
      if (!user || !this.shouldSendNotification(user, 'auction')) {
        return;
      }

      const category = CATEGORIES[result.categoryId as keyof typeof CATEGORIES];
      const message = this.templates.auctionWin(
        result.position,
        result.bidAmount,
        category?.name || result.categoryId,
      );

      await this.notificationConnector.sendNotification(userId, message);
    } catch (error) {
      captureException(error as Error, {
        userId,
        notificationType: 'auctionWin',
        categoryId: result.categoryId,
      });
    }
  }

  async sendAuctionOutbidNotification(
    userId: number,
    categoryId: string,
    newAmount: number,
  ): Promise<void> {
    try {
      const user = await this.userService.getUserByTelegramId(userId);
      if (!user || !this.shouldSendNotification(user, 'auction')) {
        return;
      }

      const category = CATEGORIES[categoryId as keyof typeof CATEGORIES];
      const message = this.templates.auctionOutbid(newAmount, category?.name || categoryId);

      await this.notificationConnector.sendNotification(userId, message);
    } catch (error) {
      captureException(error as Error, {
        userId,
        notificationType: 'auctionOutbid',
        categoryId,
      });
    }
  }

  async sendAuctionRefundNotification(
    userId: number,
    categoryId: string,
    amount: number,
  ): Promise<void> {
    try {
      const user = await this.userService.getUserByTelegramId(userId);
      if (!user || !this.shouldSendNotification(user, 'auction')) {
        return;
      }

      const category = CATEGORIES[categoryId as keyof typeof CATEGORIES];
      const message = this.templates.auctionRefund(amount, category?.name || categoryId);

      await this.notificationConnector.sendNotification(userId, message);
    } catch (error) {
      captureException(error as Error, {
        userId,
        notificationType: 'auctionRefund',
        categoryId,
      });
    }
  }

  async sendNewAuctionNotification(categoryId: string): Promise<void> {
    try {
      const users = await this.userService.getUsersWithNotificationCategory(categoryId);
      if (users.length === 0) {
        return;
      }

      const category = CATEGORIES[categoryId as keyof typeof CATEGORIES];
      const message = this.templates.auctionNew(category?.name || categoryId);

      await this.sendBulkNotification(
        users.map((u) => u.telegramId),
        message,
      );
    } catch (error) {
      captureException(error as Error, {
        notificationType: 'auctionNew',
        categoryId,
      });
    }
  }

  async sendBalanceChangeNotification(
    userId: number,
    oldBalance: number,
    newBalance: number,
    reason: string,
  ): Promise<void> {
    try {
      const user = await this.userService.getUserByTelegramId(userId);
      if (!user || !this.shouldSendNotification(user, 'balance')) {
        return;
      }

      const message = this.templates.balanceChanged(oldBalance, newBalance, reason);
      await this.notificationConnector.sendNotification(userId, message);
    } catch (error) {
      captureException(error as Error, {
        userId,
        notificationType: 'balanceChange',
      });
    }
  }

  async sendServiceExpiringNotification(userId: number, daysLeft: number): Promise<void> {
    try {
      const user = await this.userService.getUserByTelegramId(userId);
      if (!user || !this.shouldSendNotification(user, 'service')) {
        return;
      }

      const message = this.templates.serviceExpiring(daysLeft);
      await this.notificationConnector.sendNotification(userId, message);
    } catch (error) {
      captureException(error as Error, {
        userId,
        notificationType: 'serviceExpiring',
      });
    }
  }

  async sendSystemNotification(userId: number, message: string): Promise<void> {
    try {
      const user = await this.userService.getUserByTelegramId(userId);
      if (!user || !this.shouldSendNotification(user, 'system')) {
        return;
      }

      const formattedMessage = this.templates.systemUpdate(message);
      await this.notificationConnector.sendNotification(userId, formattedMessage);
    } catch (error) {
      captureException(error as Error, {
        userId,
        notificationType: 'system',
      });
    }
  }

  async sendBulkNotification(userIds: number[], message: string): Promise<void> {
    const notifications = userIds.map((userId) => ({ userId, message }));
    await this.notificationConnector.sendBatchNotifications(notifications);
  }

  private shouldSendNotification(user: KogotochkiUser, type: string): boolean {
    if (!user.notificationEnabled) {
      return false;
    }

    if (type === 'system') {
      return true;
    }

    const enabledCategories = user.notificationCategories || [];
    return enabledCategories.includes(type);
  }
}
