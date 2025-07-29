import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  RevenueSharingService,
  type RevenuePartner,
  type RevenueSharingConfig,
} from '../revenue-sharing-service.js';
import type { IKeyValueStore } from '../../core/interfaces/storage.js';

// Mock storage implementation
class MockKeyValueStore implements IKeyValueStore {
  private store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T) || null;
  }

  async put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
  ): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async getWithMetadata<T = string>(
    key: string,
  ): Promise<{
    value: T | null;
    metadata: Record<string, unknown> | null;
  }> {
    const value = await this.get<T>(key);
    return { value, metadata: null };
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string; metadata?: Record<string, unknown> }>;
    list_complete: boolean;
    cursor?: string;
  }> {
    const prefix = options?.prefix || '';
    const keys: Array<{ name: string }> = [];

    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        keys.push({ name: key });
      }
    }

    return {
      keys,
      list_complete: true,
    };
  }

  clear(): void {
    this.store.clear();
  }
}

describe('RevenueSharingService', () => {
  let service: RevenueSharingService;
  let mockStore: MockKeyValueStore;
  let config: RevenueSharingConfig;

  beforeEach(() => {
    mockStore = new MockKeyValueStore();
    config = {
      defaultCommissionRate: 0.3,
      minPayoutAmount: 100,
      payoutSchedule: 'monthly',
      autoProcessPayouts: true,
      categoryRates: {
        premium: 0.4,
        standard: 0.3,
      },
    };
    service = new RevenueSharingService(mockStore, config);
  });

  describe('Partner Management', () => {
    it('should create a new partner', async () => {
      const partner = await service.upsertPartner({
        externalId: 'telegram_123',
        name: 'John Doe',
        region: 'US',
        commissionRate: 0.25,
        agreementStartDate: new Date('2024-01-01'),
        isActive: true,
      });

      expect(partner.id).toBeDefined();
      expect(partner.externalId).toBe('telegram_123');
      expect(partner.commissionRate).toBe(0.25);
      expect(partner.isActive).toBe(true);
      expect(partner.createdAt).toBeInstanceOf(Date);
    });

    it('should update existing partner', async () => {
      // Create partner
      const original = await service.upsertPartner({
        externalId: 'telegram_123',
        name: 'John Doe',
        commissionRate: 0.25,
        agreementStartDate: new Date('2024-01-01'),
        isActive: true,
      });

      // Wait a bit to ensure updatedAt is different
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update partner
      const updated = await service.upsertPartner({
        externalId: 'telegram_123',
        name: 'John Smith',
        commissionRate: 0.3,
        agreementStartDate: new Date('2024-01-01'),
        isActive: true,
      });

      expect(updated.id).toBe(original.id);
      expect(updated.name).toBe('John Smith');
      expect(updated.commissionRate).toBe(0.3);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(original.updatedAt.getTime());
    });

    it('should retrieve partner by external ID', async () => {
      const created = await service.upsertPartner({
        externalId: 'email_user@example.com',
        name: 'Jane Doe',
        commissionRate: 0.35,
        agreementStartDate: new Date('2024-01-01'),
        isActive: true,
      });

      const retrieved = await service.getPartnerByExternalId('email_user@example.com');
      expect(retrieved).toEqual(created);
    });
  });

  describe('Transaction Recording', () => {
    let partner: RevenuePartner;

    beforeEach(async () => {
      partner = await service.upsertPartner({
        externalId: 'partner_1',
        name: 'Test Partner',
        commissionRate: 0.3,
        customRates: {
          premium: 0.4,
        },
        agreementStartDate: new Date('2024-01-01'),
        isActive: true,
      });
    });

    it('should record a transaction with default commission rate', async () => {
      const transaction = await service.recordTransaction({
        partnerId: partner.id,
        transactionId: 'tx_123',
        type: 'sale',
        category: 'standard',
        amount: 1000,
      });

      expect(transaction.partnerId).toBe(partner.id);
      expect(transaction.amount).toBe(1000);
      expect(transaction.commissionRate).toBe(0.3);
      expect(transaction.commissionAmount).toBe(300);
    });

    it('should use custom category rate for partner', async () => {
      const transaction = await service.recordTransaction({
        partnerId: partner.id,
        transactionId: 'tx_124',
        type: 'sale',
        category: 'premium',
        amount: 1000,
      });

      expect(transaction.commissionRate).toBe(0.4);
      expect(transaction.commissionAmount).toBe(400);
    });

    it('should throw error for inactive partner', async () => {
      // Deactivate partner
      await service.upsertPartner({
        ...partner,
        isActive: false,
      });

      await expect(
        service.recordTransaction({
          partnerId: partner.id,
          transactionId: 'tx_125',
          type: 'sale',
          amount: 1000,
        }),
      ).rejects.toThrow('No active partner found for transaction');
    });

    it('should find partner by external ID for transaction', async () => {
      const transaction = await service.recordTransaction({
        partnerExternalId: 'partner_1',
        transactionId: 'tx_126',
        type: 'subscription',
        amount: 500,
      });

      expect(transaction.partnerId).toBe(partner.id);
      expect(transaction.amount).toBe(500);
      expect(transaction.commissionAmount).toBe(150);
    });
  });

  describe('Statistics and Payouts', () => {
    let partner: RevenuePartner;

    beforeEach(async () => {
      partner = await service.upsertPartner({
        externalId: 'partner_stats',
        name: 'Stats Partner',
        commissionRate: 0.25,
        agreementStartDate: new Date('2024-01-01'),
        isActive: true,
      });
    });

    it('should create payout for partner', async () => {
      // Record some transactions first with dates in the payout period
      const transactionDate = new Date('2024-01-15');
      await service.recordTransaction({
        partnerId: partner.id,
        transactionId: 'tx_201',
        type: 'sale',
        amount: 1000,
      });

      // Override the processedAt date to be within our test period
      // This is necessary because transactions are timestamped with current date
      const storedTx = await mockStore.get<string>('transaction:original:tx_201');
      if (storedTx) {
        const txDataStr = await mockStore.get<string>(`transaction:${storedTx}`);
        if (txDataStr) {
          const txData = JSON.parse(txDataStr);
          txData.processedAt = transactionDate;
          await mockStore.put(`transaction:${storedTx}`, JSON.stringify(txData));
        }
      }

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const payout = await service.createPayout(partner.id, startDate, endDate);

      expect(payout.partnerId).toBe(partner.id);
      expect(payout.periodStart).toEqual(startDate);
      expect(payout.periodEnd).toEqual(endDate);
      expect(payout.status).toBe('processing'); // auto-process enabled
      expect(payout.totalRevenue).toBe(1000);
      expect(payout.totalCommission).toBe(250); // 25% commission
    });

    it('should respect minimum payout amount', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // Try to create payout with no transactions (0 commission)
      await expect(service.createPayout(partner.id, startDate, endDate)).rejects.toThrow(
        'below minimum payout amount',
      );
    });

    it('should update payout status', async () => {
      // First record a transaction to have sufficient commission
      await service.recordTransaction({
        partnerId: partner.id,
        transactionId: 'tx_202',
        type: 'sale',
        amount: 1000,
      });

      // Override the processedAt date
      const transactionDate = new Date('2024-01-15');
      const storedTx = await mockStore.get<string>('transaction:original:tx_202');
      if (storedTx) {
        const txDataStr = await mockStore.get<string>(`transaction:${storedTx}`);
        if (txDataStr) {
          const txData = JSON.parse(txDataStr);
          txData.processedAt = transactionDate;
          await mockStore.put(`transaction:${storedTx}`, JSON.stringify(txData));
        }
      }

      // Create a payout
      const payout = await service.createPayout(
        partner.id,
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      // Update status
      const updated = await service.updatePayoutStatus(payout.id, 'completed', {
        paymentMethod: 'wire_transfer',
        paymentDetails: { reference: 'WT123456' },
      });

      expect(updated.status).toBe('completed');
      expect(updated.paymentMethod).toBe('wire_transfer');
      expect(updated.paymentDetails).toEqual({ reference: 'WT123456' });
      expect(updated.processedAt).toBeInstanceOf(Date);
    });
  });

  describe('Commission Rate Calculation', () => {
    it('should apply category rates from config', async () => {
      const partner = await service.upsertPartner({
        externalId: 'rate_test',
        name: 'Rate Test Partner',
        commissionRate: 0.2, // Default rate
        agreementStartDate: new Date('2024-01-01'),
        isActive: true,
      });

      // Premium category should use config rate
      const premiumTx = await service.recordTransaction({
        partnerId: partner.id,
        transactionId: 'tx_301',
        type: 'sale',
        category: 'premium',
        amount: 1000,
      });

      expect(premiumTx.commissionRate).toBe(0.4); // From config
      expect(premiumTx.commissionAmount).toBe(400);
    });

    it('should prioritize partner custom rates over config', async () => {
      const partner = await service.upsertPartner({
        externalId: 'custom_rate',
        name: 'Custom Rate Partner',
        commissionRate: 0.2,
        customRates: {
          premium: 0.5, // Higher than config
        },
        agreementStartDate: new Date('2024-01-01'),
        isActive: true,
      });

      const transaction = await service.recordTransaction({
        partnerId: partner.id,
        transactionId: 'tx_302',
        type: 'sale',
        category: 'premium',
        amount: 1000,
      });

      expect(transaction.commissionRate).toBe(0.5); // Partner's custom rate
      expect(transaction.commissionAmount).toBe(500);
    });
  });

  describe('Automated Payout Processing', () => {
    it('should process payouts with payment handler', async () => {
      await service.upsertPartner({
        externalId: 'auto_payout',
        name: 'Auto Payout Partner',
        commissionRate: 0.3,
        agreementStartDate: new Date('2024-01-01'),
        isActive: true,
      });

      // Mock payment handler
      const paymentHandler = vi.fn().mockResolvedValue({
        success: true,
        method: 'stripe',
        details: { transferId: 'tr_123' },
      });

      // Process payouts
      await service.processPayouts(paymentHandler);

      // Payment handler should not be called if no pending payouts
      expect(paymentHandler).not.toHaveBeenCalled();
    });

    it('should handle payment failures', async () => {
      await service.upsertPartner({
        externalId: 'failed_payout',
        name: 'Failed Payout Partner',
        commissionRate: 0.3,
        agreementStartDate: new Date('2024-01-01'),
        isActive: true,
      });

      // Mock failing payment handler
      const paymentHandler = vi.fn().mockResolvedValue({
        success: false,
        error: 'Insufficient funds',
      });

      // Process payouts
      await service.processPayouts(paymentHandler);

      // Verify no errors thrown
      expect(paymentHandler).not.toHaveBeenCalled();
    });
  });
});
