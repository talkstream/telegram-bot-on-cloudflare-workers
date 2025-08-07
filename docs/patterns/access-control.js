/**
 * Access Control Pattern
 *
 * Role-based access control (RBAC) implementation for Telegram bots
 * with hierarchical permissions, access requests, and audit logging.
 */

// Role Hierarchy
export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest'
}

// Role hierarchy (higher roles inherit lower role permissions)
export const ROLE_HIERARCHY = {
  [ROLES.OWNER]: [ROLES.ADMIN, ROLES.USER, ROLES.GUEST],
  [ROLES.ADMIN]: [ROLES.USER, ROLES.GUEST],
  [ROLES.USER]: [ROLES.GUEST],
  [ROLES.GUEST]: []
}

// Access Control Service
export class AccessControlService {
  constructor(db, cache) {
    this.db = db
    this.cache = cache
    this.permissions = new Map()
  }

  // Check if user has specific role
  async hasRole(userId, role) {
    // Check cache first
    const cacheKey = `role:${userId}`
    const cached = await this.cache.get(cacheKey)
    if (cached) {
      return this.roleIncludes(cached, role)
    }

    // Check database
    const userRole = await this.getUserRole(userId)
    if (userRole) {
      await this.cache.put(cacheKey, userRole, { expirationTtl: 3600 }) // 1 hour
      return this.roleIncludes(userRole, role)
    }

    return false
  }

  // Check if user has permission
  async hasPermission(userId, permission) {
    const userRole = await this.getUserRole(userId)
    if (!userRole) return false

    const rolePermissions = this.permissions.get(userRole) || []
    return rolePermissions.includes(permission)
  }

  // Get user's role from database
  async getUserRole(userId) {
    const result = await this.db
      .prepare(
        `
      SELECT r.role 
      FROM users u
      JOIN user_roles r ON u.id = r.user_id
      WHERE u.telegram_id = ?
    `
      )
      .bind(userId)
      .first()

    return result?.role
  }

  // Check if role includes another role (hierarchy)
  roleIncludes(userRole, requiredRole) {
    if (userRole === requiredRole) return true

    const hierarchy = ROLE_HIERARCHY[userRole] || []
    return hierarchy.includes(requiredRole)
  }

  // Grant role to user
  async grantRole(userId, role, grantedBy) {
    // Get or create user
    const user = await this.getOrCreateUser(userId)

    // Check if already has role
    const existingRole = await this.getUserRole(userId)
    if (existingRole === role) {
      return { success: false, reason: 'already_has_role' }
    }

    // Insert or update role
    await this.db
      .prepare(
        `
      INSERT OR REPLACE INTO user_roles (user_id, role, granted_by, granted_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `
      )
      .bind(user.id, role, grantedBy)
      .run()

    // Clear cache
    await this.cache.delete(`role:${userId}`)

    // Log audit
    await this.logAudit(userId, 'role_granted', { role, grantedBy })

    return { success: true }
  }

  // Revoke role from user
  async revokeRole(userId, revokedBy) {
    const user = await this.getUser(userId)
    if (!user) {
      return { success: false, reason: 'user_not_found' }
    }

    const currentRole = await this.getUserRole(userId)
    if (!currentRole) {
      return { success: false, reason: 'no_role' }
    }

    // Delete role
    await this.db
      .prepare(
        `
      DELETE FROM user_roles WHERE user_id = ?
    `
      )
      .bind(user.id)
      .run()

    // Clear cache
    await this.cache.delete(`role:${userId}`)

    // Log audit
    await this.logAudit(userId, 'role_revoked', { role: currentRole, revokedBy })

    return { success: true, previousRole: currentRole }
  }

  // Define permissions for roles
  definePermissions(rolePermissions) {
    Object.entries(rolePermissions).forEach(([role, permissions]) => {
      this.permissions.set(role, permissions)
    })
  }

  // Helper methods
  async getOrCreateUser(telegramId) {
    let user = await this.db
      .prepare('SELECT * FROM users WHERE telegram_id = ?')
      .bind(telegramId)
      .first()

    if (!user) {
      await this.db.prepare('INSERT INTO users (telegram_id) VALUES (?)').bind(telegramId).run()

      user = await this.db
        .prepare('SELECT * FROM users WHERE telegram_id = ?')
        .bind(telegramId)
        .first()
    }

    return user
  }

  async getUser(telegramId) {
    return this.db.prepare('SELECT * FROM users WHERE telegram_id = ?').bind(telegramId).first()
  }

  async logAudit(userId, action, details) {
    await this.db
      .prepare(
        `
      INSERT INTO audit_logs (user_id, action, details, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `
      )
      .bind(userId, action, JSON.stringify(details))
      .run()
  }
}

// Middleware Factory
export function createAccessMiddleware(accessService) {
  return {
    // Require specific role
    requireRole: role => async (ctx, next) => {
      const userId = ctx.from?.id
      if (!userId) {
        return ctx.reply('❌ Unable to identify user')
      }

      const hasRole = await accessService.hasRole(userId, role)
      if (!hasRole) {
        return ctx.reply(`🚫 This command requires ${role} role`)
      }

      await next()
    },

    // Require specific permission
    requirePermission: permission => async (ctx, next) => {
      const userId = ctx.from?.id
      if (!userId) {
        return ctx.reply('❌ Unable to identify user')
      }

      const hasPermission = await accessService.hasPermission(userId, permission)
      if (!hasPermission) {
        return ctx.reply("🚫 You don't have permission to perform this action")
      }

      await next()
    },

    // Require any of the roles
    requireAnyRole:
      (...roles) =>
      async (ctx, next) => {
        const userId = ctx.from?.id
        if (!userId) {
          return ctx.reply('❌ Unable to identify user')
        }

        for (const role of roles) {
          if (await accessService.hasRole(userId, role)) {
            await next()
            return
          }
        }

        return ctx.reply("🚫 You don't have the required role for this command")
      }
  }
}

// Access Request System
export class AccessRequestManager {
  constructor(db, bot) {
    this.db = db
    this.bot = bot
  }

  // Create access request
  async createRequest(userId, userData) {
    // Check if already has access
    const existingRole = await this.db
      .prepare(
        `
      SELECT r.role FROM users u
      JOIN user_roles r ON u.id = r.user_id
      WHERE u.telegram_id = ?
    `
      )
      .bind(userId)
      .first()

    if (existingRole) {
      return { success: false, reason: 'already_has_access' }
    }

    // Check for pending request
    const pendingRequest = await this.db
      .prepare(
        `
      SELECT * FROM access_requests
      WHERE user_id = ? AND status = 'pending'
    `
      )
      .bind(userId)
      .first()

    if (pendingRequest) {
      return { success: false, reason: 'request_exists' }
    }

    // Create user if not exists
    await this.db
      .prepare(
        `
      INSERT OR IGNORE INTO users (telegram_id, username, first_name, last_name)
      VALUES (?, ?, ?, ?)
    `
      )
      .bind(userId, userData.username, userData.first_name, userData.last_name)
      .run()

    // Get user ID
    const user = await this.db
      .prepare('SELECT id FROM users WHERE telegram_id = ?')
      .bind(userId)
      .first()

    // Create request
    await this.db
      .prepare(
        `
      INSERT INTO access_requests (user_id, status, requested_at)
      VALUES (?, 'pending', CURRENT_TIMESTAMP)
    `
      )
      .bind(user.id)
      .run()

    // Notify admins
    await this.notifyAdmins(userId, userData)

    return { success: true }
  }

  // Approve access request
  async approveRequest(requestId, approvedBy, role = ROLES.USER) {
    const request = await this.db
      .prepare('SELECT * FROM access_requests WHERE id = ?')
      .bind(requestId)
      .first()

    if (!request || request.status !== 'pending') {
      return { success: false, reason: 'invalid_request' }
    }

    // Update request
    await this.db
      .prepare(
        `
      UPDATE access_requests 
      SET status = 'approved', resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
      WHERE id = ?
    `
      )
      .bind(approvedBy, requestId)
      .run()

    // Get user info
    const user = await this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(request.user_id)
      .first()

    // Grant role
    await this.db
      .prepare(
        `
      INSERT INTO user_roles (user_id, role, granted_by, granted_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `
      )
      .bind(request.user_id, role, approvedBy)
      .run()

    // Notify user
    await this.notifyUser(user.telegram_id, 'approved', role)

    return { success: true, userId: user.telegram_id }
  }

  // Reject access request
  async rejectRequest(requestId, rejectedBy, reason) {
    const request = await this.db
      .prepare('SELECT * FROM access_requests WHERE id = ?')
      .bind(requestId)
      .first()

    if (!request || request.status !== 'pending') {
      return { success: false, reason: 'invalid_request' }
    }

    // Update request
    await this.db
      .prepare(
        `
      UPDATE access_requests 
      SET status = 'rejected', resolved_at = CURRENT_TIMESTAMP, resolved_by = ?, rejection_reason = ?
      WHERE id = ?
    `
      )
      .bind(rejectedBy, reason, requestId)
      .run()

    // Get user info
    const user = await this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(request.user_id)
      .first()

    // Notify user
    await this.notifyUser(user.telegram_id, 'rejected', null, reason)

    return { success: true }
  }

  // Notify admins about new request
  async notifyAdmins(userId, userData) {
    const admins = await this.db
      .prepare(
        `
      SELECT u.telegram_id 
      FROM users u
      JOIN user_roles r ON u.id = r.user_id
      WHERE r.role IN ('admin', 'owner')
    `
      )
      .all()

    const userInfo = userData.username ? `@${userData.username}` : userData.first_name

    for (const admin of admins.results) {
      try {
        await this.bot.api.sendMessage(
          admin.telegram_id,
          `🔔 New access request from ${userInfo} (ID: ${userId})`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: '📋 View Requests', callback_data: 'admin:requests' }]]
            }
          }
        )
      } catch (error) {
        console.error(`Failed to notify admin ${admin.telegram_id}:`, error)
      }
    }
  }

  // Notify user about request status
  async notifyUser(userId, status, role, reason) {
    const messages = {
      approved: `🎉 Your access request has been approved! You now have ${role} access.`,
      rejected: `❌ Your access request has been rejected${reason ? `: ${reason}` : '.'}`
    }

    try {
      await this.bot.api.sendMessage(userId, messages[status])
    } catch (error) {
      console.error(`Failed to notify user ${userId}:`, error)
    }
  }
}

// Permission Definitions Example
export const DEFAULT_PERMISSIONS = {
  [ROLES.OWNER]: [
    'manage_admins',
    'manage_users',
    'view_logs',
    'change_settings',
    'use_debug',
    'manage_bot'
  ],
  [ROLES.ADMIN]: ['manage_users', 'view_logs', 'change_settings', 'moderate_content'],
  [ROLES.USER]: ['use_commands', 'view_stats', 'use_features'],
  [ROLES.GUEST]: ['view_info']
}

// Database Schema
export const ACCESS_CONTROL_SCHEMA = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  is_blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User roles table
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'user', 'guest')),
  granted_by TEXT,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Access requests table
CREATE TABLE IF NOT EXISTS access_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  resolved_by INTEGER,
  rejection_reason TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action);
`

// Usage Example
/*
// Initialize services
const accessService = new AccessControlService(env.DB, env.CACHE);
accessService.definePermissions(DEFAULT_PERMISSIONS);

const requestManager = new AccessRequestManager(env.DB, bot);

// Create middleware
const { requireRole, requirePermission } = createAccessMiddleware(accessService);

// Use in bot commands
bot.command('admin', requireRole(ROLES.ADMIN), adminCommand);
bot.command('settings', requirePermission('change_settings'), settingsCommand);
bot.command('debug', requireRole(ROLES.OWNER), debugCommand);

// Handle access requests
bot.command('request_access', async (ctx) => {
  const result = await requestManager.createRequest(
    ctx.from.id,
    {
      username: ctx.from.username,
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name
    }
  );
  
  if (result.success) {
    await ctx.reply('✅ Your access request has been sent to administrators.');
  } else if (result.reason === 'already_has_access') {
    await ctx.reply('You already have access to the bot!');
  } else if (result.reason === 'request_exists') {
    await ctx.reply('You already have a pending access request.');
  }
});
*/
