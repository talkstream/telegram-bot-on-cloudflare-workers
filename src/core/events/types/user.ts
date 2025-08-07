/**
 * User-related event types
 */

export enum UserEventType {
  // Authentication events
  USER_REGISTERED = 'user:registered',
  USER_LOGGED_IN = 'user:logged_in',
  USER_LOGGED_OUT = 'user:logged_out',
  USER_AUTH_FAILED = 'user:auth_failed',

  // Profile events
  USER_UPDATED = 'user:updated',
  USER_DELETED = 'user:deleted',
  USER_SUSPENDED = 'user:suspended',
  USER_ACTIVATED = 'user:activated',

  // Permission events
  USER_ROLE_CHANGED = 'user:role_changed',
  USER_PERMISSION_GRANTED = 'user:permission_granted',
  USER_PERMISSION_REVOKED = 'user:permission_revoked',

  // Activity events
  USER_ACTION = 'user:action',
  USER_COMMAND = 'user:command',
  USER_MESSAGE = 'user:message',
  USER_INTERACTION = 'user:interaction',

  // Preference events
  USER_PREFERENCE_SET = 'user:preference_set',
  USER_LANGUAGE_CHANGED = 'user:language_changed',
  USER_SETTINGS_UPDATED = 'user:settings_updated'
}
