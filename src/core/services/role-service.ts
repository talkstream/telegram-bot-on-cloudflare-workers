import type { D1Database } from '@cloudflare/workers-types'

import { CommonTransformers, FieldMapper } from '@/core/database/field-mapper'
import { EventBus } from '@/core/events/event-bus'
import type {
  RoleEvent,
  RoleHierarchy,
  RoleService,
  RoleUser,
  UserRole
} from '@/core/interfaces/role-system'
import { UserRole as Role } from '@/core/interfaces/role-system'
import { logger } from '@/lib/logger'

// Database row type for role users
interface RoleUserDatabaseRow {
  user_id: string
  platform_id: string
  platform: string
  role: string
  granted_by: string
  granted_at: string
}

// Field mapper for role users
const roleUserMapper = new FieldMapper<RoleUserDatabaseRow, RoleUser>([
  { dbField: 'user_id', domainField: 'id' },
  { dbField: 'platform_id', domainField: 'platformId' },
  { dbField: 'platform', domainField: 'platform' },
  { dbField: 'role', domainField: 'role', toDomain: v => v as UserRole },
  { dbField: 'granted_by', domainField: 'grantedBy' },
  { dbField: 'granted_at', domainField: 'grantedAt', ...CommonTransformers.isoDate }
])

export class UniversalRoleService implements RoleService {
  private db: D1Database
  private ownerIds: string[]
  private eventBus: EventBus
  private hierarchy: RoleHierarchy

  constructor(db: D1Database, ownerIds: string[], eventBus: EventBus) {
    this.db = db
    this.ownerIds = ownerIds
    this.eventBus = eventBus
    this.hierarchy = new RoleHierarchyImpl()
  }

  async assignRole(user: Omit<RoleUser, 'grantedAt'>): Promise<void> {
    try {
      const existingRole = await this.getUserRole(user.id)

      await this.db
        .prepare(
          `
        INSERT INTO user_roles (user_id, platform_id, platform, role, granted_by, granted_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET 
          role = excluded.role,
          granted_by = excluded.granted_by,
          granted_at = excluded.granted_at
      `
        )
        .bind(user.id, user.platformId, user.platform, user.role, user.grantedBy)
        .run()

      // Emit role change event
      const event: RoleEvent = {
        type: existingRole ? 'role.changed' : 'role.assigned',
        userId: user.id,
        role: user.role,
        previousRole: existingRole || undefined,
        performedBy: user.grantedBy,
        timestamp: new Date()
      }

      await this.eventBus.emit('role.change', event, 'role-service')

      logger.info('Role assigned', {
        userId: user.id,
        role: user.role,
        previousRole: existingRole,
        grantedBy: user.grantedBy
      })
    } catch (error) {
      logger.error('Failed to assign role', { error, user })
      throw new Error('Failed to assign role')
    }
  }

  async removeRole(userId: string): Promise<void> {
    try {
      const existingRole = await this.getUserRole(userId)
      if (!existingRole) {
        return
      }

      await this.db.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(userId).run()

      // Emit role removed event
      const event: RoleEvent = {
        type: 'role.removed',
        userId,
        previousRole: existingRole,
        timestamp: new Date()
      }

      await this.eventBus.emit('role.change', event, 'role-service')

      logger.info('Role removed', { userId, previousRole: existingRole })
    } catch (error) {
      logger.error('Failed to remove role', { error, userId })
      throw new Error('Failed to remove role')
    }
  }

  async getUserRole(userId: string): Promise<UserRole | null> {
    try {
      // Check if user is hardcoded owner
      if (this.ownerIds.includes(userId)) {
        return Role.OWNER
      }

      const result = await this.db
        .prepare('SELECT role FROM user_roles WHERE user_id = ?')
        .bind(userId)
        .first<{ role: string }>()

      return (result?.role as UserRole) || null
    } catch (error) {
      logger.error('Failed to get user role', { error, userId })
      return null
    }
  }

  async getUsersByRole(role: UserRole): Promise<RoleUser[]> {
    try {
      const results = await this.db
        .prepare(
          `
        SELECT user_id, platform_id, platform, role, granted_by, granted_at
        FROM user_roles
        WHERE role = ?
        ORDER BY granted_at DESC
      `
        )
        .bind(role)
        .all<{
          user_id: string
          platform_id: string
          platform: string
          role: string
          granted_by: string
          granted_at: string
        }>()

      const users: RoleUser[] = results.results?.map(r => roleUserMapper.toDomain(r)) || []

      // Add hardcoded owners if requested
      if (role === Role.OWNER) {
        for (const ownerId of this.ownerIds) {
          if (!users.find(u => u.id === ownerId)) {
            users.push({
              id: ownerId,
              platformId: ownerId,
              platform: 'system',
              role: Role.OWNER,
              grantedAt: new Date(0) // System owners from the beginning
            })
          }
        }
      }

      return users
    } catch (error) {
      logger.error('Failed to get users by role', { error, role })
      return []
    }
  }

  async getAllRoles(): Promise<RoleUser[]> {
    try {
      const results = await this.db
        .prepare(
          `
        SELECT user_id, platform_id, platform, role, granted_by, granted_at
        FROM user_roles
        ORDER BY role, granted_at DESC
      `
        )
        .all<{
          user_id: string
          platform_id: string
          platform: string
          role: string
          granted_by: string
          granted_at: string
        }>()

      const users: RoleUser[] = results.results?.map(r => roleUserMapper.toDomain(r)) || []

      // Add hardcoded owners
      for (const ownerId of this.ownerIds) {
        if (!users.find(u => u.id === ownerId)) {
          users.push({
            id: ownerId,
            platformId: ownerId,
            platform: 'system',
            role: Role.OWNER,
            grantedAt: new Date(0)
          })
        }
      }

      return users
    } catch (error) {
      logger.error('Failed to get all roles', { error })
      return []
    }
  }

  async hasRole(userId: string, role: UserRole): Promise<boolean> {
    const userRole = await this.getUserRole(userId)
    if (!userRole) return false

    // Check if user has the exact role or a higher one
    return userRole === role || this.hierarchy.isHigherThan(userRole, role)
  }

  async isOwner(userId: string): Promise<boolean> {
    return this.ownerIds.includes(userId) || (await this.hasRole(userId, Role.OWNER))
  }

  async isAdmin(userId: string): Promise<boolean> {
    return await this.hasRole(userId, Role.ADMIN)
  }

  async hasAccess(userId: string): Promise<boolean> {
    // Owners and admins always have access
    if ((await this.isOwner(userId)) || (await this.isAdmin(userId))) {
      return true
    }

    // Check if user has explicit access in the users table
    try {
      const result = await this.db
        .prepare(
          `
        SELECT has_access FROM users 
        WHERE telegram_id = ? OR user_id = ?
      `
        )
        .bind(userId, userId)
        .first<{ has_access: boolean }>()

      return result?.has_access || false
    } catch (error) {
      logger.error('Failed to check user access', { error, userId })
      return false
    }
  }

  async getRoleByPlatformId(platformId: string, platform: string): Promise<UserRole | null> {
    try {
      const result = await this.db
        .prepare(
          `
        SELECT role FROM user_roles 
        WHERE platform_id = ? AND platform = ?
      `
        )
        .bind(platformId, platform)
        .first<{ role: string }>()

      return (result?.role as UserRole) || null
    } catch (error) {
      logger.error('Failed to get role by platform ID', { error, platformId, platform })
      return null
    }
  }

  async getUsersByPlatform(platform: string): Promise<RoleUser[]> {
    try {
      const results = await this.db
        .prepare(
          `
        SELECT user_id, platform_id, platform, role, granted_by, granted_at
        FROM user_roles
        WHERE platform = ?
        ORDER BY granted_at DESC
      `
        )
        .bind(platform)
        .all<{
          user_id: string
          platform_id: string
          platform: string
          role: string
          granted_by: string
          granted_at: string
        }>()

      return results.results?.map(r => roleUserMapper.toDomain(r)) || []
    } catch (error) {
      logger.error('Failed to get users by platform', { error, platform })
      return []
    }
  }
}

class RoleHierarchyImpl implements RoleHierarchy {
  private readonly hierarchy = {
    [Role.OWNER]: 3,
    [Role.ADMIN]: 2,
    [Role.USER]: 1
  }

  isHigherThan(roleA: UserRole, roleB: UserRole): boolean {
    return this.hierarchy[roleA] > this.hierarchy[roleB]
  }

  getHighestRole(roles: UserRole[]): UserRole {
    return roles.reduce(
      (highest, role) => (this.hierarchy[role] > this.hierarchy[highest] ? role : highest),
      Role.USER
    )
  }

  canManageRole(actorRole: UserRole, targetRole: UserRole): boolean {
    // Owners can manage anyone
    if (actorRole === Role.OWNER) return true

    // Admins can only manage users
    if (actorRole === Role.ADMIN && targetRole === Role.USER) return true

    // Users cannot manage anyone
    return false
  }
}

// Factory function
export function createRoleService(
  db: D1Database,
  ownerIds: string[],
  eventBus: EventBus
): RoleService {
  return new UniversalRoleService(db, ownerIds, eventBus)
}
