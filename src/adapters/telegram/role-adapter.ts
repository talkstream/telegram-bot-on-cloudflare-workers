import type { RoleService } from '@/core/interfaces/role-system'
import { UserRole } from '@/core/interfaces/role-system'
import { logger } from '@/lib/logger'
import type { BotContext } from '@/types'

/**
 * Adapter to bridge Telegram-specific auth functions with universal role system
 */
export class TelegramRoleAdapter {
  constructor(private roleService: RoleService) {}

  /**
   * Check if user is an owner
   */
  async isOwner(ctx: BotContext): Promise<boolean> {
    const userId = this.getUserId(ctx)
    if (!userId) return false

    return await this.roleService.isOwner(userId)
  }

  /**
   * Check if user is an admin
   */
  async isAdmin(ctx: BotContext): Promise<boolean> {
    const userId = this.getUserId(ctx)
    if (!userId) return false

    return await this.roleService.isAdmin(userId)
  }

  /**
   * Check if user has access
   */
  async hasAccess(ctx: BotContext): Promise<boolean> {
    const userId = this.getUserId(ctx)
    if (!userId) return false

    return await this.roleService.hasAccess(userId)
  }

  /**
   * Assign role to user
   */
  async assignRole(ctx: BotContext, targetUserId: number, role: UserRole): Promise<void> {
    const grantedBy = this.getUserId(ctx)

    await this.roleService.assignRole({
      id: `telegram_${targetUserId}`,
      platformId: targetUserId.toString(),
      platform: 'telegram',
      role,
      grantedBy: grantedBy || undefined
    })

    // Update access in users table if needed
    if (role === UserRole.ADMIN || role === UserRole.OWNER) {
      await this.updateUserAccess(ctx, targetUserId, true)
    }
  }

  /**
   * Remove role from user
   */
  async removeRole(targetUserId: number): Promise<void> {
    const userId = `telegram_${targetUserId}`
    await this.roleService.removeRole(userId)
  }

  /**
   * Get user role
   */
  async getUserRole(ctx: BotContext, targetUserId?: number): Promise<UserRole | null> {
    const userId = targetUserId ? `telegram_${targetUserId}` : this.getUserId(ctx)

    if (!userId) return null

    return await this.roleService.getUserRole(userId)
  }

  /**
   * List users by role
   */
  async getUsersByRole(role: UserRole) {
    const allUsers = await this.roleService.getUsersByRole(role)
    return allUsers.filter(u => u.platform === 'telegram')
  }

  /**
   * Helper to get universal user ID from context
   */
  private getUserId(ctx: BotContext): string | null {
    const telegramId = ctx.from?.id
    if (!telegramId) return null

    return `telegram_${telegramId}`
  }

  /**
   * Update user access in the users table
   */
  private async updateUserAccess(
    ctx: BotContext,
    telegramId: number,
    hasAccess: boolean
  ): Promise<void> {
    if (!ctx.env.DB) return

    try {
      await ctx.env.DB.prepare('UPDATE users SET has_access = ? WHERE telegram_id = ?')
        .bind(hasAccess, telegramId)
        .run()
    } catch (error) {
      logger.error('Failed to update user access', { error, telegramId })
    }
  }
}

// Factory function
export function createTelegramRoleAdapter(roleService: RoleService): TelegramRoleAdapter {
  return new TelegramRoleAdapter(roleService)
}
