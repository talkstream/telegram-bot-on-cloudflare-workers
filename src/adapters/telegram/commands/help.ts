import type { CommandHandler } from '@/types';
import { isOwner, isAdmin } from '@/middleware/auth';

export const helpCommand: CommandHandler = async (ctx) => {
  // Build help message based on user role
  let helpMessage = ctx.i18n('help_user');

  // Add admin commands if user is admin
  if ((await isAdmin(ctx)) || isOwner(ctx)) {
    helpMessage += ctx.i18n('help_admin');
  }

  // Add owner commands if user is owner
  if (isOwner(ctx)) {
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
