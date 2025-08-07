/**
 * Universal Field Mapper for database <-> domain model transformations
 *
 * This mapper provides a type-safe way to transform between database rows
 * (typically snake_case) and domain models (typically camelCase).
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

export interface FieldMapping<
  TDb,
  TDomain,
  TDbField extends keyof TDb,
  TDomainField extends keyof TDomain
> {
  dbField: TDbField
  domainField: TDomainField
  toDomain?: (value: TDb[TDbField]) => TDomain[TDomainField]
  toDb?: (value: TDomain[TDomainField]) => TDb[TDbField]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class FieldMapper<TDb extends Record<string, any>, TDomain extends Record<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mappings: Map<keyof TDb, FieldMapping<TDb, TDomain, any, any>> = new Map()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private reverseMappings: Map<keyof TDomain, FieldMapping<TDb, TDomain, any, any>> = new Map()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(mappings: FieldMapping<TDb, TDomain, any, any>[]) {
    mappings.forEach(mapping => {
      this.mappings.set(mapping.dbField, mapping)
      this.reverseMappings.set(mapping.domainField, mapping)
    })
  }

  /**
   * Transform a database row to a domain model
   */
  toDomain(dbRow: TDb): TDomain {
    const result = {} as TDomain

    for (const [dbField, mapping] of this.mappings) {
      const value = dbRow[dbField]
      if (value !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(result as any)[mapping.domainField] = mapping.toDomain ? mapping.toDomain(value) : value
      }
    }

    return result
  }

  /**
   * Transform a domain model to a database row
   */
  toDatabase(domain: TDomain): TDb {
    const result = {} as TDb

    for (const [domainField, mapping] of this.reverseMappings) {
      const value = domain[domainField]
      if (value !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(result as any)[mapping.dbField] = mapping.toDb ? mapping.toDb(value) : value
      }
    }

    return result
  }

  /**
   * Generate SQL SELECT with aliases for automatic mapping
   * @example
   * mapper.generateSelectSQL('users')
   * // Returns: "telegram_id as telegramId, is_active as isActive"
   */
  generateSelectSQL(includeTablePrefix?: string): string {
    const aliases: string[] = []

    for (const [dbField, mapping] of this.mappings) {
      const field = String(dbField)
      const alias = String(mapping.domainField)

      if (field !== alias) {
        const prefix = includeTablePrefix ? `${includeTablePrefix}.` : ''
        aliases.push(`${prefix}${field} as ${alias}`)
      } else {
        const prefix = includeTablePrefix ? `${includeTablePrefix}.` : ''
        aliases.push(`${prefix}${field}`)
      }
    }

    return aliases.join(', ')
  }

  /**
   * Generate INSERT field lists
   * @returns { fields: string[], placeholders: string[] }
   */
  generateInsertSQL(): { fields: string[]; placeholders: string[] } {
    const fields: string[] = []
    const placeholders: string[] = []

    for (const [dbField] of this.mappings) {
      fields.push(String(dbField))
      placeholders.push('?')
    }

    return { fields, placeholders }
  }

  /**
   * Get ordered values for database insert/update from domain model
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDatabaseValues(domain: Partial<TDomain>): any[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values: any[] = []

    for (const [_, mapping] of this.mappings) {
      const value = domain[mapping.domainField]
      if (value !== undefined) {
        values.push(mapping.toDb ? mapping.toDb(value) : value)
      }
    }

    return values
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
    toDomain: (v: number) => v === 1,
    toDb: (v: boolean) => (v ? 1 : 0)
  },

  /**
   * ISO string to Date object
   */
  isoDate: {
    toDomain: (v: string) => new Date(v),
    toDb: (v: Date) => v.toISOString()
  },

  /**
   * Unix timestamp to Date object
   */
  unixTimestamp: {
    toDomain: (v: number) => new Date(v * 1000),
    toDb: (v: Date) => Math.floor(v.getTime() / 1000)
  },

  /**
   * JSON string to object
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: <T = any>() => ({
    toDomain: (v: string): T => JSON.parse(v),
    toDb: (v: T): string => JSON.stringify(v)
  }),

  /**
   * Comma-separated string to array
   */
  csvArray: {
    toDomain: (v: string | null): string[] => (v ? v.split(',').map(s => s.trim()) : []),
    toDb: (v: string[]): string => v.join(',')
  }
}

/**
 * Utility to automatically create mappings for snake_case to camelCase
 * Note: This only handles simple transformations, complex types need manual mapping
 */
export function createAutoMapper<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TDb extends Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TDomain extends Record<string, any>
>(
  fields: Array<keyof TDb>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customMappings?: Partial<Record<keyof TDb, Partial<FieldMapping<TDb, TDomain, any, any>>>>
): FieldMapper<TDb, TDomain> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mappings: FieldMapping<TDb, TDomain, any, any>[] = fields.map(dbField => {
    const domainField = snakeToCamel(String(dbField)) as keyof TDomain
    const custom = customMappings?.[dbField]

    return {
      dbField,
      domainField: custom?.domainField ?? domainField,
      toDomain: custom?.toDomain,
      toDb: custom?.toDb
    }
  })

  return new FieldMapper(mappings)
}

/**
 * Convert snake_case to camelCase
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}
