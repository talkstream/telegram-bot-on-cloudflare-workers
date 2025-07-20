/**
 * Sentry monitoring connector
 * Provides platform-agnostic Sentry integration
 */

import { BaseMonitoringConnector } from '../base-monitoring-connector';
import type {
  MonitoringConfig,
  MonitoringEvent,
  Breadcrumb,
} from '../../../core/interfaces/monitoring';

// Dynamic imports based on platform
interface SentryClient {
  captureException(error: Error, context?: unknown): void;
  captureMessage(message: string, level?: string): void;
  setUser(user: unknown): void;
  addBreadcrumb(breadcrumb: unknown): void;
  flush(timeout?: number): Promise<boolean>;
}

interface SentrySDK {
  init(options: unknown): void;
  getCurrentHub?(): { getClient(): SentryClient | undefined };
  getCurrentScope?(): { getClient(): SentryClient | undefined };
}

export class SentryConnector extends BaseMonitoringConnector {
  private client?: SentryClient;
  private sdk?: SentrySDK;

  protected async doInitialize(config: MonitoringConfig): Promise<void> {
    if (!config.dsn) {
      return;
    }

    try {
      // Dynamic import based on platform
      let sentryModule;

      switch (config.platform) {
        case 'cloudflare':
          sentryModule = await import('@sentry/cloudflare');
          break;
        case 'aws':
          // AWS SDK is optional - fallback to cloudflare for now
          try {
            sentryModule = await import('@sentry/aws-serverless' as string);
          } catch {
            console.warn('AWS Sentry SDK not available, using Cloudflare SDK');
            sentryModule = await import('@sentry/cloudflare');
          }
          break;
        case 'node':
          // Node SDK is optional - fallback to cloudflare for now
          try {
            sentryModule = await import('@sentry/node' as string);
          } catch {
            console.warn('Node Sentry SDK not available, using Cloudflare SDK');
            sentryModule = await import('@sentry/cloudflare');
          }
          break;
        default:
          // Browser SDK is optional - fallback to cloudflare for now
          try {
            sentryModule = await import('@sentry/browser' as string);
          } catch {
            console.warn('Browser Sentry SDK not available, using Cloudflare SDK');
            sentryModule = await import('@sentry/cloudflare');
          }
      }

      this.sdk = sentryModule as unknown as SentrySDK;

      // Initialize Sentry with platform-agnostic config
      const sentryConfig = {
        dsn: config.dsn,
        environment: config.environment,
        release: config.release,
        sampleRate: config.sampleRate || 1.0,
        tracesSampleRate: config.environment === 'production' ? 0.1 : 1.0,
        beforeSend: config.beforeSend ? this.wrapBeforeSend(config.beforeSend) : undefined,
        integrations: config.integrations,
      };

      this.sdk.init(sentryConfig);

      // Get client instance
      if (this.sdk.getCurrentHub) {
        this.client = this.sdk.getCurrentHub().getClient();
      } else if (this.sdk.getCurrentScope) {
        this.client = this.sdk.getCurrentScope().getClient();
      }
    } catch (error) {
      console.error('Failed to initialize Sentry:', error);
    }
  }

  captureException(error: Error, context?: Record<string, unknown>): void {
    if (!this.client || !this.isAvailable()) {
      return;
    }

    const event = this.createEvent({
      exception: {
        type: error.name,
        value: error.message,
        stacktrace: error.stack,
      },
      extra: context,
    });

    this.client.captureException(error, {
      contexts: {
        additional: context || {},
      },
      tags: event.tags,
    });
  }

  captureMessage(message: string, level: 'debug' | 'info' | 'warning' | 'error' = 'info'): void {
    if (!this.client || !this.isAvailable()) {
      return;
    }

    this.client.captureMessage(message, level);
  }

  protected doSetUserContext(userId: string, data?: Record<string, unknown>): void {
    if (!this.client) {
      return;
    }

    this.client.setUser({
      id: userId,
      ...data,
    });
  }

  protected doClearUserContext(): void {
    if (!this.client) {
      return;
    }

    this.client.setUser(null);
  }

  protected doAddBreadcrumb(breadcrumb: Breadcrumb): void {
    if (!this.client) {
      return;
    }

    this.client.addBreadcrumb({
      message: breadcrumb.message,
      category: breadcrumb.category,
      level: breadcrumb.level,
      type: breadcrumb.type,
      data: breadcrumb.data,
      timestamp: breadcrumb.timestamp ? breadcrumb.timestamp / 1000 : undefined,
    });
  }

  async flush(timeout = 2000): Promise<boolean> {
    if (!this.client) {
      return true;
    }

    try {
      return await this.client.flush(timeout);
    } catch {
      return false;
    }
  }

  private wrapBeforeSend(beforeSend: (event: MonitoringEvent) => MonitoringEvent | null) {
    return (sentryEvent: unknown, _hint?: unknown) => {
      // Convert Sentry event to our MonitoringEvent format
      const event = sentryEvent as MonitoringEvent;

      // Call user's beforeSend
      const modifiedEvent = beforeSend(event);

      // Return null or modified Sentry event
      return modifiedEvent as unknown;
    };
  }
}
