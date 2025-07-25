# Database Field Mapping Guide

This guide explains how to use the Wireframe Field Mapper system for safe and efficient database field mapping between snake_case database columns and camelCase JavaScript/TypeScript properties.

> **Note**: Types and mappers can be automatically generated from SQL schema using the [Database Type Generator CLI](./CLI_DB_TYPES.md).

## Overview

The Field Mapper provides a type-safe, declarative way to handle the common problem of converting between database naming conventions (snake_case) and JavaScript/TypeScript naming conventions (camelCase).

## Key Features

- **Type Safety**: Full TypeScript support with compile-time checking
- **Bidirectional Mapping**: Convert from database to domain and back
- **SQL Generation**: Automatically generate SELECT statements with aliases
- **Custom Transformations**: Handle booleans, dates, JSON, and more
- **Performance**: Minimal runtime overhead
- **Testable**: Easy to unit test mapping logic

## Basic Usage

### 1. Define Your Types

```typescript
// Database row type (snake_case)
interface UserDatabaseRow {
  telegram_id: number;
  first_name?: string;
  is_active: number; // SQLite boolean (0/1)
  created_at: string; // ISO date string
}

// Domain model type (camelCase)
interface User {
  telegramId: number;
  firstName?: string;
  isActive: boolean;
  createdAt: Date;
}
```

### 2. Create a Mapper

```typescript
import { FieldMapper, CommonTransformers } from '@/core/database/field-mapper';

const userMapper = new FieldMapper<UserDatabaseRow, User>([
  { dbField: 'telegram_id', domainField: 'telegramId' },
  { dbField: 'first_name', domainField: 'firstName' },
  {
    dbField: 'is_active',
    domainField: 'isActive',
    ...CommonTransformers.sqliteBoolean,
  },
  {
    dbField: 'created_at',
    domainField: 'createdAt',
    ...CommonTransformers.isoDate,
  },
]);
```

### 3. Use in Your Service

```typescript
class UserService {
  async getUser(id: number): Promise<User | null> {
    // Generate SELECT with automatic aliases
    const query = `SELECT ${userMapper.generateSelectSQL()} FROM users WHERE telegram_id = ?`;

    const row = await db.prepare(query).bind(id).first<UserDatabaseRow>();

    return row ? userMapper.toDomain(row) : null;
  }
}
```

## Common Transformers

The library includes pre-built transformers for common scenarios:

### SQLite Boolean

```typescript
CommonTransformers.sqliteBoolean;
// Converts: 0/1 ↔ false/true
```

### Date Transformations

```typescript
CommonTransformers.isoDate; // ISO string ↔ Date
CommonTransformers.unixTimestamp; // Unix timestamp ↔ Date
```

### Data Structures

```typescript
CommonTransformers.json<T>(); // JSON string ↔ Object
CommonTransformers.csvArray; // "a,b,c" ↔ ["a", "b", "c"]
```

## Advanced Features

### Auto Mapping

For simple cases where you just need snake_case to camelCase conversion:

```typescript
const mapper = createAutoMapper<DbRow, Model>(['user_id', 'first_name', 'created_at'], {
  // Override only fields that need special handling
  created_at: CommonTransformers.isoDate,
});
```

### SQL Generation

```typescript
// SELECT with aliases
mapper.generateSelectSQL();
// => "telegram_id as telegramId, first_name as firstName"

// With table prefix for JOINs
mapper.generateSelectSQL('u');
// => "u.telegram_id as telegramId, u.first_name as firstName"

// INSERT helpers
const { fields, placeholders } = mapper.generateInsertSQL();
// fields: ['telegram_id', 'first_name']
// placeholders: ['?', '?']
```

### Custom Transformations

```typescript
{
  dbField: 'tags',
  domainField: 'tags',
  toDomain: (v: string) => v ? v.split(',') : [],
  toDb: (v: string[]) => v.join(',')
}
```

## Best Practices

### 1. Centralize Mappers

Create mapper instances in a central location:

```typescript
// src/database/mappers/user-mapper.ts
export const userMapper = new FieldMapper<UserDatabaseRow, User>([...]);

// src/database/mappers/index.ts
export * from './user-mapper';
export * from './provider-mapper';
```

### 2. Use with Repository Pattern

```typescript
class UserRepository {
  constructor(
    private db: D1Database,
    private mapper = userMapper,
  ) {}

  async findById(id: number): Promise<User | null> {
    const query = `SELECT ${this.mapper.generateSelectSQL()} FROM users WHERE id = ?`;
    const row = await this.db.prepare(query).bind(id).first<UserDatabaseRow>();
    return row ? this.mapper.toDomain(row) : null;
  }
}
```

### 3. Handle Nullable Fields

```typescript
{
  dbField: 'deleted_at',
  domainField: 'deletedAt',
  toDomain: (v: string | null) => v ? new Date(v) : null,
  toDb: (v: Date | null) => v ? v.toISOString() : null
}
```

### 4. Test Your Mappers

```typescript
describe('UserMapper', () => {
  it('should map database row to domain model', () => {
    const dbRow: UserDatabaseRow = {
      telegram_id: 123,
      is_active: 1,
      created_at: '2024-01-01T00:00:00Z',
    };

    const user = userMapper.toDomain(dbRow);

    expect(user).toEqual({
      telegramId: 123,
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
    });
  });
});
```

## Migration from Existing Code

### From SQL Aliases

Before:

```typescript
const query = `
  SELECT 
    telegram_id as telegramId,
    first_name as firstName,
    is_active as isActive
  FROM users
`;
```

After:

```typescript
const query = `SELECT ${userMapper.generateSelectSQL()} FROM users`;
```

### From Manual Mapping

Before:

```typescript
function mapUser(row: any): User {
  return {
    telegramId: row.telegram_id,
    firstName: row.first_name,
    isActive: row.is_active === 1,
    createdAt: new Date(row.created_at),
  };
}
```

After:

```typescript
const user = userMapper.toDomain(row);
```

## Performance Considerations

1. **Mapper Creation**: Create mappers once and reuse them
2. **SQL Generation**: Cache generated SQL strings if used frequently
3. **Transformations**: Keep transformation functions simple and fast

## Common Pitfalls

1. **Forgetting Boolean Conversion**: SQLite stores booleans as 0/1
2. **Date Timezone Issues**: Always store dates in UTC
3. **JSON Field Validation**: Consider adding validation for JSON fields
4. **Missing Fields**: The mapper only processes defined fields

## Future Enhancements

- [ ] Validation support
- [ ] Automatic type generation from database schema
- [ ] Migration tools for existing codebases
- [ ] Performance benchmarks
- [ ] Integration with popular ORMs
