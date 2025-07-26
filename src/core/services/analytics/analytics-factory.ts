/**
 * Factory for creating analytics service instances
 */

import type {
  IAnalyticsService,
  IAnalyticsProvider,
  IAnalyticsBatchOptions,
} from '../../interfaces/analytics';
import type { EventBus } from '../../events/event-bus';

import { CloudflareAnalyticsService } from './cloudflare-analytics-service';
import { MemoryAnalyticsService } from './memory-analytics-service';

/**
 * Analytics provider implementation
 */
class AnalyticsProvider implements IAnalyticsProvider {
  constructor(
    public name: string,
    private factory: (options?: Record<string, unknown>) => IAnalyticsService,
    private available: () => boolean,
  ) {}

  isAvailable(): boolean {
    return this.available();
  }

  getAnalyticsService(): IAnalyticsService {
    if (!this.isAvailable()) {
      throw new Error(`Analytics provider ${this.name} is not available`);
    }
    return this.factory();
  }
}

/**
 * Analytics service factory
 */
export class AnalyticsFactory {
  private static providers = new Map<string, IAnalyticsProvider>();
  private static defaultProvider?: string;
  private static defaultOptions?: {
    env?: Record<string, unknown>;
    datasetName?: string;
    batchOptions?: IAnalyticsBatchOptions;
    eventBus?: EventBus;
  };

  /**
   * Register built-in providers
   */
  static {
    // Cloudflare Analytics Engine
    this.registerProvider(
      new AnalyticsProvider(
        'cloudflare',
        (options?: { env: Record<string, unknown>; datasetName: string }) => {
          if (!options?.env || !options?.datasetName) {
            throw new Error('Cloudflare Analytics requires env and datasetName');
          }
          return new CloudflareAnalyticsService(
            options.env,
            options.datasetName,
            this.defaultOptions?.batchOptions,
            this.defaultOptions?.eventBus,
          );
        },
        () => typeof globalThis !== 'undefined' && this.defaultOptions?.env !== undefined,
      ),
    );

    // Memory analytics (always available)
    this.registerProvider(
      new AnalyticsProvider(
        'memory',
        () =>
          new MemoryAnalyticsService(
            this.defaultOptions?.batchOptions,
            this.defaultOptions?.eventBus,
          ),
        () => true,
      ),
    );
  }

  /**
   * Register an analytics provider
   */
  static registerProvider(provider: IAnalyticsProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Set default provider
   */
  static setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Analytics provider ${name} not found`);
    }
    this.defaultProvider = name;
  }

  /**
   * Configure default options
   */
  static configure(options: {
    provider?: string;
    env?: Record<string, unknown>;
    datasetName?: string;
    batchOptions?: IAnalyticsBatchOptions;
    eventBus?: EventBus;
  }): void {
    if (options.provider) {
      this.setDefaultProvider(options.provider);
    }
    this.defaultOptions = options;
  }

  /**
   * Get analytics service by provider name
   */
  static getAnalyticsService(
    providerName?: string,
    options?: {
      env?: Record<string, unknown>;
      datasetName?: string;
      batchOptions?: IAnalyticsBatchOptions;
      eventBus?: EventBus;
    },
  ): IAnalyticsService {
    const name = providerName || this.defaultProvider || this.getFirstAvailable();

    if (!name) {
      throw new Error('No analytics provider available');
    }

    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Analytics provider ${name} not found`);
    }

    // Merge options with defaults
    const mergedOptions = {
      ...this.defaultOptions,
      ...options,
    };

    if (name === 'cloudflare') {
      return new CloudflareAnalyticsService(
        mergedOptions.env!,
        mergedOptions.datasetName!,
        mergedOptions.batchOptions,
        mergedOptions.eventBus,
      );
    } else if (name === 'memory') {
      return new MemoryAnalyticsService(mergedOptions.batchOptions, mergedOptions.eventBus);
    }

    return provider.getAnalyticsService();
  }

  /**
   * Get first available provider
   */
  private static getFirstAvailable(): string | undefined {
    for (const [name, provider] of this.providers) {
      if (provider.isAvailable()) {
        return name;
      }
    }
    return undefined;
  }

  /**
   * List all registered providers
   */
  static listProviders(): Array<{ name: string; available: boolean }> {
    return Array.from(this.providers.entries()).map(([name, provider]) => ({
      name,
      available: provider.isAvailable(),
    }));
  }

  /**
   * Create analytics service with auto-detection
   */
  static createAutoDetect(options?: {
    env?: Record<string, unknown>;
    datasetName?: string;
    batchOptions?: IAnalyticsBatchOptions;
    eventBus?: EventBus;
  }): IAnalyticsService {
    // Priority order
    const priorities = ['cloudflare', 'memory'];

    for (const name of priorities) {
      const provider = this.providers.get(name);
      if (provider?.isAvailable()) {
        console.info(`Auto-detected analytics provider: ${name}`);

        if (name === 'cloudflare' && (!options?.env || !options?.datasetName)) {
          console.warn('Cloudflare Analytics requires env and datasetName, falling back to memory');
          continue;
        }

        return this.getAnalyticsService(name, options);
      }
    }

    // Fallback to memory
    console.warn('No production analytics provider available, using memory analytics');
    return this.getAnalyticsService('memory', options);
  }
}
