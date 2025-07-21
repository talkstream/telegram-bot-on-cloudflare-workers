import type { MiddlewareFn } from 'grammy';

import type { BotContext } from '@/types';
import type { RoleService } from '@/core/interfaces/role-system';
import { logger } from '@/lib/logger';
import { hasDatabase } from '@/lib/env-guards';

/**
 * Universal auth middleware that works with the new role system
 */

export function createAuthMiddleware(roleService: RoleService) {
  const getUserId = (ctx: BotContext): string | null => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return null;
    return `telegram_${telegramId}`;
  };

  /**
   * Check if user is an owner
   */
  const isOwner = async (ctx: BotContext): Promise<boolean> => {
    const userId = getUserId(ctx);
    if (!userId) return false;

    return await roleService.isOwner(userId);
  };

  /**
   * Check if user is an admin
   */
  const isAdmin = async (ctx: BotContext): Promise<boolean> => {
    const userId = getUserId(ctx);
    if (!userId) return false;

    return await roleService.isAdmin(userId);
  };

  /**
   * Check if user has access
   */
  const hasAccess = async (ctx: BotContext): Promise<boolean> => {
    const userId = getUserId(ctx);
    if (!userId) return false;

    return await roleService.hasAccess(userId);
  };

  /**
   * Get debug level from settings
   */
  const getDebugLevel = async (ctx: BotContext): Promise<number> => {
    if (!hasDatabase(ctx.env)) {
      return 3; // Show debug to all in demo mode
    }

    try {
      const setting = await ctx.env.DB.prepare('SELECT value FROM bot_settings WHERE key = ?')
        .bind('debug_level')
        .first<{ value: string }>();

      return parseInt(setting?.value || '0');
    } catch (error) {
      logger.error('Failed to get debug level', { error });
      return 0;
    }
  };

  /**
   * Check if debug messages should be shown
   */
  const isDebugEnabled = async (ctx: BotContext, requiredLevel: number): Promise<boolean> => {
    const debugLevel = await getDebugLevel(ctx);
    if (debugLevel === 0) return false;

    switch (requiredLevel) {
      case 1: // Owner level
        return debugLevel >= 1 && (await isOwner(ctx));
      case 2: // Admin level
        return debugLevel >= 2 && (await isAdmin(ctx));
      case 3: // User level
        return debugLevel >= 3;
      default:
        return false;
    }
  };

  /**
   * Middleware that requires owner privileges
   */
  const requireOwner: MiddlewareFn<BotContext> = async (ctx, next) => {
    if (!(await isOwner(ctx))) {
      logger.info('Unauthorized command access', {
        userId: ctx.from?.id,
        username: ctx.from?.username,
        command: ctx.message?.text,
        requiredRole: 'owner',
      });

      if (await isDebugEnabled(ctx, 1)) {
        await ctx.reply(ctx.i18n('owner_only'));
      }
      return;
    }

    await next();
  };

  /**
   * Middleware that requires admin privileges
   */
  const requireAdmin: MiddlewareFn<BotContext> = async (ctx, next) => {
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
      return;
    }

    await next();
  };

  /**
   * Middleware that requires user access
   */
  const requireAccess: MiddlewareFn<BotContext> = async (ctx, next) => {
    if (!(await hasAccess(ctx))) {
      logger.info('User without access tried to use command', {
        userId: ctx.from?.id,
        username: ctx.from?.username,
        command: ctx.message?.text,
      });

      if (await isDebugEnabled(ctx, 3)) {
        await ctx.reply(ctx.i18n('access_denied') + ' ' + ctx.i18n('use_start_to_request'));
      }
      return;
    }

    await next();
  };

  return {
    isOwner,
    isAdmin,
    hasAccess,
    getDebugLevel,
    isDebugEnabled,
    requireOwner,
    requireAdmin,
    requireAccess,
  };
}

// Export types for convenience
export type AuthMiddleware = ReturnType<typeof createAuthMiddleware>;
