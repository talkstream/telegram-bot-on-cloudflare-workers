/**
 * Revenue Sharing Service
 *
 * Platform-agnostic service for managing revenue sharing between platform and partners.
 * Supports flexible commission structures, automated payouts, and comprehensive tracking.
 *
 * Use cases:
 * - Marketplace platforms with regional partners
 * - SaaS platforms with resellers
 * - Content platforms with creators
 * - Any platform requiring revenue distribution
 */

import type { IKeyValueStore } from '../core/interfaces/storage.js';
import { logger } from '../lib/logger.js';

export interface RevenuePartner {
  id: string;
  externalId: string; // External identifier (e.g., Telegram ID, email, etc.)
  name: string;
  metadata?: Record<string, unknown>; // Platform-specific data
  region?: string;
  tier?: string;
  commissionRate: number; // Decimal (0.5 = 50%)
  customRates?: Record<string, number>; // Category/product-specific rates
  agreementStartDate: Date;
  agreementEndDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RevenueTransaction {
  id: string;
  partnerId: string;
  transactionId: string; // Original transaction ID
  type: string; // sale, subscription, bid, etc.
  category?: string;
  amount: number;
  commissionRate: number;
  commissionAmount: number;
  metadata?: Record<string, unknown>;
  processedAt: Date;
}

export interface RevenuePayout {
  id: string;
  partnerId: string;
  periodStart: Date;
  periodEnd: Date;
  totalRevenue: number;
  totalCommission: number;
  transactionCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  paymentMethod?: string;
  paymentDetails?: Record<string, unknown>;
  processedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RevenueStats {
  partnerId: string;
  period: {
    start: Date;
    end: Date;
  };
  totalRevenue: number;
  totalCommission: number;
  transactionCount: number;
  byCategory?: Record<
    string,
    {
      revenue: number;
      commission: number;
      count: number;
    }
  >;
  byType?: Record<
    string,
    {
      revenue: number;
      commission: number;
      count: number;
    }
  >;
}

export interface RevenueSharingConfig {
  defaultCommissionRate: number;
  minPayoutAmount?: number;
  payoutSchedule?: 'daily' | 'weekly' | 'monthly' | 'manual';
  autoProcessPayouts?: boolean;
  requireApproval?: boolean;
  categoryRates?: Record<string, number>;
  tierRates?: Record<string, number>;
}

export class RevenueSharingService {
  constructor(
    private kv: IKeyValueStore,
    private config: RevenueSharingConfig = { defaultCommissionRate: 0.3 },
  ) {}

  /**
   * Register or update a revenue partner
   */
  async upsertPartner(
    partner: Omit<RevenuePartner, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<RevenuePartner> {
    const existingPartner = await this.getPartnerByExternalId(partner.externalId);

    if (existingPartner) {
      // Update existing partner
      const updated: RevenuePartner = {
        ...existingPartner,
        ...partner,
        updatedAt: new Date(),
      };

      await this.kv.put(`partner:${existingPartner.id}`, JSON.stringify(updated));

      logger.info('Revenue partner updated', {
        partnerId: existingPartner.id,
        externalId: partner.externalId,
      });

      return updated;
    } else {
      // Create new partner
      const newPartner: RevenuePartner = {
        ...partner,
        id: this.generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.kv.put(`partner:${newPartner.id}`, JSON.stringify(newPartner));
      await this.kv.put(`partner:external:${partner.externalId}`, newPartner.id);

      logger.info('Revenue partner created', {
        partnerId: newPartner.id,
        externalId: partner.externalId,
      });

      return newPartner;
    }
  }

  /**
   * Record a revenue transaction
   */
  async recordTransaction(transaction: {
    partnerId?: string;
    partnerExternalId?: string;
    transactionId: string;
    type: string;
    category?: string;
    amount: number;
    metadata?: Record<string, unknown>;
  }): Promise<RevenueTransaction> {
    // Find partner
    let partner: RevenuePartner | null = null;

    if (transaction.partnerId) {
      partner = await this.getPartner(transaction.partnerId);
    } else if (transaction.partnerExternalId) {
      partner = await this.getPartnerByExternalId(transaction.partnerExternalId);
    }

    if (!partner || !partner.isActive) {
      logger.debug('No active partner for transaction', {
        transactionId: transaction.transactionId,
        partnerId: transaction.partnerId,
      });
      throw new Error('No active partner found for transaction');
    }

    // Calculate commission
    const commissionRate = this.getCommissionRate(partner, transaction.category, transaction.type);
    const commissionAmount = Math.floor(transaction.amount * commissionRate);

    // Record transaction
    const revenueTransaction: RevenueTransaction = {
      id: this.generateId(),
      partnerId: partner.id,
      transactionId: transaction.transactionId,
      type: transaction.type,
      category: transaction.category,
      amount: transaction.amount,
      commissionRate,
      commissionAmount,
      metadata: transaction.metadata,
      processedAt: new Date(),
    };

    await this.kv.put(`transaction:${revenueTransaction.id}`, JSON.stringify(revenueTransaction));
    await this.kv.put(`transaction:original:${transaction.transactionId}`, revenueTransaction.id);

    logger.info('Revenue transaction recorded', {
      transactionId: revenueTransaction.id,
      partnerId: partner.id,
      amount: transaction.amount,
      commission: commissionAmount,
    });

    return revenueTransaction;
  }

  /**
   * Get partner statistics for a period
   */
  async getPartnerStats(partnerId: string, startDate: Date, endDate: Date): Promise<RevenueStats> {
    const transactions = await this.getPartnerTransactions(partnerId, startDate, endDate);

    const stats: RevenueStats = {
      partnerId,
      period: { start: startDate, end: endDate },
      totalRevenue: 0,
      totalCommission: 0,
      transactionCount: transactions.length,
      byCategory: {},
      byType: {},
    };

    for (const transaction of transactions) {
      stats.totalRevenue += transaction.amount;
      stats.totalCommission += transaction.commissionAmount;

      // By category
      if (transaction.category && stats.byCategory) {
        if (!stats.byCategory[transaction.category]) {
          stats.byCategory[transaction.category] = { revenue: 0, commission: 0, count: 0 };
        }
        const categoryStats = stats.byCategory[transaction.category];
        if (categoryStats) {
          categoryStats.revenue += transaction.amount;
          categoryStats.commission += transaction.commissionAmount;
          categoryStats.count += 1;
        }
      }

      // By type
      if (stats.byType) {
        if (!stats.byType[transaction.type]) {
          stats.byType[transaction.type] = { revenue: 0, commission: 0, count: 0 };
        }
        const typeStats = stats.byType[transaction.type];
        if (typeStats) {
          typeStats.revenue += transaction.amount;
          typeStats.commission += transaction.commissionAmount;
          typeStats.count += 1;
        }
      }
    }

    return stats;
  }

  /**
   * Create a payout for a partner
   */
  async createPayout(partnerId: string, startDate: Date, endDate: Date): Promise<RevenuePayout> {
    const stats = await this.getPartnerStats(partnerId, startDate, endDate);

    // Check minimum payout amount
    if (this.config.minPayoutAmount && stats.totalCommission < this.config.minPayoutAmount) {
      throw new Error(
        `Commission amount ${stats.totalCommission} is below minimum payout amount ${this.config.minPayoutAmount}`,
      );
    }

    const payout: RevenuePayout = {
      id: this.generateId(),
      partnerId,
      periodStart: startDate,
      periodEnd: endDate,
      totalRevenue: stats.totalRevenue,
      totalCommission: stats.totalCommission,
      transactionCount: stats.transactionCount,
      status: this.config.requireApproval ? 'pending' : 'processing',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.kv.put(`payout:${payout.id}`, JSON.stringify(payout));

    logger.info('Payout created', {
      payoutId: payout.id,
      partnerId,
      amount: stats.totalCommission,
      status: payout.status,
    });

    return payout;
  }

  /**
   * Update payout status
   */
  async updatePayoutStatus(
    payoutId: string,
    status: RevenuePayout['status'],
    details?: {
      paymentMethod?: string;
      paymentDetails?: Record<string, unknown>;
      notes?: string;
    },
  ): Promise<RevenuePayout> {
    const payout = await this.getPayout(payoutId);
    if (!payout) {
      throw new Error(`Payout ${payoutId} not found`);
    }

    const updatedPayout: RevenuePayout = {
      ...payout,
      status,
      paymentMethod: details?.paymentMethod || payout.paymentMethod,
      paymentDetails: details?.paymentDetails || payout.paymentDetails,
      notes: details?.notes || payout.notes,
      processedAt: status === 'completed' ? new Date() : payout.processedAt,
      updatedAt: new Date(),
    };

    await this.kv.put(`payout:${payoutId}`, JSON.stringify(updatedPayout));

    logger.info('Payout status updated', {
      payoutId,
      status,
      previousStatus: payout.status,
    });

    return updatedPayout;
  }

  /**
   * Process pending payouts automatically
   */
  async processPayouts(
    paymentHandler?: (payout: RevenuePayout) => Promise<{
      success: boolean;
      method?: string;
      details?: Record<string, unknown>;
      error?: string;
    }>,
  ): Promise<void> {
    if (!this.config.autoProcessPayouts) {
      logger.debug('Auto-process payouts is disabled');
      return;
    }

    const pendingPayouts = await this.getPendingPayouts();

    for (const payout of pendingPayouts) {
      try {
        if (paymentHandler) {
          const result = await paymentHandler(payout);

          if (result.success) {
            await this.updatePayoutStatus(payout.id, 'completed', {
              paymentMethod: result.method,
              paymentDetails: result.details,
            });
          } else {
            await this.updatePayoutStatus(payout.id, 'failed', {
              notes: result.error || 'Payment processing failed',
            });
          }
        } else {
          // Mark as processing if no handler provided
          await this.updatePayoutStatus(payout.id, 'processing');
        }
      } catch (error) {
        logger.error('Failed to process payout', {
          payoutId: payout.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        await this.updatePayoutStatus(payout.id, 'failed', {
          notes: error instanceof Error ? error.message : 'Processing error',
        });
      }
    }
  }

  /**
   * Get partner by ID
   */
  async getPartner(partnerId: string): Promise<RevenuePartner | null> {
    const data = await this.kv.get<string>(`partner:${partnerId}`);
    if (!data) return null;

    const partner = JSON.parse(data);
    // Convert date strings back to Date objects
    // eslint-disable-next-line db-mapping/use-field-mapper
    return {
      ...partner,
      agreementStartDate: new Date(partner.agreementStartDate),
      agreementEndDate: partner.agreementEndDate ? new Date(partner.agreementEndDate) : undefined,
      createdAt: new Date(partner.createdAt),
      updatedAt: new Date(partner.updatedAt),
    };
  }

  /**
   * Get partner by external ID
   */
  async getPartnerByExternalId(externalId: string): Promise<RevenuePartner | null> {
    const partnerId = await this.kv.get<string>(`partner:external:${externalId}`);
    if (!partnerId) return null;

    return await this.getPartner(partnerId);
  }

  /**
   * Get partner transactions for a period
   */
  private async getPartnerTransactions(
    partnerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<RevenueTransaction[]> {
    // This is a simplified implementation
    // In production, you'd want to use proper database queries
    const transactions: RevenueTransaction[] = [];

    // For now, scan all stored transactions (inefficient, but works for demo/tests)
    // In production, use proper indexing and queries
    const listResult = await this.kv.list({ prefix: 'transaction:' });

    for (const { name: key } of listResult.keys) {
      if (!key.startsWith('transaction:') || key.includes(':original:')) continue;

      const data = await this.kv.get<string>(key);
      if (data) {
        const transaction: RevenueTransaction = JSON.parse(data);
        if (
          transaction.partnerId === partnerId &&
          new Date(transaction.processedAt) >= startDate &&
          new Date(transaction.processedAt) <= endDate
        ) {
          transactions.push(transaction);
        }
      }
    }

    logger.debug('Getting partner transactions', {
      partnerId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      count: transactions.length,
    });

    return transactions;
  }

  /**
   * Get pending payouts
   */
  private async getPendingPayouts(): Promise<RevenuePayout[]> {
    // This would need proper implementation based on storage adapter
    logger.debug('Getting pending payouts');
    return [];
  }

  /**
   * Get payout by ID
   */
  private async getPayout(payoutId: string): Promise<RevenuePayout | null> {
    const data = await this.kv.get<string>(`payout:${payoutId}`);
    if (!data) return null;

    const payout = JSON.parse(data);
    // Convert date strings back to Date objects
    // eslint-disable-next-line db-mapping/use-field-mapper
    return {
      ...payout,
      periodStart: new Date(payout.periodStart),
      periodEnd: new Date(payout.periodEnd),
      processedAt: payout.processedAt ? new Date(payout.processedAt) : undefined,
      createdAt: new Date(payout.createdAt),
      updatedAt: new Date(payout.updatedAt),
    };
  }

  /**
   * Get commission rate for a transaction
   */
  private getCommissionRate(partner: RevenuePartner, category?: string, _type?: string): number {
    // Check custom rates first
    if (category && partner.customRates && category in partner.customRates) {
      const rate = partner.customRates[category];
      if (rate !== undefined) return rate;
    }

    // Check category rates in config
    if (category && this.config.categoryRates && category in this.config.categoryRates) {
      const rate = this.config.categoryRates[category];
      if (rate !== undefined) return rate;
    }

    // Check tier rates
    if (partner.tier && this.config.tierRates && partner.tier in this.config.tierRates) {
      const rate = this.config.tierRates[partner.tier];
      if (rate !== undefined) return rate;
    }

    // Use partner default rate
    return partner.commissionRate;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
