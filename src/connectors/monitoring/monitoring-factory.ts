/**
 * Factory for creating monitoring connectors
 */

import type { IMonitoringConnector, MonitoringConfig } from '../../core/interfaces/monitoring'

import { SentryConnector } from './sentry/sentry-connector'

export class MonitoringFactory {
  private static connectors = new Map<string, new () => IMonitoringConnector>([
    ['sentry', SentryConnector]
  ])

  /**
   * Register a custom monitoring connector
   */
  static register(provider: string, connectorClass: new () => IMonitoringConnector): void {
    this.connectors.set(provider, connectorClass)
  }

  /**
   * Create monitoring connector instance
   */
  static async create(provider: string, config: MonitoringConfig): Promise<IMonitoringConnector> {
    const ConnectorClass = this.connectors.get(provider)

    if (!ConnectorClass) {
      throw new Error(`Monitoring provider '${provider}' is not registered`)
    }

    const connector = new ConnectorClass()
    await connector.initialize(config)

    return connector
  }

  /**
   * Create monitoring connector from environment
   */
  static async createFromEnv(
    env: Record<string, string | undefined>
  ): Promise<IMonitoringConnector | null> {
    // Detect monitoring provider from environment
    if (env.SENTRY_DSN) {
      const platform = this.detectPlatform(env)

      return this.create('sentry', {
        dsn: env.SENTRY_DSN,
        environment: env.ENVIRONMENT || 'development',
        release: env.RELEASE || env.GITHUB_SHA || 'unknown',
        platform,
        sampleRate: env.SENTRY_SAMPLE_RATE ? parseFloat(env.SENTRY_SAMPLE_RATE) : 1.0,
        beforeSend: event => {
          // Filter sensitive data
          if (event.request?.headers) {
            delete event.request.headers['authorization']
            delete event.request.headers['x-telegram-bot-api-secret-token']
          }

          // Don't send in development unless debug enabled
          if (env.ENVIRONMENT === 'development' && !env.SENTRY_DEBUG) {
            return null
          }

          return event
        }
      })
    }

    // Add other monitoring providers here
    // if (env.DATADOG_API_KEY) { ... }
    // if (env.NEWRELIC_LICENSE_KEY) { ... }

    return null
  }

  private static detectPlatform(
    env: Record<string, string | undefined>
  ): MonitoringConfig['platform'] {
    // Cloudflare Workers
    if (env.CF_WORKER_ENV || typeof caches !== 'undefined') {
      return 'cloudflare'
    }

    // AWS Lambda
    if (env.AWS_LAMBDA_FUNCTION_NAME || env.LAMBDA_RUNTIME_DIR) {
      return 'aws'
    }

    // Google Cloud Functions
    if (env.FUNCTION_NAME || env.GCP_PROJECT) {
      return 'gcp'
    }

    // Node.js
    if (typeof process !== 'undefined' && process.versions?.node) {
      return 'node'
    }

    // Default to browser/edge
    return undefined
  }
}
