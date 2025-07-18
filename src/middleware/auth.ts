import type { MiddlewareFn } from 'grammy';

import { logger } from '@/lib/logger';
import type { BotContext } from '@/types';

/**
 * Checks if the user has owner privileges.
 * Owners are defined in BOT_OWNER_IDS environment variable.
 *
 * @param ctx - Bot context with user information
 * @returns true if user is an owner, false otherwise
 */
export function isOwner(ctx: BotContext): boolean {
  const userId = ctx.from?.id;
  if (!userId) return false;

  const ownerIds = ctx.env.BOT_OWNER_IDS?.split(',').map((id: string) => id.trim());
  if (!ownerIds || ownerIds.length === 0) {
    logger.info('BOT_OWNER_IDS not configured');
    return false;
  }

  return ownerIds.includes(userId.toString());
}

/**
 * Checks if the user has admin privileges.
 * Admin status is stored in the database or determined by owner status.
 *
 * @param ctx - Bot context with user information
 * @returns true if user is an admin or owner, false otherwise
 */
export async function isAdmin(ctx: BotContext): Promise<boolean> {
  const userId = ctx.from?.id;
  if (!userId) return false;

  // Owners are always admins
  if (isOwner(ctx)) return true;

  try {
    const userRole = await ctx.env.DB.prepare('SELECT role FROM user_roles WHERE user_id = ?')
      .bind(userId)
      .first<{ role: string }>();

    return userRole?.role === 'admin';
  } catch (error) {
    logger.error('Failed to check admin status', { error, userId });
    return false;
  }
}

/**
 * Checks if the user has access to the bot.
 * Access is determined by the has_access field in the users table.
 *
 * @param ctx - Bot context with user information
 * @returns true if user has access, false otherwise
 */
export async function hasAccess(ctx: BotContext): Promise<boolean> {
  const userId = ctx.from?.id;
  if (!userId) return false;

  // Owners and admins always have access
  if (await isAdmin(ctx)) return true;

  try {
    const user = await ctx.env.DB.prepare('SELECT has_access FROM users WHERE telegram_id = ?')
      .bind(userId)
      .first<{ has_access: boolean }>();

    return user?.has_access || false;
  } catch (error) {
    logger.error('Failed to check user access', { error, userId });
    return false;
  }
}

/**
 * Gets the current debug level from bot settings.
 * Debug levels: 0 = off, 1 = owners only, 2 = owners + admins, 3 = all users
 *
 * @param ctx - Bot context
 * @returns current debug level
 */
export async function getDebugLevel(ctx: BotContext): Promise<number> {
  try {
    const setting = await ctx.env.DB.prepare('SELECT value FROM bot_settings WHERE key = ?')
      .bind('debug_level')
      .first<{ value: string }>();

    return parseInt(setting?.value || '0');
  } catch (error) {
    logger.error('Failed to get debug level', { error });
    return 0;
  }
}

/**
 * Checks if debug messages should be shown to the current user.
 *
 * @param ctx - Bot context
 * @param requiredLevel - Minimum debug level required (1 = owner, 2 = admin, 3 = user)
 * @returns true if debug messages should be shown
 */
export async function isDebugEnabled(ctx: BotContext, requiredLevel: number): Promise<boolean> {
  const debugLevel = await getDebugLevel(ctx);
  if (debugLevel === 0) return false;

  // Check if user meets the debug level requirements
  switch (requiredLevel) {
    case 1: // Owner level
      return debugLevel >= 1 && isOwner(ctx);
    case 2: // Admin level
      return debugLevel >= 2 && (await isAdmin(ctx));
    case 3: // User level
      return debugLevel >= 3;
    default:
      return false;
  }
}

/**
 * Middleware that requires owner privileges.
 * Logs unauthorized access attempts and optionally shows debug messages.
 */
export const requireOwner: MiddlewareFn<BotContext> = async (ctx, next) => {
  if (!isOwner(ctx)) {
    logger.info('Unauthorized command access', {
      userId: ctx.from?.id,
      username: ctx.from?.username,
      command: ctx.message?.text,
      requiredRole: 'owner',
    });

    if (await isDebugEnabled(ctx, 1)) {
      await ctx.reply(ctx.i18n('owner_only'));
    }
    // Silent fail when debug is disabled
    return;
  }

  await next();
};

/**
 * Middleware that requires admin privileges.
 * Logs unauthorized access attempts and optionally shows debug messages.
 */
export const requireAdmin: MiddlewareFn<BotContext> = async (ctx, next) => {
  if (!(await isAdmin(ctx))) {
    logger.info('Unauthorized command access', {
      userId: ctx.from?.id,
      username: ctx.from?.username,
      command: ctx.message?.text,
      requiredRole: 'admin',
    });

    if (await isDebugEnabled(ctx, 2)) {
      await ctx.reply(ctx.i18n('admin_only'));
    }
    // Silent fail when debug is disabled
    return;
  }

  await next();
};

/**
 * Middleware that requires user to have access to the bot.
 * Logs unauthorized access attempts and optionally shows debug messages.
 */
export const requireAccess: MiddlewareFn<BotContext> = async (ctx, next) => {
  if (!(await hasAccess(ctx))) {
    logger.info('User without access tried to use command', {
      userId: ctx.from?.id,
      username: ctx.from?.username,
      command: ctx.message?.text,
    });

    if (await isDebugEnabled(ctx, 3)) {
      await ctx.reply(ctx.i18n('access_denied') + ' ' + ctx.i18n('use_start_to_request'));
    }
    // Silent fail when debug is disabled
    return;
  }

  await next();
};
