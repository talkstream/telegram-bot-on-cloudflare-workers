/**
 * Database fixtures and data generators for tests
 */

import { randomUUID } from 'crypto';

/**
 * Base fixture with common fields
 */
export interface BaseFixture {
  id?: number | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * User fixture
 */
export interface UserFixture extends BaseFixture {
  telegramId?: string;
  username?: string;
  displayName?: string;
  languageCode?: string;
  isPremium?: boolean;
  role?: string;
  settings?: Record<string, unknown>;
}

/**
 * Create a user fixture with defaults
 */
export function createUserFixture(overrides?: Partial<UserFixture>): UserFixture {
  const now = new Date().toISOString();
  return {
    id: overrides?.id ?? Math.floor(Math.random() * 1000000),
    telegramId: overrides?.telegramId ?? String(Math.floor(Math.random() * 1000000000)),
    username: overrides?.username ?? `user_${Math.random().toString(36).substr(2, 9)}`,
    displayName: overrides?.displayName ?? 'Test User',
    languageCode: overrides?.languageCode ?? 'en',
    isPremium: overrides?.isPremium ?? false,
    role: overrides?.role ?? 'user',
    settings: overrides?.settings ?? {},
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
    ...overrides,
  };
}

/**
 * Session fixture
 */
export interface SessionFixture extends BaseFixture {
  userId?: number | string;
  token?: string;
  data?: Record<string, unknown>;
  expiresAt?: Date | string;
}

/**
 * Create a session fixture
 */
export function createSessionFixture(overrides?: Partial<SessionFixture>): SessionFixture {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  return {
    id: overrides?.id ?? randomUUID(),
    userId: overrides?.userId ?? Math.floor(Math.random() * 1000000),
    token: overrides?.token ?? randomUUID(),
    data: overrides?.data ?? {},
    expiresAt: overrides?.expiresAt ?? expiresAt.toISOString(),
    createdAt: overrides?.createdAt ?? now.toISOString(),
    updatedAt: overrides?.updatedAt ?? now.toISOString(),
    ...overrides,
  };
}

/**
 * Transaction fixture
 */
export interface TransactionFixture extends BaseFixture {
  userId?: number | string;
  type?: string;
  amount?: number;
  currency?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a transaction fixture
 */
export function createTransactionFixture(
  overrides?: Partial<TransactionFixture>,
): TransactionFixture {
  const now = new Date().toISOString();

  return {
    id: overrides?.id ?? randomUUID(),
    userId: overrides?.userId ?? Math.floor(Math.random() * 1000000),
    type: overrides?.type ?? 'payment',
    amount: overrides?.amount ?? Math.floor(Math.random() * 10000),
    currency: overrides?.currency ?? 'USD',
    status: overrides?.status ?? 'completed',
    metadata: overrides?.metadata ?? {},
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
    ...overrides,
  };
}

/**
 * Bulk fixture generator
 */
export class FixtureGenerator<T> {
  constructor(private factory: (overrides?: Partial<T>) => T) {}

  /**
   * Generate multiple fixtures
   */
  createMany(count: number, overrides?: Partial<T> | ((index: number) => Partial<T>)): T[] {
    return Array.from({ length: count }, (_, index) => {
      const override = typeof overrides === 'function' ? overrides(index) : overrides;
      return this.factory(override);
    });
  }

  /**
   * Generate fixtures with relationships
   */
  createWithRelations<R>(
    count: number,
    relationFactory: (parent: T, index: number) => R,
  ): Array<{ parent: T; relations: R[] }> {
    return Array.from({ length: count }, () => {
      const parent = this.factory();
      const relations = Array.from({ length: Math.floor(Math.random() * 5) + 1 }, (_, relIndex) =>
        relationFactory(parent, relIndex),
      );
      return { parent, relations };
    });
  }
}

/**
 * Database seeder for test environments
 */
export class TestDatabaseSeeder {
  private fixtures: Map<string, unknown[]> = new Map();

  /**
   * Add fixtures to be seeded
   */
  add(table: string, data: unknown[]): this {
    this.fixtures.set(table, data);
    return this;
  }

  /**
   * Generate SQL statements for seeding
   */
  generateSQL(): string[] {
    const statements: string[] = [];

    for (const [table, rows] of this.fixtures) {
      for (const row of rows) {
        const data = row as Record<string, unknown>;
        const columns = Object.keys(data);
        const values = Object.values(data).map((v) =>
          typeof v === 'string' ? `'${v}'` : String(v),
        );

        statements.push(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});`,
        );
      }
    }

    return statements;
  }

  /**
   * Clear all fixtures
   */
  clear(): void {
    this.fixtures.clear();
  }
}

/**
 * Common test data sets
 */
export const TEST_DATA = {
  users: {
    admin: createUserFixture({
      id: 1,
      telegramId: '123456789',
      username: 'admin',
      displayName: 'Admin User',
      role: 'admin',
    }),
    regular: createUserFixture({
      id: 2,
      telegramId: '987654321',
      username: 'user1',
      displayName: 'Regular User',
      role: 'user',
    }),
    premium: createUserFixture({
      id: 3,
      telegramId: '456789123',
      username: 'premium_user',
      displayName: 'Premium User',
      role: 'user',
      isPremium: true,
    }),
  },

  timestamps: {
    past: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
    now: new Date().toISOString(),
    future: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week later
  },
};
