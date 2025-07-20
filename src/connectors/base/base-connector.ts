import type {
  Connector,
  ConnectorConfig,
  ValidationResult,
  ConnectorCapabilities,
  HealthStatus,
} from '../../core/interfaces/connector.js';
import { ConnectorType } from '../../core/interfaces/connector.js';
import { EventBus, CommonEventType } from '../../core/events/event-bus.js';

/**
 * Base implementation of Connector interface
 */
export abstract class BaseConnector implements Connector {
  abstract id: string;
  abstract name: string;
  abstract version: string;
  abstract type: ConnectorType;

  protected config?: ConnectorConfig;
  protected initialized = false;
  protected eventBus?: EventBus;

  /**
   * Initialize the connector
   */
  async initialize(config: ConnectorConfig): Promise<void> {
    // Validate configuration
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      const errors = validation.errors?.map((e) => `${e.field}: ${e.message}`).join(', ');
      throw new Error(`Invalid configuration: ${errors}`);
    }

    this.config = config;

    // Initialize event bus if provided
    if (config.eventBus) {
      this.eventBus = config.eventBus as EventBus;
    }

    try {
      // Call abstract initialization method
      await this.doInitialize(config);
      this.initialized = true;

      // Emit initialization event
      this.emitEvent(CommonEventType.CONNECTOR_INITIALIZED, {
        connector: this.getMetadata(),
      });
    } catch (error) {
      this.initialized = false;
      this.emitEvent(CommonEventType.CONNECTOR_ERROR, {
        connector: this.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Check if connector is ready
   */
  isReady(): boolean {
    return this.initialized && this.checkReadiness();
  }

  /**
   * Validate configuration
   */
  validateConfig(config: ConnectorConfig): ValidationResult {
    const errors = this.doValidateConfig(config);
    return {
      valid: !errors || errors.length === 0,
      errors,
    };
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const health = await this.checkHealth();
      return {
        status: health.status || 'healthy',
        message: health.message,
        details: health.details,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Health check failed',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Destroy the connector
   */
  async destroy(): Promise<void> {
    try {
      await this.doDestroy();
      this.initialized = false;

      this.emitEvent(CommonEventType.CONNECTOR_DESTROYED, {
        connector: this.id,
      });
    } catch (error) {
      this.emitEvent(CommonEventType.CONNECTOR_ERROR, {
        connector: this.id,
        error: error instanceof Error ? error.message : 'Destroy failed',
      });
      throw error;
    }
  }

  /**
   * Get connector metadata
   */
  protected getMetadata(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      type: this.type,
      initialized: this.initialized,
    };
  }

  /**
   * Emit event via event bus
   */
  protected emitEvent(type: string, payload: unknown): void {
    if (this.eventBus) {
      this.eventBus.emit(type, payload, this.id);
    }
  }

  /**
   * Get configuration value
   */
  protected getConfig<T = unknown>(key: string, defaultValue?: T): T | undefined {
    if (!this.config) return defaultValue;
    return (this.config[key] as T) ?? defaultValue;
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  protected abstract doInitialize(config: ConnectorConfig): Promise<void>;
  protected abstract doValidateConfig(config: ConnectorConfig): ValidationResult['errors'];
  protected abstract checkReadiness(): boolean;
  protected abstract checkHealth(): Promise<Partial<HealthStatus>>;
  protected abstract doDestroy(): Promise<void>;
  abstract getCapabilities(): ConnectorCapabilities;
}
