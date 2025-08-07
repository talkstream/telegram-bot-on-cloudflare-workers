import { UserRole } from '@/core/interfaces/role-system'
import { hasDatabase } from '@/lib/env-guards'
import { logger } from '@/lib/logger'
import type { CommandHandler } from '@/types'

/**
 * Admin management command for bot owners.
 * Allows adding, removing, and listing administrators.
 */
export const adminCommand: CommandHandler = async ctx => {
  const args = ctx.match?.toString().trim().split(/\s+/) || []
  const subCommand = args[0]?.toLowerCase()

  switch (subCommand) {
    case 'add':
      await handleAddAdmin(ctx, args[1])
      break

    case 'remove':
      await handleRemoveAdmin(ctx, args[1])
      break

    case 'list':
      await handleListAdmins(ctx)
      break

    default:
      await showAdminHelp(ctx)
  }
}

/**
 * Shows admin command help.
 */
async function showAdminHelp(ctx: Parameters<CommandHandler>[0]) {
  await ctx.reply(ctx.i18n.t('commands.admin.usage', { namespace: 'telegram' }), {
    parse_mode: 'HTML'
  })
}

/**
 * Handles adding a new administrator.
 */
async function handleAddAdmin(ctx: Parameters<CommandHandler>[0], userId?: string) {
  try {
    // Check if DB is available (demo mode check)
    if (!hasDatabase(ctx.env)) {
      await ctx.reply(
        '🎯 Demo Mode: This feature requires a database.\nConfigure D1 database to enable this functionality.'
      )
      return
    }

    let targetUserId: number | undefined

    // Check if a message was forwarded
    const forwardFrom =
      ctx.message && 'forward_from' in ctx.message ? ctx.message.forward_from : undefined
    if (
      forwardFrom &&
      typeof forwardFrom === 'object' &&
      forwardFrom !== null &&
      'id' in forwardFrom
    ) {
      targetUserId = (forwardFrom as { id: number }).id
    } else if (userId && /^\d+$/.test(userId)) {
      targetUserId = parseInt(userId)
    } else {
      await ctx.reply(ctx.i18n.t('messages.invalid_user_id', { namespace: 'access' }))
      return
    }

    if (!targetUserId) {
      await ctx.reply(ctx.i18n.t('messages.invalid_user_id', { namespace: 'access' }))
      return
    }

    // Check if user exists
    const user = await ctx.env.DB.prepare(
      'SELECT telegram_id, first_name, username FROM users WHERE telegram_id = ?'
    )
      .bind(targetUserId)
      .first<{ telegram_id: number; first_name: string; username: string | null }>()

    if (!user) {
      await ctx.reply(ctx.i18n.t('messages.user_not_found', { namespace: 'access' }))
      return
    }

    // Check if roleService is available for universal system
    if (ctx.roleService) {
      // Use universal role system
      const currentRole = await ctx.roleService.getUserRole(targetUserId.toString())
      if (currentRole === UserRole.ADMIN) {
        await ctx.reply(ctx.i18n.t('commands.admin.already', { namespace: 'telegram' }))
        return
      }

      await ctx.roleService.assignRole({
        id: targetUserId.toString(),
        platformId: targetUserId.toString(),
        platform: 'telegram',
        role: UserRole.ADMIN,
        grantedBy: ctx.from?.id?.toString()
      })
    } else {
      // Fallback to legacy system
      const existingRole = await ctx.env.DB.prepare('SELECT role FROM user_roles WHERE user_id = ?')
        .bind(targetUserId)
        .first<{ role: string }>()

      if (existingRole?.role === 'admin') {
        await ctx.reply(ctx.i18n.t('commands.admin.already', { namespace: 'telegram' }))
        return
      }

      // Add admin role
      await ctx.env.DB.prepare(
        `
        INSERT INTO user_roles (user_id, role, granted_by, granted_at)
        VALUES (?, 'admin', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET 
          role = 'admin',
          granted_by = excluded.granted_by,
          granted_at = excluded.granted_at
      `
      )
        .bind(targetUserId, ctx.from?.id || 0)
        .run()
    }

    // Update user access
    await ctx.env.DB.prepare('UPDATE users SET has_access = true WHERE telegram_id = ?')
      .bind(targetUserId)
      .run()

    const userInfo = user.username ? `@${user.username}` : user.first_name
    const userIdStr = userInfo || targetUserId.toString()
    await ctx.reply(
      ctx.i18n.t('commands.admin.added', { namespace: 'telegram', params: { userId: userIdStr } }),
      { parse_mode: 'HTML' }
    )

    logger.info('Admin added', {
      targetUserId,
      grantedBy: ctx.from?.id,
      username: user.username
    })

    // Notify the new admin
    try {
      await ctx.api.sendMessage(
        targetUserId,
        ctx.i18n.t('commands.admin.granted_notification', { namespace: 'telegram' })
      )
    } catch (error) {
      // User might have blocked the bot
      logger.info('Could not notify new admin', { targetUserId, error })
    }
  } catch (error) {
    logger.error('Failed to add admin', { error })
    await ctx.reply(ctx.i18n.t('commands.admin.add_error', { namespace: 'telegram' }))
  }
}

/**
 * Handles removing an administrator.
 */
async function handleRemoveAdmin(ctx: Parameters<CommandHandler>[0], userId?: string) {
  try {
    // Check if DB is available (demo mode check)
    if (!hasDatabase(ctx.env)) {
      await ctx.reply(
        '🎯 Demo Mode: This feature requires a database.\nConfigure D1 database to enable this functionality.'
      )
      return
    }

    if (!userId || !/^\d+$/.test(userId)) {
      await ctx.reply(ctx.i18n.t('messages.invalid_user_id', { namespace: 'access' }))
      return
    }

    const targetUserId = parseInt(userId)

    // Check if roleService is available for universal system
    if (ctx.roleService) {
      // Use universal role system
      const currentRole = await ctx.roleService.getUserRole(targetUserId.toString())
      if (currentRole !== UserRole.ADMIN) {
        await ctx.reply(ctx.i18n.t('commands.admin.not_found', { namespace: 'telegram' }))
        return
      }

      await ctx.roleService.removeRole(targetUserId.toString())
    } else {
      // Fallback to legacy system
      const role = await ctx.env.DB.prepare('SELECT role FROM user_roles WHERE user_id = ?')
        .bind(targetUserId)
        .first<{ role: string }>()

      if (!role || role.role !== 'admin') {
        await ctx.reply(ctx.i18n.t('commands.admin.not_found', { namespace: 'telegram' }))
        return
      }

      // Remove admin role
      await ctx.env.DB.prepare('DELETE FROM user_roles WHERE user_id = ? AND role = ?')
        .bind(targetUserId, 'admin')
        .run()
    }

    await ctx.reply(
      ctx.i18n.t('commands.admin.removed', {
        namespace: 'telegram',
        params: { userId: targetUserId }
      }),
      { parse_mode: 'HTML' }
    )

    logger.info('Admin removed', {
      targetUserId,
      removedBy: ctx.from?.id
    })

    // Notify the former admin
    try {
      await ctx.api.sendMessage(
        targetUserId,
        ctx.i18n.t('commands.admin.revoked_notification', { namespace: 'telegram' })
      )
    } catch (error) {
      // User might have blocked the bot
      logger.info('Could not notify former admin', { targetUserId, error })
    }
  } catch (error) {
    logger.error('Failed to remove admin', { error })
    await ctx.reply(ctx.i18n.t('commands.admin.remove_error', { namespace: 'telegram' }))
  }
}

/**
 * Handles listing all administrators.
 */
async function handleListAdmins(ctx: Parameters<CommandHandler>[0]) {
  try {
    // Check if DB is available (demo mode check)
    if (!hasDatabase(ctx.env)) {
      await ctx.reply(
        '🎯 Demo Mode: This feature requires a database.\nConfigure D1 database to enable this functionality.'
      )
      return
    }

    let adminsList = ''

    // Check if roleService is available for universal system
    if (ctx.roleService) {
      // Use universal role system
      const users = await ctx.roleService.getUsersByRole(UserRole.ADMIN)

      if (!users || users.length === 0) {
        await ctx.reply(ctx.i18n.t('commands.admin.list_empty', { namespace: 'telegram' }))
        return
      }

      // Get user details from Telegram users table
      for (const roleUser of users) {
        const user = await ctx.env.DB.prepare(
          'SELECT telegram_id, first_name, username FROM users WHERE telegram_id = ?'
        )
          .bind(parseInt(roleUser.platformId))
          .first<{ telegram_id: number; first_name: string; username: string | null }>()

        if (user) {
          const userInfo = user.username ? `@${user.username}` : user.first_name
          const grantedDate = new Date(roleUser.grantedAt).toLocaleDateString()
          adminsList += `• ${userInfo} (ID: ${user.telegram_id})\n`
          adminsList += `  ${ctx.i18n.t('messages.added_date', { namespace: 'access' })}: ${grantedDate}\n\n`
        }
      }
    } else {
      // Fallback to legacy system
      const admins = await ctx.env.DB.prepare(
        `
        SELECT 
          u.telegram_id,
          u.first_name,
          u.username,
          r.granted_at,
          r.granted_by
        FROM user_roles r
        JOIN users u ON r.user_id = u.telegram_id
        WHERE r.role = 'admin'
        ORDER BY r.granted_at DESC
      `
      ).all<{
        telegram_id: number
        first_name: string
        username: string | null
        granted_at: string
        granted_by: number
      }>()

      if (!admins.results || admins.results.length === 0) {
        await ctx.reply(ctx.i18n.t('commands.admin.list_empty', { namespace: 'telegram' }))
        return
      }

      for (const admin of admins.results) {
        const userInfo = admin.username ? `@${admin.username}` : admin.first_name
        const grantedDate = new Date(admin.granted_at as string).toLocaleDateString()
        adminsList += `• ${userInfo} (ID: ${admin.telegram_id})\n`
        adminsList += `  ${ctx.i18n.t('messages.added_date', { namespace: 'access' })}: ${grantedDate}\n\n`
      }
    }

    await ctx.reply(
      ctx.i18n.t('commands.admin.list', {
        namespace: 'telegram',
        params: { admins: adminsList.trim() }
      }),
      { parse_mode: 'HTML' }
    )
  } catch (error) {
    logger.error('Failed to list admins', { error })
    await ctx.reply(ctx.i18n.t('commands.admin.list_error', { namespace: 'telegram' }))
  }
}
