/**
 * Universal role system interfaces for platform-agnostic access control
 */

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  USER = 'user'
}

export interface RoleUser {
  id: string // Platform-agnostic user identifier
  platformId: string // Platform-specific ID (e.g., Telegram ID, Discord ID)
  platform: string // Platform name (telegram, discord, slack, etc.)
  role: UserRole
  grantedBy?: string
  grantedAt: Date
}

export interface RoleCheck {
  userId: string
  platformId: string
  platform: string
  requiredRole: UserRole
}

export interface RoleService {
  // Role management
  assignRole(user: Omit<RoleUser, 'grantedAt'>): Promise<void>
  removeRole(userId: string): Promise<void>
  getUserRole(userId: string): Promise<UserRole | null>

  // Batch operations
  getUsersByRole(role: UserRole): Promise<RoleUser[]>
  getAllRoles(): Promise<RoleUser[]>

  // Access checks
  hasRole(userId: string, role: UserRole): Promise<boolean>
  isOwner(userId: string): Promise<boolean>
  isAdmin(userId: string): Promise<boolean>
  hasAccess(userId: string): Promise<boolean>

  // Platform-specific lookups
  getRoleByPlatformId(platformId: string, platform: string): Promise<UserRole | null>
  getUsersByPlatform(platform: string): Promise<RoleUser[]>
}

export interface RoleEvent {
  type: 'role.assigned' | 'role.removed' | 'role.changed'
  userId: string
  role?: UserRole
  previousRole?: UserRole
  performedBy?: string
  timestamp: Date
}

export interface RolePermission {
  role: UserRole
  permissions: string[]
}

export interface RoleHierarchy {
  isHigherThan(roleA: UserRole, roleB: UserRole): boolean
  getHighestRole(roles: UserRole[]): UserRole
  canManageRole(actorRole: UserRole, targetRole: UserRole): boolean
}
