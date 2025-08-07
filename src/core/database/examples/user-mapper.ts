/**
 * Example: User field mapper configuration
 *
 * This example shows how to use the FieldMapper for a typical user table
 * with various field types including booleans, dates, and arrays.
 */

import { CommonTransformers, FieldMapper } from '../field-mapper'

// Database row type (snake_case)
interface UserDatabaseRow {
  telegram_id: number
  username?: string
  first_name?: string
  last_name?: string
  language_code?: string
  is_premium?: number
  has_access: number
  is_active: number
  created_at: string
  updated_at: string
  star_balance?: number
  notification_settings?: string // JSON
  tags?: string // Comma-separated
}

// Domain model type (camelCase)
interface User {
  telegramId: number
  username?: string
  firstName?: string
  lastName?: string
  languageCode?: string
  isPremium?: boolean
  hasAccess: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  starBalance?: number
  notificationSettings?: {
    email: boolean
    push: boolean
  }
  tags?: string[]
}

// Create the mapper with explicit field mappings
export const userMapper = new FieldMapper<UserDatabaseRow, User>([
  { dbField: 'telegram_id', domainField: 'telegramId' },
  { dbField: 'username', domainField: 'username' },
  { dbField: 'first_name', domainField: 'firstName' },
  { dbField: 'last_name', domainField: 'lastName' },
  { dbField: 'language_code', domainField: 'languageCode' },
  {
    dbField: 'is_premium',
    domainField: 'isPremium',
    ...CommonTransformers.sqliteBoolean
  },
  {
    dbField: 'has_access',
    domainField: 'hasAccess',
    ...CommonTransformers.sqliteBoolean
  },
  {
    dbField: 'is_active',
    domainField: 'isActive',
    ...CommonTransformers.sqliteBoolean
  },
  {
    dbField: 'created_at',
    domainField: 'createdAt',
    ...CommonTransformers.isoDate
  },
  {
    dbField: 'updated_at',
    domainField: 'updatedAt',
    ...CommonTransformers.isoDate
  },
  { dbField: 'star_balance', domainField: 'starBalance' },
  {
    dbField: 'notification_settings',
    domainField: 'notificationSettings',
    ...CommonTransformers.json<{ email: boolean; push: boolean }>()
  },
  {
    dbField: 'tags',
    domainField: 'tags',
    ...CommonTransformers.csvArray
  }
])

// Example usage in a service
export class UserService {
  constructor(private db: any) {}

  async getUser(telegramId: number): Promise<User | null> {
    // Generate SELECT with automatic aliases
    const selectFields = userMapper.generateSelectSQL()
    const query = `SELECT ${selectFields} FROM users WHERE telegram_id = ?`

    const row = await this.db.prepare(query).bind(telegramId).first()

    if (!row) return null

    // Transform database row to domain model
    return userMapper.toDomain(row as UserDatabaseRow)
  }

  async createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<void> {
    const { fields, placeholders } = userMapper.generateInsertSQL()
    const query = `INSERT INTO users (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`

    // Get values in order for binding
    const values = userMapper.getDatabaseValues(user)

    await this.db
      .prepare(query)
      .bind(...values)
      .run()
  }

  async updateUser(telegramId: number, updates: Partial<User>): Promise<void> {
    // Transform updates to database format
    const dbUpdates = userMapper.toDatabase(updates as User)

    // Build UPDATE query dynamically
    const setClause = Object.keys(dbUpdates)
      .map(field => `${field} = ?`)
      .join(', ')

    const values = Object.values(dbUpdates)
    values.push(telegramId) // WHERE clause value

    const query = `UPDATE users SET ${setClause} WHERE telegram_id = ?`
    await this.db
      .prepare(query)
      .bind(...values)
      .run()
  }
}

// Example with JOIN query
export async function getUsersWithRoles(db: any): Promise<Array<User & { role?: string }>> {
  const query = `
    SELECT 
      ${userMapper.generateSelectSQL('u')},
      r.role as role
    FROM users u
    LEFT JOIN user_roles r ON u.telegram_id = r.user_id
  `

  const { results } = await db.prepare(query).all()

  return results.map((row: any) => ({
    ...userMapper.toDomain(row),
    role: row.role
  }))
}
