/**
 * Optimized exports for tree-shaking
 *
 * Use specific imports from this file instead of barrel exports
 */

// Event Bus - export only what's needed
export { EventBus } from './events/event-bus';
export type { EventBusEvent, EventPayload } from './interfaces/event-bus';

// Interfaces - export only essential types
export type { BotContext } from './interfaces/context';
export type { IMessagingConnector } from './interfaces/messaging';
export type { IAIConnector } from './interfaces/ai';
export type { ICloudPlatformConnector } from './interfaces/cloud-platform';

// Services - export factories for lazy loading
export const createRoleService = () =>
  import('./services/role-service').then((m) => m.UniversalRoleService);
export const createServiceContainer = () =>
  import('./services/service-container').then((m) => m.ServiceContainer);

// Pools - export singletons with lazy initialization
export const getTelegramPool = () =>
  import('./pools/telegram-pool').then((m) => m.TelegramConnectionPool.getInstance());
export const getAIPool = (id: string) =>
  import('./pools/ai-pool').then((m) => m.AIConnectionPool.getInstance(id));

// Cache - lazy load the heavy cache implementation
export const createTieredCache = () => import('./cache/tiered-cache').then((m) => m.TieredCache);
