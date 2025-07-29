# Revenue Sharing Pattern

The Revenue Sharing Service provides a flexible, platform-agnostic solution for managing revenue distribution between your platform and partners. This pattern is ideal for marketplaces, SaaS platforms with resellers, content platforms with creators, or any system requiring automated revenue distribution.

## Features

- **Flexible Commission Structure**: Support for default rates, category-specific rates, tier-based rates, and partner-specific custom rates
- **Automated Transaction Tracking**: Record and track all revenue-generating transactions with full audit trail
- **Comprehensive Statistics**: Detailed analytics by partner, category, transaction type, and time period
- **Automated Payouts**: Configurable payout schedules with support for various payment methods
- **Platform-Agnostic**: Works with any storage backend and payment provider
- **Type-Safe**: Full TypeScript support with comprehensive interfaces

## Use Cases

### 1. Regional Marketplace

```typescript
// Configure for regional partners with different commission rates
const revenueService = new RevenueSharingService(db, {
  defaultCommissionRate: 0.2,
  tierRates: {
    gold: 0.15, // Better rate for gold partners
    silver: 0.2,
    bronze: 0.25,
  },
  minPayoutAmount: 100,
  payoutSchedule: 'monthly',
});

// Register regional partner
await revenueService.upsertPartner({
  externalId: 'partner_thailand',
  name: 'Thailand Regional Partner',
  region: 'TH',
  tier: 'gold',
  commissionRate: 0.15,
  agreementStartDate: new Date(),
  isActive: true,
});
```

### 2. Content Creator Platform

```typescript
// Configure for content creators with category-based rates
const revenueService = new RevenueSharingService(db, {
  defaultCommissionRate: 0.3,
  categoryRates: {
    video: 0.45, // Higher commission for video content
    article: 0.3,
    podcast: 0.4,
  },
  minPayoutAmount: 50,
  payoutSchedule: 'weekly',
  autoProcessPayouts: true,
});

// Register content creator
await revenueService.upsertPartner({
  externalId: 'creator_12345',
  name: 'John Doe',
  metadata: {
    channel: 'JohnDoeVideos',
    subscribers: 50000,
  },
  customRates: {
    sponsored: 0.6, // Higher rate for sponsored content
  },
  commissionRate: 0.45,
  agreementStartDate: new Date(),
  isActive: true,
});
```

### 3. SaaS Reseller Program

```typescript
// Configure for SaaS resellers
const revenueService = new RevenueSharingService(db, {
  defaultCommissionRate: 0.2,
  categoryRates: {
    enterprise: 0.3,
    business: 0.25,
    starter: 0.2,
  },
  requireApproval: true, // Manual payout approval
  minPayoutAmount: 500,
});

// Track subscription sale
await revenueService.recordTransaction({
  partnerExternalId: 'reseller_abc',
  transactionId: 'sub_xyz123',
  type: 'subscription',
  category: 'enterprise',
  amount: 5000, // $5000 annual subscription
  metadata: {
    customerId: 'cust_123',
    plan: 'enterprise_annual',
    duration: 12,
  },
});
```

## Implementation Guide

### 1. Basic Setup

```typescript
import { RevenueSharingService } from '@wireframe/revenue-sharing';
import { YourDatabaseAdapter } from './your-database';

const config = {
  defaultCommissionRate: 0.3,
  minPayoutAmount: 100,
  payoutSchedule: 'monthly',
  autoProcessPayouts: true,
};

const revenueService = new RevenueSharingService(new YourDatabaseAdapter(), config);
```

### 2. Recording Transactions

```typescript
// Option 1: Using partner ID
await revenueService.recordTransaction({
  partnerId: 'partner_123',
  transactionId: 'order_abc',
  type: 'sale',
  category: 'electronics',
  amount: 1000,
});

// Option 2: Using external ID
await revenueService.recordTransaction({
  partnerExternalId: 'telegram_775707',
  transactionId: 'bid_xyz',
  type: 'auction_bid',
  amount: 500,
  metadata: {
    auctionId: 'auction_123',
    position: 1,
  },
});
```

### 3. Getting Statistics

```typescript
const stats = await revenueService.getPartnerStats(
  'partner_123',
  new Date('2024-01-01'),
  new Date('2024-01-31'),
);

console.log({
  totalRevenue: stats.totalRevenue,
  totalCommission: stats.totalCommission,
  transactionCount: stats.transactionCount,
  byCategory: stats.byCategory,
});
```

### 4. Processing Payouts

```typescript
// Manual payout creation
const payout = await revenueService.createPayout(
  'partner_123',
  new Date('2024-01-01'),
  new Date('2024-01-31'),
);

// Automated payout processing with custom handler
await revenueService.processPayouts(async (payout) => {
  try {
    // Your payment logic here
    const result = await stripeClient.transfers.create({
      amount: payout.totalCommission,
      currency: 'usd',
      destination: getStripeAccountId(payout.partnerId),
    });

    return {
      success: true,
      method: 'stripe',
      details: { transferId: result.id },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});
```

## Storage Adapter Requirements

The service requires a storage adapter implementing the `IDatabaseStore` interface:

```typescript
interface IDatabaseStore {
  get<T>(key: string): Promise<T | null>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list<T>(prefix: string): Promise<T[]>;
}
```

### Example Adapters

#### Cloudflare KV

```typescript
class CloudflareKVAdapter implements IDatabaseStore {
  constructor(private kv: KVNamespace) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.kv.get(key);
    return value ? JSON.parse(value) : null;
  }

  async put<T>(key: string, value: T): Promise<void> {
    await this.kv.put(key, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }

  async list<T>(prefix: string): Promise<T[]> {
    const list = await this.kv.list({ prefix });
    const results: T[] = [];
    for (const key of list.keys) {
      const value = await this.get<T>(key.name);
      if (value) results.push(value);
    }
    return results;
  }
}
```

#### D1 Database

```typescript
class D1Adapter implements IDatabaseStore {
  constructor(private db: D1Database) {}

  // Implementation would map to SQL queries
  // This is a simplified example
  async get<T>(key: string): Promise<T | null> {
    const [type, id] = key.split(':');
    const result = await this.db
      .prepare(`SELECT data FROM kv_store WHERE key = ?`)
      .bind(key)
      .first();
    return result ? JSON.parse(result.data) : null;
  }

  // ... other methods
}
```

## Best Practices

1. **Commission Rate Hierarchy**
   - Partner custom rates (highest priority)
   - Category-specific rates
   - Tier-based rates
   - Default commission rate (lowest priority)

2. **Transaction Metadata**
   - Always include relevant metadata for audit trails
   - Use consistent transaction types across your platform
   - Include original transaction IDs for reference

3. **Payout Management**
   - Set appropriate minimum payout amounts to reduce transaction costs
   - Implement proper error handling in payment handlers
   - Keep detailed logs of all payout attempts

4. **Performance Considerations**
   - Implement proper indexing for transaction queries
   - Consider batching transactions for high-volume scenarios
   - Use caching for frequently accessed partner data

5. **Security**
   - Validate all commission rates are within expected ranges
   - Implement proper access controls for payout operations
   - Audit all revenue-related operations

## Migration from Existing Systems

If you're migrating from an existing revenue sharing system:

1. **Export existing data** in a structured format
2. **Map your data** to the Revenue Sharing Service models
3. **Import partners** first, maintaining their external IDs
4. **Import historical transactions** if needed for reporting
5. **Verify calculations** match your existing system
6. **Run in parallel** during transition period

## Extending the Service

The service can be extended for specific use cases:

```typescript
class CustomRevenueSharingService extends RevenueSharingService {
  // Add multi-currency support
  async recordTransactionMultiCurrency(transaction: {
    amount: number;
    currency: string;
    exchangeRate: number;
    // ... other fields
  }) {
    const amountInBaseCurrency = transaction.amount * transaction.exchangeRate;
    return super.recordTransaction({
      ...transaction,
      amount: amountInBaseCurrency,
      metadata: {
        ...transaction.metadata,
        originalCurrency: transaction.currency,
        exchangeRate: transaction.exchangeRate,
      },
    });
  }

  // Add tiered commission rates based on volume
  protected getCommissionRate(partner: RevenuePartner, category?: string, type?: string): number {
    const baseRate = super.getCommissionRate(partner, category, type);

    // Apply volume discount
    const monthlyVolume = await this.getMonthlyVolume(partner.id);
    if (monthlyVolume > 100000) return baseRate * 0.9;
    if (monthlyVolume > 50000) return baseRate * 0.95;

    return baseRate;
  }
}
```

## Conclusion

The Revenue Sharing Service provides a robust foundation for implementing partner revenue sharing in any platform. Its flexible architecture supports various business models while maintaining clean separation of concerns and type safety throughout.
