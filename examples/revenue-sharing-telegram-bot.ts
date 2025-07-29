/**
 * Example: Revenue Sharing in a Telegram Bot Marketplace
 *
 * This example shows how to integrate the Revenue Sharing Service
 * with a Telegram bot that runs daily auctions for service providers.
 */

import { RevenueSharingService } from '../src/services/revenue-sharing-service.js';
import type { IKeyValueStore } from '../src/core/interfaces/storage.js';
import type { ITelegramConnector } from '../src/connectors/messaging/telegram/telegram-connector.js';

// Example: Beauty services marketplace bot
export class MarketplaceBotWithRevenue {
  private revenueService: RevenueSharingService;

  constructor(
    private kv: IKeyValueStore,
    private telegram: ITelegramConnector,
  ) {
    // Initialize revenue service with marketplace-specific config
    this.revenueService = new RevenueSharingService(kv, {
      defaultCommissionRate: 0.2, // 20% platform fee
      categoryRates: {
        nails: 0.15, // Lower fee for nail services
        hair: 0.2, // Standard fee
        massage: 0.25, // Higher fee for massage services
      },
      minPayoutAmount: 1000, // Minimum 1000 stars for payout
      payoutSchedule: 'weekly',
      autoProcessPayouts: true,
    });
  }

  /**
   * Register a regional partner (e.g., someone who brings providers to the platform)
   */
  async registerPartner(command: {
    userId: number;
    username?: string;
    firstName?: string;
    region: string;
  }): Promise<void> {
    try {
      const partner = await this.revenueService.upsertPartner({
        externalId: `telegram_${command.userId}`,
        name: command.firstName || command.username || `Partner ${command.userId}`,
        metadata: {
          telegramId: command.userId,
          username: command.username,
        },
        region: command.region,
        commissionRate: 0.5, // 50% of platform fee goes to partner
        agreementStartDate: new Date(),
        isActive: true,
      });

      await this.telegram.api.sendMessage(
        command.userId,
        `✅ You are now a registered partner for region: ${command.region}\n` +
          `Commission rate: 50% of platform fees\n` +
          `Partner ID: ${partner.id}`,
      );
    } catch (error) {
      await this.telegram.api.sendMessage(
        command.userId,
        '❌ Failed to register as partner. Please contact support.',
      );
    }
  }

  /**
   * Process auction winner payment and record revenue
   */
  async processAuctionPayment(payment: {
    providerId: number;
    auctionId: string;
    categoryId: string;
    bidAmount: number; // in Telegram Stars
    region: string;
    position: number; // 1, 2, or 3
  }): Promise<void> {
    try {
      // Charge the provider (this would integrate with Telegram Stars API)
      const transactionId = await this.chargeProvider(payment.providerId, payment.bidAmount);

      // Record transaction for revenue sharing
      const transaction = await this.revenueService.recordTransaction({
        partnerExternalId: await this.getPartnerExternalIdForRegion(payment.region),
        transactionId,
        type: 'auction_bid',
        category: payment.categoryId,
        amount: payment.bidAmount,
        metadata: {
          auctionId: payment.auctionId,
          providerId: payment.providerId,
          position: payment.position,
          region: payment.region,
        },
      });

      // Notify provider
      await this.telegram.api.sendMessage(
        payment.providerId,
        `✅ Payment successful!\n` +
          `Amount: ${payment.bidAmount} stars\n` +
          `Position: #${payment.position}\n` +
          `Transaction: ${transactionId}`,
      );

      // Log for analytics
      console.log('Auction payment processed:', {
        transactionId,
        revenue: payment.bidAmount,
        platformFee: payment.bidAmount * 0.2,
        partnerCommission: transaction.commissionAmount,
      });
    } catch (error) {
      console.error('Failed to process auction payment:', error);
      throw error;
    }
  }

  /**
   * Show partner dashboard
   */
  async showPartnerDashboard(userId: number): Promise<void> {
    try {
      const partner = await this.revenueService.getPartnerByExternalId(`telegram_${userId}`);
      if (!partner) {
        await this.telegram.api.sendMessage(userId, '❌ You are not a registered partner.');
        return;
      }

      // Get current month stats
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const stats = await this.revenueService.getPartnerStats(partner.id, startOfMonth, now);

      const message =
        `📊 *Partner Dashboard*\n\n` +
        `Region: ${partner.region}\n` +
        `Status: ${partner.isActive ? '✅ Active' : '❌ Inactive'}\n\n` +
        `*This Month:*\n` +
        `Total Revenue: ${stats.totalRevenue} stars\n` +
        `Your Commission: ${stats.totalCommission} stars\n` +
        `Transactions: ${stats.transactionCount}\n\n` +
        `*By Category:*\n` +
        Object.entries(stats.byCategory || {})
          .map(
            ([category, data]) =>
              `${category}: ${data.commission} stars (${data.count} transactions)`,
          )
          .join('\n');

      await this.telegram.api.sendMessage(userId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Failed to show partner dashboard:', error);
      await this.telegram.api.sendMessage(userId, '❌ Failed to load dashboard.');
    }
  }

  /**
   * Process weekly payouts for all partners
   */
  async processWeeklyPayouts(): Promise<void> {
    console.log('Starting weekly payout processing...');

    await this.revenueService.processPayouts(async (payout) => {
      try {
        // Get partner details
        const partner = await this.revenueService.getPartner(payout.partnerId);
        if (!partner?.metadata?.telegramId) {
          throw new Error('Partner missing Telegram ID');
        }

        const telegramId = partner.metadata.telegramId as number;

        // Send payout via Telegram Stars (this would use actual Stars API)
        const transferResult = await this.sendStarsToUser(
          telegramId,
          Math.floor(payout.totalCommission),
        );

        // Notify partner
        await this.telegram.api.sendMessage(
          telegramId,
          `💰 *Payout Processed!*\n\n` +
            `Period: ${payout.periodStart.toLocaleDateString()} - ${payout.periodEnd.toLocaleDateString()}\n` +
            `Amount: ${payout.totalCommission} stars\n` +
            `Transactions: ${payout.transactionCount}\n` +
            `Status: ✅ Completed\n` +
            `Reference: ${transferResult.transferId}`,
          { parse_mode: 'Markdown' },
        );

        return {
          success: true,
          method: 'telegram_stars',
          details: {
            transferId: transferResult.transferId,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (error) {
        console.error('Payout failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  /**
   * Admin command to view platform statistics
   */
  async showPlatformStats(adminUserId: number): Promise<void> {
    // This would include comprehensive platform-wide statistics
    // Including total revenue, partner commissions, etc.
    const message =
      `📈 *Platform Revenue Stats*\n\n` +
      `Total Revenue (Month): X stars\n` +
      `Platform Fees: X stars\n` +
      `Partner Commissions: X stars\n` +
      `Active Partners: X\n` +
      `Pending Payouts: X`;

    await this.telegram.api.sendMessage(adminUserId, message, { parse_mode: 'Markdown' });
  }

  // Helper methods

  private async getPartnerExternalIdForRegion(region: string): Promise<string | undefined> {
    // In real implementation, this would look up the partner assigned to a region
    // For now, returning undefined means platform keeps all revenue
    return undefined;
  }

  private async chargeProvider(providerId: number, amount: number): Promise<string> {
    // This would integrate with Telegram Stars API
    // For example purposes, generating a mock transaction ID
    return `stars_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async sendStarsToUser(userId: number, amount: number): Promise<{ transferId: string }> {
    // This would use Telegram Stars API to send stars to user
    // Mock implementation
    return {
      transferId: `transfer_${Date.now()}_${userId}`,
    };
  }
}

// Helper function for admin check
function isAdmin(userId: number): boolean {
  // In real implementation, check against admin list
  return userId === 775707; // Example admin ID
}

// Example usage in bot commands (pseudo-code)
export function setupRevenueCommands(bot: MarketplaceBotWithRevenue) {
  // This is pseudo-code to demonstrate the integration
  // In real implementation, you would use your bot framework's command handler
  // Example: Partner registration command
  // bot.command('partner_register', async (ctx) => { ... });
  // Example: Partner dashboard command
  // bot.command('partner_stats', async (ctx) => { ... });
  // Example: Admin revenue stats
  // bot.command('admin_revenue', async (ctx) => { ... });
}

// Scheduled job for weekly payouts
export function setupPayoutSchedule(bot: MarketplaceBotWithRevenue) {
  // This would be called by your scheduler (e.g., Cloudflare Cron Trigger)
  return async () => {
    await bot.processWeeklyPayouts();
  };
}
