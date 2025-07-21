import type { CommandHandler } from '@/types';
import { logger } from '@/lib/logger';

/**
 * Admin management command for bot owners.
 * Allows adding, removing, and listing administrators.
 */
export const adminCommand: CommandHandler = async (ctx) => {
  const args = ctx.match?.toString().trim().split(/\s+/) || [];
  const subCommand = args[0]?.toLowerCase();

  switch (subCommand) {
    case 'add':
      await handleAddAdmin(ctx, args[1]);
      break;

    case 'remove':
      await handleRemoveAdmin(ctx, args[1]);
      break;

    case 'list':
      await handleListAdmins(ctx);
      break;

    default:
      await showAdminHelp(ctx);
  }
};

/**
 * Shows admin command help.
 */
async function showAdminHelp(ctx: Parameters<CommandHandler>[0]) {
  await ctx.reply(ctx.i18n('admin_usage'), { parse_mode: 'HTML' });
}

/**
 * Handles adding a new administrator.
 */
async function handleAddAdmin(ctx: Parameters<CommandHandler>[0], userId?: string) {
  try {
    // Check if DB is available (demo mode check)
    if (!ctx.env.DB) {
      await ctx.reply(
        '🎯 Demo Mode: This feature requires a database.\nConfigure D1 database to enable this functionality.',
      );
      return;
    }

    let targetUserId: number | undefined;

    // Check if a message was forwarded
    const forwardFrom =
      ctx.message && 'forward_from' in ctx.message ? ctx.message.forward_from : undefined;
    if (
      forwardFrom &&
      typeof forwardFrom === 'object' &&
      forwardFrom !== null &&
      'id' in forwardFrom
    ) {
      targetUserId = (forwardFrom as { id: number }).id;
    } else if (userId && /^\d+$/.test(userId)) {
      targetUserId = parseInt(userId);
    } else {
      await ctx.reply(ctx.i18n('invalid_user_id'));
      return;
    }

    if (!targetUserId) {
      await ctx.reply(ctx.i18n('invalid_user_id'));
      return;
    }

    // Check if user exists
    const user = await ctx.env.DB.prepare(
      'SELECT telegram_id, first_name, username FROM users WHERE telegram_id = ?',
    )
      .bind(targetUserId)
      .first<{ telegram_id: number; first_name: string; username: string | null }>();

    if (!user) {
      await ctx.reply(ctx.i18n('user_not_found'));
      return;
    }

    // Check if already admin
    const existingRole = await ctx.env.DB.prepare('SELECT role FROM user_roles WHERE user_id = ?')
      .bind(targetUserId)
      .first<{ role: string }>();

    if (existingRole?.role === 'admin') {
      await ctx.reply(ctx.i18n('admin_already'));
      return;
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
    `,
    )
      .bind(targetUserId, ctx.from?.id || 0)
      .run();

    // Update user access
    await ctx.env.DB.prepare('UPDATE users SET has_access = true WHERE telegram_id = ?')
      .bind(targetUserId)
      .run();

    const userInfo = user.username ? `@${user.username}` : user.first_name;
    const userIdStr = userInfo || targetUserId.toString();
    await ctx.reply(ctx.i18n('admin_added', { userId: userIdStr }), { parse_mode: 'HTML' });

    logger.info('Admin added', {
      targetUserId,
      grantedBy: ctx.from?.id,
      username: user.username,
    });

    // Notify the new admin
    try {
      await ctx.api.sendMessage(targetUserId, ctx.i18n('admin_granted_notification'));
    } catch (error) {
      // User might have blocked the bot
      logger.info('Could not notify new admin', { targetUserId, error });
    }
  } catch (error) {
    logger.error('Failed to add admin', { error });
    await ctx.reply(ctx.i18n('admin_add_error'));
  }
}

/**
 * Handles removing an administrator.
 */
async function handleRemoveAdmin(ctx: Parameters<CommandHandler>[0], userId?: string) {
  try {
    if (!userId || !/^\d+$/.test(userId)) {
      await ctx.reply(ctx.i18n('invalid_user_id'));
      return;
    }

    const targetUserId = parseInt(userId);

    // Check if user is an admin
    const role = await ctx.env
      .DB!.prepare('SELECT role FROM user_roles WHERE user_id = ?')
      .bind(targetUserId)
      .first<{ role: string }>();

    if (!role || role.role !== 'admin') {
      await ctx.reply(ctx.i18n('admin_not_found'));
      return;
    }

    // Remove admin role
    await ctx.env
      .DB!.prepare('DELETE FROM user_roles WHERE user_id = ? AND role = ?')
      .bind(targetUserId, 'admin')
      .run();

    await ctx.reply(ctx.i18n('admin_removed', { userId: targetUserId }), { parse_mode: 'HTML' });

    logger.info('Admin removed', {
      targetUserId,
      removedBy: ctx.from?.id,
    });

    // Notify the former admin
    try {
      await ctx.api.sendMessage(targetUserId, ctx.i18n('admin_revoked_notification'));
    } catch (error) {
      // User might have blocked the bot
      logger.info('Could not notify former admin', { targetUserId, error });
    }
  } catch (error) {
    logger.error('Failed to remove admin', { error });
    await ctx.reply(ctx.i18n('admin_remove_error'));
  }
}

/**
 * Handles listing all administrators.
 */
async function handleListAdmins(ctx: Parameters<CommandHandler>[0]) {
  try {
    const admins = await ctx.env
      .DB!.prepare(
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
    `,
      )
      .all<{
        telegram_id: number;
        first_name: string;
        username: string | null;
        granted_at: string;
        granted_by: number;
      }>();

    if (!admins.results || admins.results.length === 0) {
      await ctx.reply(ctx.i18n('admin_list_empty'));
      return;
    }

    let adminsList = '';
    for (const admin of admins.results) {
      const userInfo = admin.username ? `@${admin.username}` : admin.first_name;
      const grantedDate = new Date(admin.granted_at as string).toLocaleDateString();
      adminsList += `• ${userInfo} (ID: ${admin.telegram_id})\n`;
      adminsList += `  ${ctx.i18n('added_date')}: ${grantedDate}\n\n`;
    }

    await ctx.reply(ctx.i18n('admin_list', { admins: adminsList.trim() }), { parse_mode: 'HTML' });
  } catch (error) {
    logger.error('Failed to list admins', { error });
    await ctx.reply(ctx.i18n('admin_list_error'));
  }
}
