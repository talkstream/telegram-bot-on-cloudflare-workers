# ESLint Database Mapping Rules

This document describes custom ESLint rules designed to prevent common errors when working with database field mappings in TypeScript/JavaScript applications.

## Overview

These rules help enforce best practices when transforming data between database representations (typically snake_case with specific type conventions) and JavaScript/TypeScript domain models (typically camelCase with native types).

## Rules

### 1. `db-mapping/no-snake-case-db-fields`

Prevents direct access to snake_case database fields, encouraging the use of proper field mappers.

#### Why?

- Ensures consistency between database schema and application code
- Makes refactoring easier by centralizing field name mappings
- Prevents typos and naming mismatches

#### Examples

```typescript
// ❌ Bad
const userId = row.user_id;
const { first_name, last_name } = dbRow;

// ✅ Good
const user = userMapper.toDomain(row);
const { firstName, lastName } = user;
```

#### Configuration

```javascript
'db-mapping/no-snake-case-db-fields': ['error', {
  allowedPatterns: ['\\.bind\\(', '\\.all\\('],  // Allow in SQL method chains
  databaseRowTypes: ['DatabaseRow', 'DBRow'],     // Types that indicate DB rows
}]
```

### 2. `db-mapping/require-boolean-conversion`

Ensures SQLite boolean fields (stored as 0/1) are properly converted to JavaScript booleans.

#### Why?

- SQLite doesn't have a native boolean type
- Prevents bugs from truthy/falsy confusion (0 is falsy but represents false)
- Ensures type safety in TypeScript

#### Examples

```typescript
// ❌ Bad
const isActive = row.is_active; // Type: number, not boolean!
if (row.has_access) {
} // Bug: 0 is falsy but valid

// ✅ Good
const isActive = row.is_active === 1; // Type: boolean
if (row.has_access === 1) {
} // Explicit conversion
```

#### Auto-fix

This rule can automatically fix violations:

```typescript
// Before
const isBlocked = dbRow.is_blocked;

// After (auto-fixed)
const isBlocked = dbRow.is_blocked === 1;
```

### 3. `db-mapping/require-date-conversion`

Ensures database date strings are converted to JavaScript Date objects.

#### Why?

- Databases store dates as ISO strings
- Prevents string manipulation errors on dates
- Enables proper date methods and type safety

#### Examples

```typescript
// ❌ Bad
const createdAt = row.created_at; // Type: string
const date = user.updated_at; // String, not Date

// ✅ Good
const createdAt = new Date(row.created_at); // Type: Date
const date = row.updated_at ? new Date(row.updated_at) : null;
```

#### Special Cases

Null checks are allowed without conversion:

```typescript
// ✅ Good - null checking
if (row.deleted_at) {
  // Handle soft-deleted record
}

// ✅ Good - conditional conversion
const deletedAt = row.deleted_at ? new Date(row.deleted_at) : null;
```

### 4. `db-mapping/use-field-mapper`

Suggests using the FieldMapper utility instead of manual field-by-field mapping.

#### Why?

- Reduces code duplication
- Centralizes mapping logic
- Makes testing easier
- Improves maintainability

#### Examples

```typescript
// ⚠️ Warning - manual mapping
function mapUser(row) {
  return {
    userId: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    isActive: row.is_active === 1,
    createdAt: new Date(row.created_at),
  };
}

// ✅ Better - using FieldMapper
const userMapper = new FieldMapper<UserDatabaseRow, User>([
  { dbField: 'user_id', domainField: 'userId' },
  { dbField: 'first_name', domainField: 'firstName' },
  { dbField: 'last_name', domainField: 'lastName' },
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

const user = userMapper.toDomain(row);
```

## Installation

The rules are included in the project. No additional installation needed.

## Configuration

Add to your ESLint configuration:

```javascript
// eslint.config.js
import dbMappingPlugin from './eslint-rules/index.js';

export default [
  {
    plugins: {
      'db-mapping': dbMappingPlugin,
    },
    rules: {
      // Strict configuration
      'db-mapping/no-snake-case-db-fields': 'error',
      'db-mapping/require-boolean-conversion': 'error',
      'db-mapping/require-date-conversion': 'error',
      'db-mapping/use-field-mapper': 'warn',
    },
  },
];
```

## Presets

### Recommended

Balanced configuration for most projects:

```javascript
...dbMappingPlugin.configs.recommended
```

### Strict

Enforces all rules with stricter settings:

```javascript
...dbMappingPlugin.configs.strict
```

## Common Patterns

### Working with SQL Queries

The rules allow snake_case in SQL-related contexts:

```typescript
// ✅ Allowed in SQL strings
const query = `SELECT user_id, first_name FROM users WHERE is_active = 1`;

// ✅ Allowed in SQL builder methods
db.prepare(query).bind(row.user_id).first(); // Allowed by configuration
```

### Mapper Transformations

Inside mapper definitions, direct field access is allowed:

```typescript
// ✅ Allowed in transformation functions
{
  dbField: 'is_premium',
  domainField: 'isPremium',
  toDomain: (v) => v === 1,  // Direct conversion allowed here
  toDb: (v) => v ? 1 : 0
}
```

### Gradual Migration

For existing codebases, start with warnings:

```javascript
{
  rules: {
    'db-mapping/no-snake-case-db-fields': 'warn',
    'db-mapping/require-boolean-conversion': 'warn',
    'db-mapping/require-date-conversion': 'warn',
    'db-mapping/use-field-mapper': 'off',  // Enable later
  }
}
```

## Troubleshooting

### False Positives

If the rules flag valid code, you can:

1. **Disable for a line:**

   ```typescript
   // eslint-disable-next-line db-mapping/no-snake-case-db-fields
   const special_case = row.special_case;
   ```

2. **Configure allowed patterns:**

   ```javascript
   'db-mapping/no-snake-case-db-fields': ['error', {
     allowedPatterns: ['mySpecialFunction\\('],
   }]
   ```

3. **Adjust type detection:**
   ```javascript
   'db-mapping/no-snake-case-db-fields': ['error', {
     databaseRowTypes: ['MyCustomRowType'],
   }]
   ```

### Performance

The rules run during linting and have minimal impact on development. For large codebases:

- Run linting in CI/CD pipelines
- Use `--cache` flag for faster local linting
- Consider running with `--quiet` during development

## Contributing

To add new rules or improve existing ones:

1. Add rule implementation in `eslint-rules/`
2. Add tests in `eslint-rules/__tests__/`
3. Update `eslint-rules/index.js`
4. Document in this file

## See Also

- [Field Mapper Documentation](./DATABASE_FIELD_MAPPING.md)
- [ESLint Documentation](https://eslint.org/)
- [TypeScript ESLint](https://typescript-eslint.io/)
