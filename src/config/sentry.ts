import type { Hono } from 'hono'

import { MonitoringFactory } from '../connectors/monitoring/monitoring-factory'
import type { IMonitoringConnector } from '../core/interfaces/monitoring'

import type { Env } from './env'

let monitoringConnector: IMonitoringConnector | null = null

export async function initSentry(env: Env): Promise<IMonitoringConnector | null> {
  if (!monitoringConnector && env.SENTRY_DSN) {
    monitoringConnector = await MonitoringFactory.createFromEnv(
      env as unknown as Record<string, string | undefined>
    )
  }
  return monitoringConnector
}

export function setUserContext(userId: number, data?: Record<string, unknown>): void {
  monitoringConnector?.setUserContext(String(userId), data)
}

export function clearUserContext(): void {
  monitoringConnector?.clearUserContext()
}

export function getMonitoringConnector(): IMonitoringConnector | null {
  return monitoringConnector
}

export function captureException(error: Error, context?: Record<string, unknown>): void {
  monitoringConnector?.captureException(error, context)
}

export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info'
): void {
  monitoringConnector?.captureMessage(message, level)
}

export function wrapSentry(
  app: Hono<{ Bindings: Env }>,
  additionalHandlers?: Record<string, unknown>
) {
  return {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
      const monitoring = await initSentry(env)

      try {
        return await app.fetch(request, env, ctx)
      } catch (err) {
        // Capture exception with monitoring
        if (monitoring && err instanceof Error) {
          monitoring.captureException(err, {
            request: {
              url: request.url,
              method: request.method,
              headers: Object.fromEntries(request.headers.entries())
            },
            environment: env.ENVIRONMENT || 'development',
            runtime: 'cloudflare-workers'
          })

          // Ensure the event is sent before the worker terminates
          ctx.waitUntil(monitoring.flush(2000))
        }

        console.error('Error captured by monitoring:', err)
        throw err
      }
    },
    ...additionalHandlers
  }
}
