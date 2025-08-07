import { getBotToken, hasDatabase } from '@/lib/env-guards'
import { logger } from '@/lib/logger'
import type { Env } from '@/types'

export interface ScheduledTask {
  name: string
  cronPattern?: string
  handler: (env: Env) => Promise<void>
}

export class ScheduledTaskManager {
  private tasks: Map<string, ScheduledTask> = new Map()

  /**
   * Register a scheduled task
   */
  register(task: ScheduledTask): void {
    this.tasks.set(task.name, task)
    logger.info('Scheduled task registered', {
      name: task.name,
      cronPattern: task.cronPattern
    })
  }

  /**
   * Execute a specific task
   */
  async execute(taskName: string, env: Env): Promise<void> {
    const task = this.tasks.get(taskName)

    if (!task) {
      logger.error('Scheduled task not found', { taskName })
      throw new Error(`Task ${taskName} not found`)
    }

    const startTime = Date.now()

    try {
      logger.info('Executing scheduled task', { taskName })
      await task.handler(env)

      const duration = Date.now() - startTime
      logger.info('Scheduled task completed', { taskName, duration })
    } catch (error) {
      const duration = Date.now() - startTime
      logger.error('Scheduled task failed', {
        taskName,
        error,
        duration
      })
      throw error
    }
  }

  /**
   * Execute all registered tasks
   */
  async executeAll(env: Env): Promise<void> {
    const tasks = Array.from(this.tasks.values())

    logger.info('Executing all scheduled tasks', { count: tasks.length })

    const results = await Promise.allSettled(tasks.map(task => this.execute(task.name, env)))

    const failed = results.filter(r => r.status === 'rejected').length
    const succeeded = results.filter(r => r.status === 'fulfilled').length

    logger.info('All scheduled tasks completed', {
      total: tasks.length,
      succeeded,
      failed
    })
  }

  /**
   * Get all registered tasks
   */
  getTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values())
  }
}

// Example scheduled tasks
export const cleanupExpiredSessions: ScheduledTask = {
  name: 'cleanup_expired_sessions',
  cronPattern: '0 0 * * *', // Daily at midnight
  handler: async env => {
    const sessionCache = env.SESSIONS
    if (!sessionCache) return

    try {
      const list = await sessionCache.list({ prefix: 'session:' })
      let deleted = 0

      for (const key of list.keys) {
        const data = (await sessionCache.get(key.name, 'json')) as {
          expiresAt?: string
        } | null

        if (data?.expiresAt && new Date(data.expiresAt) < new Date()) {
          await sessionCache.delete(key.name)
          deleted++
        }
      }

      logger.info('Expired sessions cleaned up', { deleted })
    } catch (error) {
      logger.error('Failed to cleanup sessions', { error })
    }
  }
}

export const sendDailyStats: ScheduledTask = {
  name: 'send_daily_stats',
  cronPattern: '0 9 * * *', // Daily at 9 AM
  handler: async env => {
    try {
      // Collect stats from database
      const stats = await collectDailyStats(env)

      // Send to admin channel or store for later
      logger.info('Daily stats collected', { stats })
    } catch (error) {
      logger.error('Failed to send daily stats', { error })
    }
  }
}

export const healthCheck: ScheduledTask = {
  name: 'health_check',
  cronPattern: '*/5 * * * *', // Every 5 minutes
  handler: async env => {
    try {
      // Check bot webhook status
      const botToken = getBotToken(env)
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)

      const webhookInfo = (await response.json()) as {
        ok: boolean
        result?: { url?: string; pending_update_count?: number }
      }

      if (
        !webhookInfo.ok ||
        (webhookInfo.result?.pending_update_count && webhookInfo.result.pending_update_count > 100)
      ) {
        logger.error('Webhook health check failed', { webhookInfo })
      } else if (webhookInfo.result) {
        logger.info('Webhook health check passed', {
          url: webhookInfo.result.url,
          pending: webhookInfo.result.pending_update_count
        })
      }
    } catch (error) {
      logger.error('Health check failed', { error })
    }
  }
}

// Helper function to collect daily stats
async function collectDailyStats(env: Env): Promise<Record<string, number>> {
  const stats: Record<string, number> = {
    totalUsers: 0,
    activeUsers: 0,
    newUsers: 0,
    messagesProcessed: 0
  }

  try {
    // Example queries - adjust based on your schema
    if (!hasDatabase(env)) {
      return stats
    }

    const totalUsers = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{
      count: number
    }>()

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const activeUsers = await env.DB.prepare(
      'SELECT COUNT(DISTINCT user_id) as count FROM sessions WHERE updated_at > ?'
    )
      .bind(yesterday.toISOString())
      .first<{ count: number }>()

    const newUsers = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM users WHERE created_at > ?'
    )
      .bind(yesterday.toISOString())
      .first<{ count: number }>()

    stats.totalUsers = totalUsers?.count || 0
    stats.activeUsers = activeUsers?.count || 0
    stats.newUsers = newUsers?.count || 0
  } catch (error) {
    logger.error('Failed to collect stats', { error })
  }

  return stats
}

// Factory function
export function createScheduledTaskManager(): ScheduledTaskManager {
  const manager = new ScheduledTaskManager()

  // Register default tasks
  manager.register(cleanupExpiredSessions)
  manager.register(sendDailyStats)
  manager.register(healthCheck)

  return manager
}
