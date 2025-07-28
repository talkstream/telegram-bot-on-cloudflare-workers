import type { Event } from '@/core/events/event-bus';
import type { IMonitoringConnector } from '@/core/interfaces/monitoring';
import { getMonitoringConnector } from '@/config/sentry';

interface IEventBusPlugin {
  name: string;
  version: string;
  onInit?(): void | Promise<void>;
  onDestroy?(): void | Promise<void>;
  beforeEmit?(event: Event): void | Promise<void>;
  afterEmit?(event: Event): void | Promise<void>;
  onError?(error: Error, event?: Event): void | Promise<void>;
}

/**
 * EventBus plugin that automatically tracks events with monitoring
 */
export class MonitoringPlugin implements IEventBusPlugin {
  name = 'MonitoringPlugin';
  version = '1.0.0';

  private monitoring: IMonitoringConnector | null = null;
  private eventCounts = new Map<string, number>();
  private errorEvents = new Set<string>([
    'error',
    'telegram.error',
    'ai.error',
    'payment.error',
    'db.error',
    'validation.error',
  ]);

  private performanceEvents = new Set<string>([
    'ai.complete',
    'ai.complete.success',
    'db.query',
    'telegram.command',
    'telegram.sendMessage',
    'payment.process',
  ]);

  async initialize(): Promise<void> {
    this.monitoring = getMonitoringConnector();
  }

  async onEvent(event: Event): Promise<void> {
    if (!this.monitoring) return;

    // Track event count
    const count = (this.eventCounts.get(event.type) || 0) + 1;
    this.eventCounts.set(event.type, count);

    // Check if this is an error event
    const isError = this.errorEvents.has(event.type) || event.type.includes('.error');
    if (isError) {
      this.handleErrorEvent(event);
      return;
    }

    // Check if this is a performance-critical event
    const isPerformance =
      this.performanceEvents.has(event.type) ||
      event.type.includes('.complete') ||
      event.type.includes('.query');
    if (isPerformance) {
      this.handlePerformanceEvent(event);
      return;
    }

    // Add breadcrumb for other important events
    if (this.shouldTrackEvent(event)) {
      this.monitoring.addBreadcrumb({
        message: event.type,
        category: 'event',
        level: 'info',
        data: this.sanitizeEventData(event.payload),
        timestamp: event.timestamp,
      });
    }
  }

  private handleErrorEvent(event: Event): void {
    if (!this.monitoring) return;

    const errorData = event.payload as Record<string, unknown>;
    const error = errorData.error || errorData.exception || errorData;

    if (error instanceof Error) {
      this.monitoring.captureException(error, {
        eventType: event.type,
        eventData: this.sanitizeEventData(event.payload),
        timestamp: event.timestamp,
      });
    } else {
      this.monitoring.captureMessage(`Event Error: ${event.type}`, 'error', {
        error: String(error),
        eventData: this.sanitizeEventData(event.payload),
        timestamp: event.timestamp,
      });
    }
  }

  private handlePerformanceEvent(event: Event): void {
    if (!this.monitoring) return;

    const data = event.payload as Record<string, unknown>;
    const duration = data.duration || data.elapsed || data.time;

    // Add performance breadcrumb
    this.monitoring.addBreadcrumb({
      message: `Performance: ${event.type}`,
      category: 'performance',
      level: 'info',
      data: {
        duration,
        ...this.sanitizeEventData(event.payload),
      },
      timestamp: event.timestamp,
    });

    // Alert on slow operations
    if (duration && typeof duration === 'number' && this.isSlowOperation(event.type, duration)) {
      this.monitoring.captureMessage(`Slow operation detected: ${event.type}`, 'warning', {
        duration,
        threshold: this.getThreshold(event.type),
        eventData: this.sanitizeEventData(event.payload),
      });
    }
  }

  private shouldTrackEvent(event: Event): boolean {
    // Track command events
    if (event.type.includes('command.')) return true;

    // Track state changes
    if (
      event.type.includes('.started') ||
      event.type.includes('.completed') ||
      event.type.includes('.failed')
    )
      return true;

    // Track user actions
    if (event.type.includes('user.') || event.type.includes('auth.')) return true;

    // Track payment events
    if (event.type.includes('payment.')) return true;

    return false;
  }

  private isSlowOperation(eventType: string, duration: number): boolean {
    const threshold = this.getThreshold(eventType);
    return duration > threshold;
  }

  private getThreshold(eventType: string): number {
    // Define thresholds for different operation types (in ms)
    if (eventType.includes('ai.')) return 5000; // 5 seconds for AI
    if (eventType.includes('db.')) return 1000; // 1 second for DB
    if (eventType.includes('telegram.')) return 2000; // 2 seconds for Telegram
    if (eventType.includes('payment.')) return 3000; // 3 seconds for payments
    return 3000; // Default 3 seconds
  }

  private sanitizeEventData(data: unknown): Record<string, unknown> {
    if (!data || typeof data !== 'object') return {};

    const sanitized: Record<string, unknown> = {};
    const sensitive = new Set(['password', 'token', 'secret', 'key', 'auth', 'credential']);

    for (const [key, value] of Object.entries(data)) {
      // Skip sensitive fields
      if (sensitive.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Handle Error objects specially
      if (value instanceof Error) {
        sanitized[key] = value; // Keep Error objects as-is for proper tracking
        continue;
      }

      // Limit string length
      if (typeof value === 'string' && value.length > 200) {
        sanitized[key] = value.substring(0, 200) + '...';
        continue;
      }

      // Handle nested objects (one level deep)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeEventData(value);
        continue;
      }

      // Handle arrays
      if (Array.isArray(value)) {
        sanitized[key] = value.slice(0, 10); // Limit to first 10 items
        continue;
      }

      sanitized[key] = value;
    }

    return sanitized;
  }

  async destroy(): Promise<void> {
    // Report final event statistics
    if (this.monitoring && this.eventCounts.size > 0) {
      const stats = Object.fromEntries(this.eventCounts);
      this.monitoring.captureMessage('EventBus session statistics', 'info', {
        eventCounts: stats,
        totalEvents: Array.from(this.eventCounts.values()).reduce((a, b) => a + b, 0),
      });
    }

    this.eventCounts.clear();
  }
}
