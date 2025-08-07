import type { Context } from 'hono'

import { getBotToken } from '@/lib/env-guards'
import { logger } from '@/lib/logger'
import type { Env, HealthStatus } from '@/types'

export async function healthHandler(c: Context<{ Bindings: Env }>) {
  const startTime = Date.now()
  const env = c.env

  const status: HealthStatus = {
    status: 'healthy',
    version: '1.0.0',
    environment: env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
    services: {
      database: false,
      cache: false,
      telegram: false,
      ai: false
    }
  }

  // Define health check tasks
  const healthChecks = []

  // Database health check
  if (env.DB) {
    healthChecks.push({
      name: 'database',
      check: async () => {
        try {
          if (!env.DB) return false
          const result = await env.DB.prepare('SELECT 1 as health').first()
          return result?.health === 1
        } catch (error) {
          logger.error('D1 health check failed', { error })
          return false
        }
      }
    })
  }

  // KV Cache health check
  if (env.CACHE) {
    healthChecks.push({
      name: 'cache',
      check: async () => {
        try {
          if (!env.CACHE) return false
          const testKey = `health_check_${Date.now()}`
          await env.CACHE.put(testKey, 'ok', { expirationTtl: 60 })
          const value = await env.CACHE.get(testKey)
          const isHealthy = value === 'ok'
          await env.CACHE.delete(testKey)
          return isHealthy
        } catch (error) {
          logger.error('KV cache health check failed', { error })
          return false
        }
      }
    })
  }

  // Telegram Bot Token check (synchronous, but wrapped for consistency)
  if (env.TELEGRAM_BOT_TOKEN) {
    healthChecks.push({
      name: 'telegram',
      check: async () => {
        try {
          const token = getBotToken(env)
          return /^\d+:[A-Za-z0-9_-]{35}$/.test(token)
        } catch (error) {
          logger.error('Telegram token check failed', { error })
          return false
        }
      }
    })
  }

  // AI Service check (synchronous, but wrapped for consistency)
  if (env.GEMINI_API_KEY) {
    healthChecks.push({
      name: 'ai',
      check: async () => {
        try {
          return Boolean(
            (env.GEMINI_API_KEY && env.GEMINI_API_KEY.length > 20) ||
              (env.OPENAI_API_KEY && env.OPENAI_API_KEY.length > 20) ||
              (env.XAI_API_KEY && env.XAI_API_KEY.length > 20) ||
              (env.DEEPSEEK_API_KEY && env.DEEPSEEK_API_KEY.length > 20) ||
              (env.CLOUDFLARE_AI_ACCOUNT_ID && env.CLOUDFLARE_AI_ACCOUNT_ID.length > 0)
          )
        } catch (error) {
          logger.error('AI service check failed', { error })
          return false
        }
      }
    })
  }

  // Execute all health checks in parallel
  const results = await Promise.all(
    healthChecks.map(async ({ name, check }) => ({
      name,
      healthy: await check()
    }))
  )

  // Update status based on results
  results.forEach(({ name, healthy }) => {
    const serviceName = name as keyof typeof status.services
    if (serviceName in status.services) {
      status.services[serviceName] = healthy
      if (!healthy) {
        status.status = 'degraded'
      }
    }
  })

  // Determine overall status
  const criticalServices = [status.services.database, status.services.telegram]
  if (criticalServices.some(service => !service)) {
    status.status = 'unhealthy'
  }

  // Add performance metric
  const duration = Date.now() - startTime
  logger.info('Health check completed', {
    status: status.status,
    duration,
    services: status.services
  })

  // Return appropriate status code
  const statusCode = status.status === 'healthy' ? 200 : status.status === 'degraded' ? 200 : 503

  return c.json(status, statusCode)
}
