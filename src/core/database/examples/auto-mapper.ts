/**
 * Example: Automatic field mapping for simple cases
 *
 * This example demonstrates the createAutoMapper utility for cases
 * where most fields just need snake_case to camelCase conversion.
 */

import { CommonTransformers, createAutoMapper } from '../field-mapper'

// Simple service table with mostly straightforward mappings
interface ServiceDatabaseRow {
  id: number
  provider_id: number
  category_id: string
  service_name: string
  service_description?: string
  price_from?: number
  price_to?: number
  is_active: number
  created_at: string
  updated_at: string
}

interface Service {
  id: number
  providerId: number
  categoryId: string
  serviceName: string
  serviceDescription?: string
  priceFrom?: number
  priceTo?: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Create mapper with automatic snake_case to camelCase conversion
// Only specify custom transformations for special fields
export const serviceMapper = createAutoMapper<ServiceDatabaseRow, Service>(
  [
    'id',
    'provider_id',
    'category_id',
    'service_name',
    'service_description',
    'price_from',
    'price_to',
    'is_active',
    'created_at',
    'updated_at'
  ],
  {
    // Only override fields that need special handling
    is_active: CommonTransformers.sqliteBoolean,
    created_at: CommonTransformers.isoDate,
    updated_at: CommonTransformers.isoDate
  }
)

// Example: Bot settings with mixed field types
interface BotSettingsDatabaseRow {
  id: number
  setting_key: string
  setting_value: string
  value_type: 'string' | 'number' | 'boolean' | 'json'
  is_sensitive: number
  updated_at: string
  updated_by?: number
}

interface BotSettings {
  id: number
  settingKey: string
  settingValue: any // Dynamic based on valueType
  valueType: 'string' | 'number' | 'boolean' | 'json'
  isSensitive: boolean
  updatedAt: Date
  updatedBy?: number
}

// Mapper with dynamic value transformation based on type
export const settingsMapper = createAutoMapper<BotSettingsDatabaseRow, BotSettings>(
  ['id', 'setting_key', 'setting_value', 'value_type', 'is_sensitive', 'updated_at', 'updated_by'],
  {
    is_sensitive: CommonTransformers.sqliteBoolean,
    updated_at: CommonTransformers.isoDate,
    setting_value: {
      domainField: 'settingValue',
      toDomain: (value: string) => {
        // Note: In real implementation, you'd need access to row.value_type
        // This is a limitation of the simple transformer pattern
        // For now, return as string - actual transformation would happen elsewhere
        return value
        /* Example of what you'd do with row context:
        switch (row.value_type) {
          case 'number': return Number(value);
          case 'boolean': return value === 'true' || value === '1';
          case 'json': return JSON.parse(value);
          default: return value;
        }
        */
      },
      toDb: (value: any) => {
        // Simple conversion - in practice you'd handle based on type
        return typeof value === 'object' ? JSON.stringify(value) : String(value)
      }
    }
  }
)

// Example: Complex mapper with nested objects
interface ProviderDatabaseRow {
  id: number
  telegram_id: number
  business_name?: string
  contact_phone?: string
  contact_email?: string
  service_areas?: string // JSON array of {regionId, districtIds[]}
  working_hours?: string // JSON object
  rating: number
  total_reviews: number
  is_verified: number
  verification_date?: string
  created_at: string
}

interface Provider {
  id: number
  telegramId: number
  businessName?: string
  contactPhone?: string
  contactEmail?: string
  serviceAreas?: Array<{
    regionId: string
    districtIds: string[]
  }>
  workingHours?: {
    [day: string]: { open: string; close: string }
  }
  rating: number
  totalReviews: number
  isVerified: boolean
  verificationDate?: Date
  createdAt: Date
}

// Complex mapper with nested JSON transformations
export const providerMapper = createAutoMapper<ProviderDatabaseRow, Provider>(
  [
    'id',
    'telegram_id',
    'business_name',
    'contact_phone',
    'contact_email',
    'service_areas',
    'working_hours',
    'rating',
    'total_reviews',
    'is_verified',
    'verification_date',
    'created_at'
  ],
  {
    service_areas: {
      domainField: 'serviceAreas',
      ...CommonTransformers.json()
    },
    working_hours: {
      domainField: 'workingHours',
      ...CommonTransformers.json()
    },
    is_verified: CommonTransformers.sqliteBoolean,
    verification_date: {
      domainField: 'verificationDate',
      toDomain: (v: string | null) => (v ? new Date(v) : undefined),
      toDb: (v: Date | undefined) => (v ? v.toISOString() : null)
    },
    created_at: CommonTransformers.isoDate
  }
)

// Usage example: Repository pattern with field mapper
export class ProviderRepository {
  constructor(
    private db: any,
    private mapper = providerMapper
  ) {}

  async findById(id: number): Promise<Provider | null> {
    const query = `SELECT ${this.mapper.generateSelectSQL()} FROM providers WHERE id = ?`
    const row = await this.db.prepare(query).bind(id).first()
    return row ? this.mapper.toDomain(row as ProviderDatabaseRow) : null
  }

  async findByServiceArea(regionId: string): Promise<Provider[]> {
    // Using JSON functions in SQLite
    const query = `
      SELECT ${this.mapper.generateSelectSQL()}
      FROM providers
      WHERE json_extract(service_areas, '$[*].regionId') LIKE ?
        AND is_verified = 1
      ORDER BY rating DESC
    `

    const { results } = await this.db.prepare(query).bind(`%${regionId}%`).all()

    return results.map((row: any) => this.mapper.toDomain(row as ProviderDatabaseRow))
  }

  async save(provider: Provider): Promise<void> {
    const dbData = this.mapper.toDatabase(provider)

    if (provider.id) {
      // Update existing
      const fields = Object.keys(dbData)
        .filter(key => key !== 'id')
        .map(key => `${key} = ?`)

      const values = Object.entries(dbData)
        .filter(([key]) => key !== 'id')
        .map(([_, value]) => value)

      values.push(provider.id) // WHERE clause

      await this.db
        .prepare(`UPDATE providers SET ${fields.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run()
    } else {
      // Insert new
      const { fields, placeholders } = this.mapper.generateInsertSQL()
      const values = this.mapper.getDatabaseValues(provider)

      await this.db
        .prepare(`INSERT INTO providers (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`)
        .bind(...values)
        .run()
    }
  }
}
