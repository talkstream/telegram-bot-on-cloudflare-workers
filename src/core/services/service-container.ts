/**
 * Service Container for Wireframe Platform
 *
 * Implements lazy initialization for all platform services
 * to optimize memory usage and cold start performance
 */

import type { Env } from '@/config/env';
import type { IDatabaseStore, IKeyValueStore } from '@/core/interfaces/storage';
import type { IAIConnector } from '@/core/interfaces/ai-connector';
import type { IMessagingConnector } from '@/core/interfaces/messaging-connector';
import { LazyServiceContainer, ConditionalServiceContainer } from '@/patterns/lazy-services';
import { getCloudPlatformConnector } from '@/core/cloud/cloud-platform-cache';
import { UniversalRoleService } from '@/core/services/role-service';
import { KVCache } from '@/lib/cache/kv-cache';
import { getBotToken, isDemoMode } from '@/lib/env-guards';
import { MockAIConnector } from '@/connectors/ai/mock-ai-connector';
import { MockTelegramConnector } from '@/connectors/messaging/telegram/mock-telegram-connector';
import { TelegramConnector } from '@/connectors/messaging/telegram/telegram-connector';

/**
 * Wireframe core services
 */
export interface WireframeServices {
  roleService: UniversalRoleService;
  aiConnector: IAIConnector;
  messagingConnector: IMessagingConnector;
  kvCache: KVCache;
}

/**
 * Extended services (plugin-specific)
 */
export interface ExtendedServices extends WireframeServices {
  // Add plugin-specific services here
  // analyticsService?: AnalyticsService;
  // paymentService?: PaymentService;
}

/**
 * Service configuration holder
 */
let serviceConfig: {
  env: Env | null;
  dbStore: IDatabaseStore | null;
  kvStore: IKeyValueStore | null;
} = {
  env: null,
  dbStore: null,
  kvStore: null,
};

/**
 * Global service containers
 */
const coreServices = new LazyServiceContainer<WireframeServices>();
const conditionalServices = new ConditionalServiceContainer<ExtendedServices>();

/**
 * Initialize the service container with environment
 */
export function initializeServiceContainer(env: Env): void {
  serviceConfig.env = env;

  // Register core services with lazy initialization
  registerCoreServices();

  // Register conditional services
  registerConditionalServices();
}

/**
 * Register core services
 */
function registerCoreServices(): void {
  // Role Service
  coreServices.register('roleService', () => {
    const db = getDatabaseStore();
    if (!db) {
      throw new Error('Database required for RoleService');
    }
    return new UniversalRoleService(db);
  });

  // AI Connector
  coreServices.register('aiConnector', () => {
    if (!serviceConfig.env) {
      throw new Error('Environment not configured');
    }

    if (isDemoMode()) {
      return new MockAIConnector();
    }

    // In real implementation, use AI connector factory
    // For now, return mock
    return new MockAIConnector();
  });

  // Messaging Connector (Telegram)
  coreServices.register('messagingConnector', () => {
    if (!serviceConfig.env) {
      throw new Error('Environment not configured');
    }

    if (isDemoMode()) {
      return new MockTelegramConnector();
    }

    const token = getBotToken();
    if (!token) {
      throw new Error('Bot token required for TelegramConnector');
    }

    return new TelegramConnector(token);
  });

  // KV Cache
  coreServices.register('kvCache', () => {
    const kv = getKeyValueStore();
    if (!kv) {
      throw new Error('KV store required for cache');
    }
    return new KVCache(kv);
  });
}

/**
 * Register conditional services
 */
function registerConditionalServices(): void {
  // Example: Analytics service only for production
  // conditionalServices.registerConditional(
  //   'analyticsService',
  //   () => new AnalyticsService(getDatabaseStore()!),
  //   () => serviceConfig.env?.ENVIRONMENT === 'production'
  // );
}

/**
 * Lazy database store getter
 */
export function getDatabaseStore(): IDatabaseStore | null {
  if (!serviceConfig.dbStore && serviceConfig.env) {
    try {
      const platform = getCloudPlatformConnector(serviceConfig.env);
      serviceConfig.dbStore = platform.getDatabaseStore('DB');
    } catch (error) {
      console.error('Failed to get database store:', error);
      return null;
    }
  }
  return serviceConfig.dbStore;
}

/**
 * Lazy KV store getter
 */
export function getKeyValueStore(): IKeyValueStore | null {
  if (!serviceConfig.kvStore && serviceConfig.env) {
    try {
      const platform = getCloudPlatformConnector(serviceConfig.env);
      serviceConfig.kvStore = platform.getKeyValueStore('CACHE');
    } catch (error) {
      console.error('Failed to get KV store:', error);
      return null;
    }
  }
  return serviceConfig.kvStore;
}

/**
 * Service getters
 */
export const getRoleService = () => coreServices.get('roleService');
export const getAIConnector = () => coreServices.get('aiConnector');
export const getMessagingConnector = () => coreServices.get('messagingConnector');
export const getKVCache = () => coreServices.get('kvCache');

/**
 * Conditional service getters
 */
// export const getAnalyticsService = async () => conditionalServices.getConditional('analyticsService');

/**
 * Get service initialization statistics
 */
export function getServiceStats() {
  return {
    core: coreServices.getStats(),
    conditional: conditionalServices.getStats(),
  };
}

/**
 * Reset all services (for testing)
 */
export function resetServices(): void {
  coreServices.reset();
  conditionalServices.reset();
  serviceConfig = {
    env: null,
    dbStore: null,
    kvStore: null,
  };
}

/**
 * Check if services are initialized
 */
export function areServicesInitialized(): boolean {
  return serviceConfig.env !== null;
}
