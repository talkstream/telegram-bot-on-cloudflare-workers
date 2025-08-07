import type { CommandHandler } from '@/types'

export const batchCommand: CommandHandler = async ctx => {
  await ctx.reply(ctx.i18n.t('commands.batch.info', { namespace: 'telegram' }), {
    parse_mode: 'HTML'
  })
}
