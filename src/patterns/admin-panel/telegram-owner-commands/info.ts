import { CloudPlatformFactory } from '@/core/cloud/platform-factory'
import { hasDatabase } from '@/lib/env-guards'
import { logger } from '@/lib/logger'
import type { CommandHandler, Env } from '@/types'

/**
 * Technical information command for bot owners.
 * Shows system status, resource usage, and statistics.
 */
export const infoCommand: CommandHandler = async ctx => {
  const { env } = ctx

  try {
    // Calculate uptime
    const startTime = (ctx.session?.data?.botStartTime as number | undefined) ?? Date.now()
    const uptime = Date.now() - startTime
    const uptimeHours = Math.floor(uptime / (1000 * 60 * 60))
    const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60))

    // Get user statistics
    const userStats = hasDatabase(env)
      ? await env.DB.prepare(
          `
      SELECT 
        COUNT(DISTINCT telegram_id) as total_users,
        COUNT(DISTINCT CASE WHEN has_access = true THEN telegram_id END) as active_users
      FROM users
    `
        ).first<{ total_users: number; active_users: number }>()
      : null

    // Get access request statistics
    const requestStats = hasDatabase(env)
      ? await env.DB.prepare(
          `
      SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_requests,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_requests
      FROM access_requests
    `
        ).first<{
          pending_requests: number
          approved_requests: number
          rejected_requests: number
        }>()
      : null

    // Get role statistics
    const roleStats = hasDatabase(env)
      ? await env.DB.prepare(
          `
      SELECT role, COUNT(*) as count
      FROM user_roles
      GROUP BY role
    `
        ).all<{ role: string; count: number }>()
      : null

    // Get AI provider statistics if available
    let aiStats = ctx.i18n.t('commands.info.ai_not_configured', { namespace: 'telegram' })
    if (ctx.services.ai) {
      const activeProvider = ctx.services.ai.getActiveProvider()
      const providers = ctx.services.ai.listProviders()
      aiStats = ctx.i18n.t('commands.info.ai_status', {
        namespace: 'telegram',
        params: {
          provider: activeProvider || 'None',
          count: providers.length
        }
      })
    }

    // Get session statistics
    const sessionCount = await getActiveSessionCount(env)

    // Build info message
    let message = ctx.i18n.t('commands.info.header', { namespace: 'telegram' }) + '\n\n'

    message += ctx.i18n.t('commands.info.system_status', { namespace: 'telegram' }) + '\n'
    message +=
      ctx.i18n.t('commands.info.uptime', {
        namespace: 'telegram',
        params: { hours: uptimeHours, minutes: uptimeMinutes }
      }) + '\n'
    message +=
      ctx.i18n.t('commands.info.environment', {
        namespace: 'telegram',
        params: { environment: env.ENVIRONMENT || 'production' }
      }) + '\n'
    // Get tier from resource constraints
    const cloudConnector = CloudPlatformFactory.createFromTypedEnv(env)
    const constraints = cloudConnector.getResourceConstraints()
    const tier = constraints.maxExecutionTimeMs >= 5000 ? 'paid' : 'free'
    message +=
      ctx.i18n.t('commands.info.tier', { namespace: 'telegram', params: { tier } }) + '\n\n'

    message += ctx.i18n.t('commands.info.user_statistics', { namespace: 'telegram' }) + '\n'
    message +=
      ctx.i18n.t('commands.info.total_users', {
        namespace: 'telegram',
        params: { count: userStats?.total_users || 0 }
      }) + '\n'
    message +=
      ctx.i18n.t('commands.info.active_users', {
        namespace: 'telegram',
        params: { count: userStats?.active_users || 0 }
      }) + '\n'
    message +=
      ctx.i18n.t('commands.info.active_sessions', {
        namespace: 'telegram',
        params: { count: sessionCount }
      }) + '\n\n'

    message += ctx.i18n.t('commands.info.access_requests', { namespace: 'telegram' }) + '\n'
    message +=
      ctx.i18n.t('commands.info.pending', {
        namespace: 'telegram',
        params: { count: requestStats?.pending_requests || 0 }
      }) + '\n'
    message +=
      ctx.i18n.t('commands.info.approved', {
        namespace: 'telegram',
        params: { count: requestStats?.approved_requests || 0 }
      }) + '\n'
    message +=
      ctx.i18n.t('commands.info.rejected', {
        namespace: 'telegram',
        params: { count: requestStats?.rejected_requests || 0 }
      }) + '\n\n'

    message += ctx.i18n.t('commands.info.role_distribution', { namespace: 'telegram' }) + '\n'
    if (roleStats?.results && roleStats.results.length > 0) {
      for (const stat of roleStats.results) {
        message += `${stat.role}: ${stat.count}\n`
      }
    } else {
      message += ctx.i18n.t('commands.info.no_roles', { namespace: 'telegram' }) + '\n'
    }
    message += '\n'

    message += ctx.i18n.t('commands.info.ai_provider', { namespace: 'telegram' }) + '\n'
    message += aiStats + '\n'

    // Show cost information if available
    if (ctx.services.ai?.getCostInfo) {
      const costInfo = ctx.services.ai.getCostInfo()
      if (costInfo) {
        message +=
          ctx.i18n.t('commands.info.total_cost', {
            namespace: 'telegram',
            params: { cost: costInfo.total.toFixed(4) }
          }) + '\n'
      }
    }

    await ctx.reply(message, { parse_mode: 'HTML' })

    logger.info('Bot info requested', { userId: ctx.from?.id })
  } catch (error) {
    logger.error('Failed to get bot info', { error })
    await ctx.reply(ctx.i18n.t('commands.info.error', { namespace: 'telegram' }))
  }
}

/**
 * Helper function to get active session count.
 * Sessions are considered active if they had activity in the last 30 minutes.
 */
async function getActiveSessionCount(env: Env): Promise<number> {
  try {
    if (!env.SESSIONS) {
      return 0
    }

    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000

    // List all sessions from KV
    const sessionList = await env.SESSIONS.list()
    let activeCount = 0

    // Check each session for recent activity
    for (const key of sessionList.keys) {
      try {
        const session = (await env.SESSIONS.get(key.name, 'json')) as {
          lastActivity?: number
        } | null
        if (session && session.lastActivity && session.lastActivity > thirtyMinutesAgo) {
          activeCount++
        }
      } catch {
        // Skip invalid sessions
      }
    }

    return activeCount
  } catch (error) {
    logger.error('Failed to count active sessions', { error })
    return 0
  }
}
