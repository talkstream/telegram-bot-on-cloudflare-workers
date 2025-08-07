/**
 * Example file demonstrating ESLint rule violations
 * This file intentionally contains anti-patterns that the rules detect
 */

// Example 1: Direct snake_case field access
function badUserMapping(row: any) {
  // ❌ These will trigger no-snake-case-db-fields
  const userId = row.user_id
  const firstName = row.first_name
  const createdAt = row.created_at

  return { userId, firstName, createdAt }
}

// Example 2: Missing boolean conversion
function checkUserStatus(dbRow: any) {
  // ❌ This will trigger require-boolean-conversion
  if (row.is_active) {
    console.log('User is active')
  }

  // ❌ Missing conversion
  const hasAccess = row.has_access
  const isBlocked = dbRow.is_blocked

  return { hasAccess, isBlocked }
}

// Example 3: Missing date conversion
function getUserDates(record: any) {
  // ❌ This will trigger require-date-conversion
  const created = record.created_at
  const updated = record.updated_at

  // ❌ String dates used directly
  return {
    createdAt: created,
    updatedAt: updated
  }
}

// Example 4: Manual mapping that should use FieldMapper
function mapUserManually(row: any) {
  // ⚠️ This will trigger use-field-mapper (3+ fields)
  return {
    userId: row.user_id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    isActive: row.is_active === 1,
    isPremium: row.is_premium === 1,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  }
}

// Example 5: Array mapping without FieldMapper
function mapUsers(rows: any[]) {
  // ⚠️ This pattern suggests using FieldMapper
  return rows.map(row => ({
    id: row.user_id,
    name: row.first_name + ' ' + row.last_name,
    active: row.is_active === 1,
    joined: new Date(row.created_at)
  }))
}

// Example 6: Destructuring with snake_case
function processUser(dbRow: any) {
  // ❌ Destructuring snake_case fields
  const { user_id, first_name, last_name, is_active } = dbRow

  return {
    userId: user_id,
    fullName: `${first_name} ${last_name}`,
    active: is_active === 1
  }
}

// Example 7: Loose equality for boolean
function checkAccess(row: any) {
  // ❌ Using loose equality (should be ===)
  if (row.has_access == 1) {
    return true
  }

  // ❌ Using != instead of !==
  return row.is_blocked != 1
}
