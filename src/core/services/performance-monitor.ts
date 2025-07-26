/**
 * Performance monitoring service implementation
 */

import type {
  IPerformanceMonitor,
  ITimer,
  IMetric,
  IMonitoringProvider,
  PerformanceMonitoringConfig,
} from '../interfaces/performance';

/**
 * Timer implementation
 */
class Timer implements ITimer {
  private startTime: number;
  private endTime?: number;

  constructor(
    private name: string,
    private monitor: PerformanceMonitor,
    private tags?: Record<string, string>,
  ) {
    this.startTime = Date.now();
  }

  end(additionalTags?: Record<string, string>): number {
    if (this.endTime) {
      return this.endTime - this.startTime;
    }

    this.endTime = Date.now();
    const duration = this.endTime - this.startTime;

    this.monitor.timing(this.name, duration, {
      ...this.tags,
      ...additionalTags,
    });

    return duration;
  }

  elapsed(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Performance monitoring service
 */
export class PerformanceMonitor implements IPerformanceMonitor {
  private metrics: IMetric[] = [];
  private providers: IMonitoringProvider[];
  private flushInterval?: number;
  private maxBufferSize: number;
  private defaultTags: Record<string, string>;
  private debug: boolean;
  private flushTimer?: NodeJS.Timeout;

  constructor(config: PerformanceMonitoringConfig = {}) {
    this.providers = config.providers || [];
    this.flushInterval = config.flushInterval || 10000; // 10 seconds
    this.maxBufferSize = config.maxBufferSize || 1000;
    this.defaultTags = config.defaultTags || {};
    this.debug = config.debug || false;

    // Start auto-flush if interval is set
    if (this.flushInterval > 0) {
      this.startAutoFlush();
    }
  }

  startTimer(name: string, tags?: Record<string, string>): ITimer {
    return new Timer(name, this, { ...this.defaultTags, ...tags });
  }

  recordMetric(metric: IMetric): void {
    const enrichedMetric: IMetric = {
      ...metric,
      tags: { ...this.defaultTags, ...metric.tags },
      timestamp: metric.timestamp || Date.now(),
    };

    this.metrics.push(enrichedMetric);

    if (this.debug) {
      console.info('[PerformanceMonitor] Recorded metric:', enrichedMetric);
    }

    // Auto-flush if buffer is full
    if (this.metrics.length >= this.maxBufferSize) {
      this.flush().catch((err) => {
        console.error('[PerformanceMonitor] Auto-flush failed:', err);
      });
    }
  }

  increment(name: string, value = 1, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      type: 'counter',
      value,
      tags,
    });
  }

  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      type: 'gauge',
      value,
      tags,
    });
  }

  timing(name: string, duration: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      type: 'timing',
      value: duration,
      tags,
    });
  }

  histogram(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      type: 'histogram',
      value,
      tags,
    });
  }

  async flush(): Promise<void> {
    if (this.metrics.length === 0) {
      return;
    }

    const metricsToSend = [...this.metrics];
    this.metrics = [];

    if (this.debug) {
      console.info(`[PerformanceMonitor] Flushing ${metricsToSend.length} metrics`);
    }

    // Send to all available providers
    const promises = this.providers
      .filter((provider) => provider.isAvailable())
      .map((provider) =>
        provider.send(metricsToSend).catch((err) => {
          console.error(`[PerformanceMonitor] Failed to send metrics to ${provider.name}:`, err);
        }),
      );

    await Promise.all(promises);
  }

  /**
   * Stop the performance monitor and flush remaining metrics
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    await this.flush();
  }

  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error('[PerformanceMonitor] Scheduled flush failed:', err);
      });
    }, this.flushInterval);
  }
}

/**
 * Console monitoring provider for debugging
 */
export class ConsoleMonitoringProvider implements IMonitoringProvider {
  name = 'console';

  async send(metrics: IMetric[]): Promise<void> {
    console.info('[ConsoleMonitoringProvider] Metrics:', JSON.stringify(metrics, null, 2));
  }

  isAvailable(): boolean {
    return true;
  }
}

/**
 * Cloudflare Analytics Engine provider
 */
export class CloudflareAnalyticsProvider implements IMonitoringProvider {
  name = 'cloudflare-analytics';

  constructor(
    private accountId: string,
    private apiToken: string,
    private dataset: string,
  ) {}

  async send(metrics: IMetric[]): Promise<void> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/analytics_engine/sql`;

    const data = metrics.map((metric) => ({
      timestamp: metric.timestamp || Date.now(),
      metric_name: metric.name,
      metric_type: metric.type,
      metric_value: metric.value,
      ...metric.tags,
    }));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dataset: this.dataset,
        data,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send metrics to Cloudflare: ${response.statusText}`);
    }
  }

  isAvailable(): boolean {
    return !!(this.accountId && this.apiToken && this.dataset);
  }
}

/**
 * StatsD provider for metrics aggregation
 */
export class StatsDProvider implements IMonitoringProvider {
  name = 'statsd';

  constructor(
    private host: string,
    private port: number,
    private prefix?: string,
  ) {}

  async send(metrics: IMetric[]): Promise<void> {
    // In a real implementation, this would send UDP packets to StatsD
    // For now, we'll just log the metrics that would be sent
    const statsdMetrics = metrics.map((metric) => {
      const tags = metric.tags
        ? Object.entries(metric.tags)
            .map(([k, v]) => `${k}:${v}`)
            .join(',')
        : '';
      const metricName = this.prefix ? `${this.prefix}.${metric.name}` : metric.name;
      const suffix = tags ? `|#${tags}` : '';

      switch (metric.type) {
        case 'counter':
          return `${metricName}:${metric.value}|c${suffix}`;
        case 'gauge':
          return `${metricName}:${metric.value}|g${suffix}`;
        case 'timing':
          return `${metricName}:${metric.value}|ms${suffix}`;
        case 'histogram':
          return `${metricName}:${metric.value}|h${suffix}`;
        default:
          return `${metricName}:${metric.value}|g${suffix}`;
      }
    });

    if (process.env.NODE_ENV !== 'production') {
      console.info('[StatsDProvider] Would send metrics:', statsdMetrics);
    }

    // In production, implement actual UDP sending
  }

  isAvailable(): boolean {
    return !!(this.host && this.port);
  }
}
