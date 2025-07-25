// Example integration for Wireframe platform

import type { INotificationService } from './notification.service.interface';
import type { INotificationConnector } from './notification-connector';
import { NotificationService } from './notification.service';
import { NotificationConnector } from './notification-connector';

// Example: Telegram integration
export class TelegramNotificationSetup {
  static async setup(
    telegramConnector: ITelegramConnector,
    userService: IUserService,
  ): Promise<INotificationService> {
    // Create notification connector
    const notificationConnector = new NotificationConnector(telegramConnector);
    
    // Create notification service
    const notificationService = new NotificationService(notificationConnector, userService);
    
    return notificationService;
  }
}

// Example: User preferences UI
export const NotificationSettingsKeyboard = {
  getKeyboard(user: { notificationEnabled: boolean; notificationCategories?: string[] }) {
    const categories = user.notificationCategories || [];
    
    return {
      inline_keyboard: [
        [
          {
            text: `${user.notificationEnabled ? '✅' : '❌'} All notifications`,
            callback_data: 'notification:toggle',
          },
        ],
        ...(user.notificationEnabled
          ? [
              [
                {
                  text: `${categories.includes('auction') ? '✅' : '⬜️'} Auction notifications`,
                  callback_data: 'notification:category:auction',
                },
              ],
              [
                {
                  text: `${categories.includes('balance') ? '✅' : '⬜️'} Balance changes`,
                  callback_data: 'notification:category:balance',
                },
              ],
              [
                {
                  text: `${categories.includes('service') ? '✅' : '⬜️'} Service status`,
                  callback_data: 'notification:category:service',
                },
              ],
              [
                {
                  text: `${categories.includes('system') ? '✅' : '⬜️'} System messages`,
                  callback_data: 'notification:category:system',
                },
              ],
            ]
          : []),
        [{ text: '← Back', callback_data: 'settings:main' }],
      ],
    };
  },
};

// Example: Database migration
export const notificationMigration = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_categories JSON;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_users_notifications 
ON users(notification_enabled) 
WHERE notification_enabled = true;
`;

// Example: Integration with event system
export class NotificationEventHandler {
  constructor(private notificationService: INotificationService) {}
  
  async handleAuctionComplete(event: AuctionCompleteEvent) {
    // Notify winners
    for (const winner of event.winners) {
      await this.notificationService.sendAuctionWinNotification(winner.userId, {
        userId: winner.userId,
        serviceId: winner.serviceId,
        categoryId: event.categoryId,
        position: winner.position as 1 | 2 | 3,
        bidAmount: winner.bidAmount,
        roundId: event.roundId,
        timestamp: new Date(),
      });
    }
    
    // Notify outbid users
    for (const loser of event.losers) {
      await this.notificationService.sendAuctionRefundNotification(
        loser.userId,
        event.categoryId,
        loser.bidAmount,
      );
    }
  }
}

// Type definitions for the example
interface ITelegramConnector {
  sendMessage(chatId: number, text: string): Promise<void>;
}

interface IUserService {
  getUsersWithNotificationCategory(category: string): Promise<Array<{ telegramId: number }>>;
  updateNotificationSettings(
    telegramId: number,
    enabled: boolean,
    categories?: string[],
  ): Promise<void>;
}

interface AuctionCompleteEvent {
  roundId: number;
  categoryId: string;
  winners: Array<{
    userId: number;
    serviceId: number;
    position: number;
    bidAmount: number;
  }>;
  losers: Array<{
    userId: number;
    bidAmount: number;
  }>;
}