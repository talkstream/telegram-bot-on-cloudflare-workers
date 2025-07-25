/**
 * Service Container for Wireframe Platform
 *
 * Implements lazy initialization for all platform services
 * to optimize memory usage and cold start performance
 */

import type { Env } from '@/config/env';
import type { IDatabaseStore, IKeyValueStore } from '@/core/interfaces/storage';
import type { AIConnector } from '@/core/interfaces/ai';
import type { MessagingConnector } from '@/core/interfaces/messaging';
import { ConnectorType } from '@/core/interfaces/connector';
import { LazyServiceContainer, ConditionalServiceContainer } from '@/patterns/lazy-services';
import { getCloudPlatformConnector } from '@/core/cloud/cloud-platform-cache';
import { UniversalRoleService } from '@/core/services/role-service';
import { EventBus } from '@/core/events/event-bus';
import { KVCache } from '@/lib/cache/kv-cache';
import { getBotToken, isDemoMode } from '@/lib/env-guards';
import { MockAIConnector } from '@/connectors/ai/mock-ai-connector';
import { MockTelegramConnector } from '@/connectors/messaging/telegram/mock-telegram-connector';
import { TelegramConnector } from '@/connectors/messaging/telegram/telegram-connector';

/**
 * Wireframe core services
 */
export interface WireframeServices extends Record<string, unknown> {
  roleService: UniversalRoleService;
  aiConnector: AIConnector;
  messagingConnector: MessagingConnector;
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
    if (!serviceConfig.env) {
      throw new Error('Environment not configured');
    }
    // UniversalRoleService requires D1Database directly, not IDatabaseStore wrapper
    const platform = getCloudPlatformConnector(serviceConfig.env);
    const db = (platform as unknown as { env?: { DB?: unknown } }).env?.DB;
    if (!db) {
      throw new Error('D1 Database required for RoleService');
    }
    const ownerIds = serviceConfig.env.BOT_OWNER_IDS?.split(',').filter(Boolean) || [];
    const eventBus = new EventBus();
    return new UniversalRoleService(db as D1Database, ownerIds, eventBus);
  });

  // AI Connector
  coreServices.register('aiConnector', () => {
    if (!serviceConfig.env) {
      throw new Error('Environment not configured');
    }

    const connector = new MockAIConnector(serviceConfig.env);

    if (isDemoMode(serviceConfig.env)) {
      console.info('[ServiceContainer] Using Mock AI Connector (demo mode)');
    }

    return connector;
  });

  // Messaging Connector (Telegram)
  coreServices.register('messagingConnector', () => {
    if (!serviceConfig.env) {
      throw new Error('Environment not configured');
    }

    if (isDemoMode(serviceConfig.env)) {
      console.info('[ServiceContainer] Using Mock Telegram Connector (demo mode)');
      return new MockTelegramConnector({
        type: ConnectorType.MESSAGING,
        id: 'mock-telegram',
        name: 'Mock Telegram',
      });
    }

    const token = getBotToken(serviceConfig.env);
    if (!token) {
      throw new Error('Bot token required for TelegramConnector');
    }

    return new TelegramConnector();
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
