import type { CommandHandler } from '@/types';
import { isOwner as legacyIsOwner, isAdmin as legacyIsAdmin } from '@/middleware/auth';
import { UserRole } from '@/core/interfaces/role-system';

export const helpCommand: CommandHandler = async (ctx) => {
  // Build help message based on user role
  let helpMessage = ctx.i18n('help_user');

  // Determine user role - check if roleService is available in context
  let isAdmin = false;
  let isOwner = false;

  if (ctx.roleService) {
    // Use new universal role system
    const userId = ctx.from?.id?.toString();
    if (userId) {
      const userRole = await ctx.roleService.getUserRole(userId);
      isAdmin = userRole === UserRole.ADMIN || userRole === UserRole.OWNER;
      isOwner = userRole === UserRole.OWNER;
    }
  } else {
    // Fallback to legacy system
    isAdmin = await legacyIsAdmin(ctx);
    isOwner = legacyIsOwner(ctx);
  }

  // Add admin commands if user is admin
  if (isAdmin || isOwner) {
    helpMessage += ctx.i18n('help_admin');
  }

  // Add owner commands if user is owner
  if (isOwner) {
    helpMessage += ctx.i18n('help_owner');
  }

  await ctx.reply(helpMessage, {
    parse_mode: 'HTML',
  });

  // Update session
  if (ctx.session) {
    ctx.session.lastCommand = 'help';
    ctx.session.lastActivity = Date.now();
  }
};
