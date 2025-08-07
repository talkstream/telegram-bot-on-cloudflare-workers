# Pattern: Type-Safe Database Field Mapping

## Problem

In production with Kogotochki bot, we discovered a critical bug where database fields in snake_case (e.g., `provider_id`, `telegram_id`) were being accessed as camelCase in TypeScript code, causing undefined values and breaking functionality.

## Root Cause

Database schemas often use snake_case naming convention while TypeScript/JavaScript uses camelCase. Without explicit mapping, queries return data with snake_case fields but code expects camelCase, leading to:

- Undefined property access
- Silent failures in production
- Type safety false positives

## Solution

Implement explicit database row types and mapping functions:

### 1. Define Database Row Types

```typescript
// File: src/types/database.ts

// Database row type matching actual DB schema
export interface ServiceDatabaseRow {
  id: number
  provider_id: number
  category_id: string
  region_id: string
  district_id: string
  title: string
  description: string
  price_from: number
  contact_info: string
  is_active: number // 0 or 1 in SQLite
  created_at: string
  updated_at: string
}

// Domain model with camelCase
export interface Service {
  id: number
  providerId: number
  categoryId: string
  regionId: string
  districtId: string
  title: string
  description: string
  priceFrom: number
  contactInfo: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
```

### 2. Create Mapping Functions

```typescript
// File: src/services/provider.service.ts

export class ProviderService {
  /**
   * Map database row to domain model
   */
  private mapDatabaseRowToService(row: ServiceDatabaseRow): Service {
    return {
      id: row.id,
      providerId: row.provider_id,
      categoryId: row.category_id,
      regionId: row.region_id,
      districtId: row.district_id,
      title: row.title,
      description: row.description,
      priceFrom: row.price_from,
      contactInfo: row.contact_info,
      isActive: row.is_active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }
  }

  async getProviderServices(providerId: number): Promise<Service[]> {
    const result = await this.db
      .prepare(`SELECT * FROM services WHERE provider_id = ?`)
      .bind(providerId)
      .all<ServiceDatabaseRow>() // Use DB row type

    // Map each row to domain model
    return result.results.map(row => this.mapDatabaseRowToService(row))
  }
}
```

### 3. Handle Boolean Fields

SQLite stores booleans as integers (0/1):

```typescript
// Map DB integer to boolean
isActive: row.is_active === 1,

// Map boolean to DB integer
.bind(service.isActive ? 1 : 0)
```

### 4. Generic Mapping Utility (Optional)

For larger projects, consider a generic mapper:

```typescript
// File: src/utils/db-mapper.ts

type SnakeToCamelCase<S extends string> = S extends `${infer T}_${infer U}`
  ? `${T}${Capitalize<SnakeToCamelCase<U>>}`
  : S

type MapSnakeToCamel<T> = {
  [K in keyof T as SnakeToCamelCase<K & string>]: T[K]
}

export function mapSnakeToCamel<T extends Record<string, any>>(obj: T): MapSnakeToCamel<T> {
  const result: any = {}

  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    result[camelKey] = value
  }

  return result
}
```

## Implementation Checklist

1. **Audit Database Schema**
   - List all tables and their columns
   - Identify snake_case fields

2. **Create DatabaseRow Types**
   - One interface per table
   - Match exact DB field names and types

3. **Create Mapping Functions**
   - One mapper per entity type
   - Handle type conversions (dates, booleans)

4. **Update All Queries**
   - Replace domain types with DatabaseRow types in queries
   - Add mapping after fetching data

5. **Update Tests**
   - Mock data must use snake_case fields
   - Test mapping functions separately

## Production Impact

In Kogotochki bot, this pattern:

- Fixed "My Services" button not working after adding services
- Eliminated all field name mismatches
- Improved type safety
- Made database queries predictable

## Testing Considerations

### Test Environment Quirks

Some test databases (like @miniflare/d1) may have quirks with boolean/integer handling:

```typescript
// In tests, filter results in JavaScript if needed
const winnerBids = results.filter(b => b.status === 'won' && b.position >= 1 && b.position <= 3)
```

### Mock Data

Always use snake_case in test mocks:

```typescript
const mockServiceDb = {
  id: 1,
  provider_id: 123,
  category_id: 'nails'
  // ... other snake_case fields
}
```

## Why This Matters

1. **Prevents Silent Failures**: TypeScript can't catch field name mismatches at compile time
2. **Explicit is Better**: Makes data flow clear and debuggable
3. **Database Agnostic**: Works with any SQL database
4. **Maintainable**: Changes to DB schema are isolated to mapping functions

## Migration Path

For existing projects:

1. Start with problematic queries
2. Add DatabaseRow types incrementally
3. Test each service after adding mapping
4. Monitor for undefined values in logs

This pattern has been battle-tested in production and eliminates an entire class of runtime errors.
