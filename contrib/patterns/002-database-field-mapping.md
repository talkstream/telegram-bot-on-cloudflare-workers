# Pattern: Type-Safe Database Field Mapping

## Problem

Critical production bug in Kogotochki bot:

- User selected region/district
- Data saved to database correctly
- On next request, region_id was undefined
- Root cause: Database uses `snake_case`, TypeScript uses `camelCase`
- TypeScript showed no errors (false type safety)

## Solution

Explicit database row types with manual mapping:

```typescript
// File: src/types/database.ts

// Database row types match exact DB schema
export interface UserDatabaseRow {
  id: number
  telegram_id: number
  username?: string
  first_name?: string
  last_name?: string
  region_id?: string
  district_id?: string
  is_active: number // D1 stores boolean as 0/1
  is_master: number
  created_at: string
  updated_at: string
}

export interface RegionDatabaseRow {
  id: string
  name: string
  slug: string
  is_active: number
  display_order: number
}

// Domain types use camelCase
export interface User {
  id: number
  telegramId: number
  username?: string
  firstName?: string
  lastName?: string
  regionId?: string
  districtId?: string
  isActive: boolean
  isMaster: boolean
  createdAt: Date
  updatedAt: Date
}
```

## Service Implementation

```typescript
// File: src/services/user.service.ts
export class UserService {
  constructor(private db: IDatabaseStore) {}

  async getUserByTelegramId(telegramId: number): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE telegram_id = ?')
      .bind(telegramId)
      .first<UserDatabaseRow>()

    if (!result) return null

    // Explicit mapping - compiler catches typos
    return this.mapDatabaseRowToUser(result)
  }

  private mapDatabaseRowToUser(row: UserDatabaseRow): User {
    return {
      id: row.id,
      telegramId: row.telegram_id,
      username: row.username,
      firstName: row.first_name,
      lastName: row.last_name,
      regionId: row.region_id,
      districtId: row.district_id,
      isActive: row.is_active === 1,
      isMaster: row.is_master === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }
  }

  private mapUserToDatabaseRow(user: Partial<User>): Partial<UserDatabaseRow> {
    const row: Partial<UserDatabaseRow> = {}

    if (user.telegramId !== undefined) row.telegram_id = user.telegramId
    if (user.username !== undefined) row.username = user.username
    if (user.firstName !== undefined) row.first_name = user.firstName
    if (user.lastName !== undefined) row.last_name = user.lastName
    if (user.regionId !== undefined) row.region_id = user.regionId
    if (user.districtId !== undefined) row.district_id = user.districtId
    if (user.isActive !== undefined) row.is_active = user.isActive ? 1 : 0
    if (user.isMaster !== undefined) row.is_master = user.isMaster ? 1 : 0

    return row
  }

  async updateUser(telegramId: number, updates: Partial<User>): Promise<void> {
    const dbUpdates = this.mapUserToDatabaseRow(updates)

    const setClause = Object.keys(dbUpdates)
      .map(key => `${key} = ?`)
      .join(', ')

    const values = Object.values(dbUpdates)
    values.push(telegramId) // for WHERE clause

    await this.db
      .prepare(`UPDATE users SET ${setClause}, updated_at = datetime('now') WHERE telegram_id = ?`)
      .bind(...values)
      .run()
  }
}
```

## Generic Mapping Utilities

```typescript
// File: src/lib/database/field-mapper.ts
export class FieldMapper<TDatabase, TDomain> {
  constructor(
    private mappings: Array<{
      dbField: keyof TDatabase
      domainField: keyof TDomain
      toDb?: (value: any) => any
      toDomain?: (value: any) => any
    }>
  ) {}

  toDomain(dbRow: TDatabase): TDomain {
    const result = {} as TDomain

    for (const mapping of this.mappings) {
      const dbValue = dbRow[mapping.dbField]
      if (dbValue !== undefined) {
        const value = mapping.toDomain ? mapping.toDomain(dbValue) : dbValue
        ;(result as any)[mapping.domainField] = value
      }
    }

    return result
  }

  toDatabase(domain: Partial<TDomain>): Partial<TDatabase> {
    const result = {} as Partial<TDatabase>

    for (const mapping of this.mappings) {
      const domainValue = domain[mapping.domainField]
      if (domainValue !== undefined) {
        const value = mapping.toDb ? mapping.toDb(domainValue) : domainValue
        ;(result as any)[mapping.dbField] = value
      }
    }

    return result
  }
}

// Example usage
const userMapper = new FieldMapper<UserDatabaseRow, User>([
  { dbField: 'id', domainField: 'id' },
  { dbField: 'telegram_id', domainField: 'telegramId' },
  { dbField: 'first_name', domainField: 'firstName' },
  {
    dbField: 'is_active',
    domainField: 'isActive',
    toDomain: v => v === 1,
    toDb: v => (v ? 1 : 0)
  },
  {
    dbField: 'created_at',
    domainField: 'createdAt',
    toDomain: v => new Date(v),
    toDb: v => v.toISOString()
  }
])
```

## Testing

```typescript
// File: src/services/__tests__/field-mapping.test.ts
describe('Database Field Mapping', () => {
  it('should map snake_case to camelCase', () => {
    const dbRow: UserDatabaseRow = {
      id: 1,
      telegram_id: 123456,
      first_name: 'John',
      region_id: 'us-west',
      is_active: 1,
      is_master: 0,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    const user = mapDatabaseRowToUser(dbRow)

    expect(user.telegramId).toBe(123456)
    expect(user.firstName).toBe('John')
    expect(user.regionId).toBe('us-west')
    expect(user.isActive).toBe(true)
    expect(user.isMaster).toBe(false)
  })

  it('should handle undefined fields correctly', () => {
    const dbRow: UserDatabaseRow = {
      id: 1,
      telegram_id: 123456,
      is_active: 1,
      is_master: 0,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    const user = mapDatabaseRowToUser(dbRow)

    expect(user.firstName).toBeUndefined()
    expect(user.regionId).toBeUndefined()
  })

  it('should convert booleans to 0/1 for database', () => {
    const updates: Partial<User> = {
      isActive: false,
      isMaster: true
    }

    const dbUpdates = mapUserToDatabaseRow(updates)

    expect(dbUpdates.is_active).toBe(0)
    expect(dbUpdates.is_master).toBe(1)
  })
})
```

## Common Pitfalls to Avoid

1. **Never use type assertions**:

   ```typescript
   // ❌ BAD - hides field name mismatches
   const user = dbRow as User

   // ✅ GOOD - explicit mapping
   const user = mapDatabaseRowToUser(dbRow)
   ```

2. **Handle NULL vs undefined**:

   ```typescript
   // D1 returns null for missing values
   firstName: row.first_name || undefined,
   ```

3. **JSON fields need parsing**:
   ```typescript
   metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
   ```

## Why This is Critical

1. **Data Integrity**: Prevents silent data loss
2. **Type Safety**: Real compile-time checking
3. **Maintenance**: Schema changes are caught immediately
4. **D1 Compatibility**: Handles D1-specific quirks (0/1 booleans)

## Implementation Checklist

- [ ] Create database row types for all tables
- [ ] Add mapping functions to services
- [ ] Remove all `as Type` assertions
- [ ] Add unit tests for mappings
- [ ] Document D1-specific conversions
