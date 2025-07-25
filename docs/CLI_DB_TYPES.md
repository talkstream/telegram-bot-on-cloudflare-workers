# Database Type Generator CLI

A command-line tool for automatically generating TypeScript types from SQL schema files.

## Overview

The `db:types` command parses SQL schema files (migrations) and generates:

- TypeScript interfaces for database rows (snake_case)
- TypeScript interfaces for domain models (camelCase)
- FieldMapper configurations for bidirectional transformations

## Usage

### Basic Usage

```bash
npm run db:types
```

This will:

1. Read all `.sql` files from `./migrations` directory
2. Parse CREATE TABLE statements
3. Generate types in `./src/types/generated/`
4. Generate mapper configurations in `./src/database/mappers/generated/`

### Command Options

```bash
npm run db:types -- [options]
```

| Option            | Description                                | Default                 |
| ----------------- | ------------------------------------------ | ----------------------- |
| `--input <dir>`   | Input directory with SQL files             | `./migrations`          |
| `--output <dir>`  | Output directory for generated types       | `./src/types/generated` |
| `--tables <list>` | Comma-separated list of tables to generate | All tables              |
| `--watch`         | Watch for changes and regenerate           | `false`                 |
| `--dry-run`       | Preview without writing files              | `false`                 |
| `--help, -h`      | Show help message                          | -                       |

### Examples

```bash
# Generate types for specific tables only
npm run db:types -- --tables=users,posts

# Use custom directories
npm run db:types -- --input=./schema --output=./src/types

# Preview changes without writing
npm run db:types -- --dry-run

# Watch mode (not implemented yet)
npm run db:types -- --watch
```

## Generated Files

### 1. Database Types (`database.ts`)

```typescript
export interface UsersDatabaseRow {
  id?: number;
  telegram_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  created_at?: string;
}
```

### 2. Domain Models (`models.ts`)

```typescript
export interface User {
  id?: number;
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  createdAt?: Date;
}
```

### 3. Mapper Configurations (`mappers/generated/index.ts`)

```typescript
export const userMapper = new FieldMapper<DB.UsersDatabaseRow, Domain.User>([
  { dbField: 'id', domainField: 'id' },
  { dbField: 'telegram_id', domainField: 'telegramId' },
  { dbField: 'first_name', domainField: 'firstName' },
  { dbField: 'last_name', domainField: 'lastName' },
  { dbField: 'username', domainField: 'username' },
  {
    dbField: 'created_at',
    domainField: 'createdAt',
    ...CommonTransformers.isoDate,
  },
]);
```

## Type Conversion Rules

### SQL to TypeScript

| SQL Type                  | Database Type | Domain Type |
| ------------------------- | ------------- | ----------- |
| INTEGER, INT, BIGINT      | `number`      | `number`    |
| TEXT, VARCHAR, CHAR       | `string`      | `string`    |
| BOOLEAN, BOOL             | `number`      | `boolean`   |
| DATE, DATETIME, TIMESTAMP | `string`      | `Date`      |
| JSON, JSONB               | `any`         | `any`       |

### Field Name Patterns

The generator automatically detects and applies transformations based on field names:

#### Boolean Fields

Fields starting with:

- `is_`, `has_`, `can_`, `should_`, `will_`, `did_`, `was_`, `are_`, `does_`, `do_`

Fields ending with:

- `_enabled`, `_disabled`, `_active`, `_inactive`, `_visible`, `_hidden`, `_required`, `_optional`

#### Date Fields

Fields containing:

- `_at`, `_date`, `_time`, `timestamp`, `expires_`, `started_`, `ended_`

## Integration with FieldMapper

Generated mappers automatically use appropriate transformers:

- **Boolean fields**: `CommonTransformers.sqliteBoolean`
- **Date fields**: `CommonTransformers.isoDate`
- **JSON fields**: `CommonTransformers.json()`
- **Array fields** (containing `_list` or `_array`): `CommonTransformers.csvArray`

## Workflow Example

1. Create or modify SQL migration:

```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

2. Run type generator:

```bash
npm run db:types
```

3. Use generated types in your code:

```typescript
import { productMapper } from '@/database/mappers/generated';
import type { Product } from '@/types/generated/models';

class ProductService {
  async getProduct(id: number): Promise<Product | null> {
    const query = `SELECT ${productMapper.generateSelectSQL()} FROM products WHERE id = ?`;
    const row = await db.prepare(query).bind(id).first();
    return row ? productMapper.toDomain(row) : null;
  }
}
```

## Notes

- The generator parses only CREATE TABLE statements
- It handles SQLite-specific syntax (AUTOINCREMENT, etc.)
- Table modifications in later migrations override earlier definitions
- Generated files should not be edited manually
- Add generated directories to `.gitignore` if desired

## Future Enhancements

- [ ] Watch mode implementation
- [ ] Support for ALTER TABLE statements
- [ ] Custom transformer detection
- [ ] Validation against existing types
- [ ] Support for other SQL dialects
- [ ] Integration with migration tools
