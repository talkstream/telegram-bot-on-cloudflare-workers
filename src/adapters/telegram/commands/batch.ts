import type { CommandHandler } from '@/types';

export const batchCommand: CommandHandler = async (ctx) => {
  await ctx.reply(ctx.i18n('batch_info'), { parse_mode: 'HTML' });
};
