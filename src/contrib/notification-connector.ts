import type { ITelegramConnector } from '@/connectors/telegram/interfaces/telegram-connector.interface';
import { captureException, captureMessage } from '@/config/sentry';

export interface INotificationConnector {
  sendNotification(userId: number, message: string): Promise<boolean>;
  sendBatchNotifications(notifications: Array<{ userId: number; message: string }>): Promise<void>;
}

export class NotificationConnector implements INotificationConnector {
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private readonly BATCH_SIZE = 30;
  private readonly BATCH_DELAY = 1000;

  constructor(private readonly telegramConnector: ITelegramConnector) {}

  async sendNotification(userId: number, message: string): Promise<boolean> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await this.telegramConnector.sendMessage(userId, message);
        return true;
      } catch (error) {
        lastError = error as Error;

        // Check if error is due to user blocking the bot
        if (this.isUserBlockedError(error)) {
          captureMessage(`User ${userId} has blocked the bot`, 'info');
          return false;
        }

        // For other errors, retry
        if (attempt < this.MAX_RETRIES) {
          await this.delay(this.RETRY_DELAY * attempt);
        }
      }
    }

    // All retries failed
    if (lastError) {
      captureException(lastError, {
        userId,
        notificationType: 'single',
        retries: this.MAX_RETRIES,
      });
    }

    return false;
  }

  async sendBatchNotifications(
    notifications: Array<{ userId: number; message: string }>,
  ): Promise<void> {
    const results = {
      sent: 0,
      failed: 0,
      blocked: 0,
    };

    // Process in batches
    for (let i = 0; i < notifications.length; i += this.BATCH_SIZE) {
      const batch = notifications.slice(i, i + this.BATCH_SIZE);

      // Send batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map((notification) => this.sendNotificationWithTracking(notification)),
      );

      // Count results
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { success, blocked } = result.value;
          if (success) {
            results.sent++;
          } else if (blocked) {
            results.blocked++;
          } else {
            results.failed++;
          }
        } else {
          results.failed++;
        }
      });

      // Delay between batches to avoid rate limits
      if (i + this.BATCH_SIZE < notifications.length) {
        await this.delay(this.BATCH_DELAY);
      }
    }

    // Log batch results
    captureMessage(`Batch notification results: ${JSON.stringify(results)}`, 'info');
  }

  private async sendNotificationWithTracking(notification: {
    userId: number;
    message: string;
  }): Promise<{ success: boolean; blocked: boolean }> {
    try {
      const success = await this.sendNotification(notification.userId, notification.message);
      const blocked = !success && (await this.isUserBlocked(notification.userId));
      return { success, blocked };
    } catch (error) {
      captureException(error as Error, {
        userId: notification.userId,
        context: 'batch notification',
      });
      return { success: false, blocked: false };
    }
  }

  private isUserBlockedError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('blocked') ||
        message.includes('bot was blocked by the user') ||
        message.includes('user is deactivated') ||
        message.includes('chat not found')
      );
    }
    return false;
  }

  private async isUserBlocked(userId: number): Promise<boolean> {
    try {
      // Try to get chat info to check if user blocked the bot
      await this.telegramConnector.sendMessage(userId, '.');
      return false;
    } catch (error) {
      return this.isUserBlockedError(error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
