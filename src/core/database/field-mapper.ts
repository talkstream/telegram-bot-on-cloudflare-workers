/**
 * Universal Field Mapper for database <-> domain model transformations
 *
 * This mapper provides a type-safe way to transform between database rows
 * (typically snake_case) and domain models (typically camelCase).
 *
 * Note: The mapper uses flexible typing to handle the dynamic nature of
 * database field transformations. The type parameters allow any object shape
 * because database schemas and domain models can have arbitrary structures.
 * The transformer functions use unknown types for maximum flexibility while
 * maintaining runtime type safety through the specific transformer implementations.
 *
 * @example
 * ```typescript
 * const userMapper = new FieldMapper<UserDatabaseRow, User>([
 *   { dbField: 'telegram_id', domainField: 'telegramId' },
 *   {
 *     dbField: 'is_active',
 *     domainField: 'isActive',
 *     toDomain: (v) => v === 1,
 *     toDb: (v) => v ? 1 : 0
 *   },
 *   {
 *     dbField: 'created_at',
 *     domainField: 'createdAt',
 *     toDomain: (v) => new Date(v),
 *     toDb: (v) => v.toISOString()
 *   }
 * ]);
 *
 * const user = userMapper.toDomain(dbRow);
 * const dbRow = userMapper.toDatabase(user);
 * ```
 */

// Type-safe field mapping with flexible transformers
export interface FieldMapping<
  TDb,
  TDomain,
  TDbField extends keyof TDb,
  TDomainField extends keyof TDomain,
> {
  dbField: TDbField;
  domainField: TDomainField;
  // Using unknown for transformer functions allows maximum flexibility
  // while maintaining type safety at the usage site
  toDomain?: (value: unknown) => unknown;
  toDb?: (value: unknown) => unknown;
}

// Helper type for field mappings with less strict typing
type FlexibleFieldMapping<TDb, TDomain> = {
  dbField: keyof TDb;
  domainField: keyof TDomain;
  toDomain?: (value: unknown) => unknown;
  toDb?: (value: unknown) => unknown;
};

export class FieldMapper<TDb, TDomain> {
  private mappings: Map<keyof TDb, FlexibleFieldMapping<TDb, TDomain>> = new Map();
  private reverseMappings: Map<keyof TDomain, FlexibleFieldMapping<TDb, TDomain>> = new Map();

  constructor(mappings: Array<FlexibleFieldMapping<TDb, TDomain>>) {
    mappings.forEach((mapping) => {
      this.mappings.set(mapping.dbField, mapping);
      this.reverseMappings.set(mapping.domainField, mapping);
    });
  }

  /**
   * Transform a database row to a domain model
   */
  toDomain(dbRow: TDb): TDomain {
    const result = {} as TDomain;

    for (const [dbField, mapping] of this.mappings) {
      const value = dbRow[dbField];
      if (value !== undefined) {
        const domainField = mapping.domainField as keyof TDomain;
        (result as Record<keyof TDomain, unknown>)[domainField] = mapping.toDomain
          ? mapping.toDomain(value as TDb[keyof TDb])
          : value;
      }
    }

    return result;
  }

  /**
   * Transform a domain model to a database row
   */
  toDatabase(domain: TDomain): TDb {
    const result = {} as TDb;

    for (const [domainField, mapping] of this.reverseMappings) {
      const value = domain[domainField];
      if (value !== undefined) {
        const dbField = mapping.dbField as keyof TDb;
        (result as Record<keyof TDb, unknown>)[dbField] = mapping.toDb
          ? mapping.toDb(value as TDomain[keyof TDomain])
          : value;
      }
    }

    return result;
  }

  /**
   * Generate SQL SELECT with aliases for automatic mapping
   * @example
   * mapper.generateSelectSQL('users')
   * // Returns: "telegram_id as telegramId, is_active as isActive"
   */
  generateSelectSQL(includeTablePrefix?: string): string {
    const aliases: string[] = [];

    for (const [dbField, mapping] of this.mappings) {
      const field = String(dbField);
      const alias = String(mapping.domainField);

      if (field !== alias) {
        const prefix = includeTablePrefix ? `${includeTablePrefix}.` : '';
        aliases.push(`${prefix}${field} as ${alias}`);
      } else {
        const prefix = includeTablePrefix ? `${includeTablePrefix}.` : '';
        aliases.push(`${prefix}${field}`);
      }
    }

    return aliases.join(', ');
  }

  /**
   * Generate INSERT field lists
   * @returns { fields: string[], placeholders: string[] }
   */
  generateInsertSQL(): { fields: string[]; placeholders: string[] } {
    const fields: string[] = [];
    const placeholders: string[] = [];

    for (const [dbField] of this.mappings) {
      fields.push(String(dbField));
      placeholders.push('?');
    }

    return { fields, placeholders };
  }

  /**
   * Get ordered values for database insert/update from domain model
   */
  getDatabaseValues(domain: Partial<TDomain>): unknown[] {
    const values: unknown[] = [];

    for (const [_, mapping] of this.mappings) {
      const value = domain[mapping.domainField];
      if (value !== undefined) {
        values.push(mapping.toDb ? mapping.toDb(value as TDomain[keyof TDomain]) : value);
      }
    }

    return values;
  }
}

/**
 * Pre-configured mappers for common transformations
 */
export const CommonTransformers = {
  /**
   * SQLite boolean (0/1) to JavaScript boolean
   */
  sqliteBoolean: {
    toDomain: (v: unknown) => (v as number) === 1,
    toDb: (v: unknown) => ((v as boolean) ? 1 : 0),
  },

  /**
   * ISO string to Date object
   */
  isoDate: {
    toDomain: (v: unknown) => new Date(v as string),
    toDb: (v: unknown) => (v as Date).toISOString(),
  },

  /**
   * Unix timestamp to Date object
   */
  unixTimestamp: {
    toDomain: (v: unknown) => new Date((v as number) * 1000),
    toDb: (v: unknown) => Math.floor((v as Date).getTime() / 1000),
  },

  /**
   * JSON string to object
   */
  json: <T = unknown>() => ({
    toDomain: (v: unknown): T => JSON.parse(v as string),
    toDb: (v: unknown): string => JSON.stringify(v),
  }),

  /**
   * Comma-separated string to array
   */
  csvArray: {
    toDomain: (v: unknown): string[] => (v ? (v as string).split(',').map((s) => s.trim()) : []),
    toDb: (v: unknown): string => (v as string[]).join(','),
  },
};

/**
 * Utility to automatically create mappings for snake_case to camelCase
 * Note: This only handles simple transformations, complex types need manual mapping
 */
export function createAutoMapper<TDb, TDomain>(
  fields: Array<keyof TDb>,
  customMappings?: Partial<Record<keyof TDb, Partial<FlexibleFieldMapping<TDb, TDomain>>>>,
): FieldMapper<TDb, TDomain> {
  const mappings: Array<FlexibleFieldMapping<TDb, TDomain>> = fields.map((dbField) => {
    const domainField = snakeToCamel(String(dbField)) as keyof TDomain;
    const custom = customMappings?.[dbField];

    return {
      dbField,
      domainField: custom?.domainField ?? domainField,
      toDomain: custom?.toDomain,
      toDb: custom?.toDb,
    };
  });

  return new FieldMapper(mappings);
}

/**
 * Convert snake_case to camelCase
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}
