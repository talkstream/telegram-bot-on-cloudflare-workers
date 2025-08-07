import type { CommandHandler } from '@/types'
// Using roleService from context
import { UserRole } from '@/core/interfaces/role-system'

export const helpCommand: CommandHandler = async ctx => {
  // Build help message based on user role
  let helpMessage = ctx.i18n.t('commands.help.user', { namespace: 'telegram' })

  // Determine user role using roleService
  let isAdmin = false
  let isOwner = false

  if (!ctx.roleService) {
    throw new Error('RoleService is required')
  }

  const userId = ctx.from?.id?.toString()
  if (userId) {
    const userRole = await ctx.roleService.getUserRole(`telegram_${userId}`)
    isAdmin = userRole === UserRole.ADMIN || userRole === UserRole.OWNER
    isOwner = userRole === UserRole.OWNER
  }

  // Add admin commands if user is admin
  if (isAdmin || isOwner) {
    helpMessage += ctx.i18n.t('commands.help.admin', { namespace: 'telegram' })
  }

  // Add owner commands if user is owner
  if (isOwner) {
    helpMessage += ctx.i18n.t('commands.help.owner', { namespace: 'telegram' })
  }

  await ctx.reply(helpMessage, {
    parse_mode: 'HTML'
  })

  // Update session
  if (ctx.session) {
    ctx.session.lastCommand = 'help'
    ctx.session.lastActivity = Date.now()
  }
}
