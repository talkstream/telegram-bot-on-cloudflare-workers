import type { CommandHandler } from '@/types';
import type { Env } from '@/types';
import { logger } from '@/lib/logger';

/**
 * Technical information command for bot owners.
 * Shows system status, resource usage, and statistics.
 */
export const infoCommand: CommandHandler = async (ctx) => {
  const { env } = ctx;

  try {
    // Calculate uptime
    const startTime = (ctx.session?.data?.botStartTime as number | undefined) ?? Date.now();
    const uptime = Date.now() - startTime;
    const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
    const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));

    // Get user statistics
    const userStats = await env.DB.prepare(
      `
      SELECT 
        COUNT(DISTINCT telegram_id) as total_users,
        COUNT(DISTINCT CASE WHEN has_access = true THEN telegram_id END) as active_users
      FROM users
    `,
    ).first<{ total_users: number; active_users: number }>();

    // Get access request statistics
    const requestStats = await env.DB.prepare(
      `
      SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_requests,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_requests
      FROM access_requests
    `,
    ).first<{ pending_requests: number; approved_requests: number; rejected_requests: number }>();

    // Get role statistics
    const roleStats = await env.DB.prepare(
      `
      SELECT role, COUNT(*) as count
      FROM user_roles
      GROUP BY role
    `,
    ).all<{ role: string; count: number }>();

    // Get AI provider statistics if available
    let aiStats = ctx.i18n('info_ai_not_configured');
    if (ctx.services.ai) {
      const activeProvider = ctx.services.ai.getActiveProvider();
      const providers = ctx.services.ai.listProviders();
      aiStats = ctx.i18n('info_ai_status', {
        provider: activeProvider || 'None',
        count: providers.length,
      });
    }

    // Get session statistics
    const sessionCount = await getActiveSessionCount(env);

    // Build info message
    let message = ctx.i18n('info_command_header') + '\n\n';

    message += ctx.i18n('info_system_status') + '\n';
    message += ctx.i18n('info_uptime', { hours: uptimeHours, minutes: uptimeMinutes }) + '\n';
    message +=
      ctx.i18n('info_environment', { environment: env.ENVIRONMENT || 'production' }) + '\n';
    message += ctx.i18n('info_tier', { tier: env.TIER || 'free' }) + '\n\n';

    message += ctx.i18n('info_user_statistics') + '\n';
    message += ctx.i18n('info_total_users', { count: userStats?.total_users || 0 }) + '\n';
    message += ctx.i18n('info_active_users', { count: userStats?.active_users || 0 }) + '\n';
    message += ctx.i18n('info_active_sessions', { count: sessionCount }) + '\n\n';

    message += ctx.i18n('info_access_requests') + '\n';
    message += ctx.i18n('info_pending', { count: requestStats?.pending_requests || 0 }) + '\n';
    message += ctx.i18n('info_approved', { count: requestStats?.approved_requests || 0 }) + '\n';
    message += ctx.i18n('info_rejected', { count: requestStats?.rejected_requests || 0 }) + '\n\n';

    message += ctx.i18n('info_role_distribution') + '\n';
    if (roleStats?.results && roleStats.results.length > 0) {
      for (const stat of roleStats.results) {
        message += `${stat.role}: ${stat.count}\n`;
      }
    } else {
      message += ctx.i18n('info_no_roles') + '\n';
    }
    message += '\n';

    message += ctx.i18n('info_ai_provider') + '\n';
    message += aiStats + '\n';

    // Show cost information if available
    if (ctx.services.ai?.getCostInfo) {
      const costInfo = ctx.services.ai.getCostInfo();
      if (costInfo) {
        message += ctx.i18n('info_total_cost', { cost: costInfo.total.toFixed(4) }) + '\n';
      }
    }

    await ctx.reply(message, { parse_mode: 'HTML' });

    logger.info('Bot info requested', { userId: ctx.from?.id });
  } catch (error) {
    logger.error('Failed to get bot info', { error });
    await ctx.reply(ctx.i18n('info_error'));
  }
};

/**
 * Helper function to get active session count.
 * Sessions are considered active if they had activity in the last 30 minutes.
 */
async function getActiveSessionCount(env: Env): Promise<number> {
  try {
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

    // List all sessions from KV
    const sessionList = await env.SESSIONS.list();
    let activeCount = 0;

    // Check each session for recent activity
    for (const key of sessionList.keys) {
      try {
        const session = (await env.SESSIONS.get(key.name, 'json')) as {
          lastActivity?: number;
        } | null;
        if (session && session.lastActivity && session.lastActivity > thirtyMinutesAgo) {
          activeCount++;
        }
      } catch {
        // Skip invalid sessions
      }
    }

    return activeCount;
  } catch (error) {
    logger.error('Failed to count active sessions', { error });
    return 0;
  }
}
