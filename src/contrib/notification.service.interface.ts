import type { AuctionResult } from '@/domain/models/kogotochki/auction-result.model';

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
