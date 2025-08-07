/**
 * Common event types shared across the platform
 */

export enum CommonEventType {
  // Request lifecycle
  REQUEST_STARTED = 'common:request:started',
  REQUEST_COMPLETED = 'common:request:completed',
  REQUEST_FAILED = 'common:request:failed',

  // Error events
  ERROR_OCCURRED = 'common:error:occurred',
  ERROR_HANDLED = 'common:error:handled',
  ERROR_RECOVERED = 'common:error:recovered',

  // Session events
  SESSION_CREATED = 'common:session:created',
  SESSION_UPDATED = 'common:session:updated',
  SESSION_EXPIRED = 'common:session:expired',
  SESSION_DELETED = 'common:session:deleted',

  // Cache events
  CACHE_HIT = 'common:cache:hit',
  CACHE_MISS = 'common:cache:miss',
  CACHE_SET = 'common:cache:set',
  CACHE_DELETE = 'common:cache:delete',
  CACHE_CLEAR = 'common:cache:clear',

  // Plugin events
  PLUGIN_LOADED = 'common:plugin:loaded',
  PLUGIN_UNLOADED = 'common:plugin:unloaded',
  PLUGIN_ERROR = 'common:plugin:error',
  PLUGIN_ENABLED = 'common:plugin:enabled',
  PLUGIN_DISABLED = 'common:plugin:disabled',

  // System events
  SYSTEM_STARTUP = 'common:system:startup',
  SYSTEM_SHUTDOWN = 'common:system:shutdown',
  SYSTEM_HEALTH_CHECK = 'common:system:health_check'
}
