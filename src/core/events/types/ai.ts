/**
 * AI-related event types
 */

export enum AIEventType {
  // Completion events
  COMPLETION_STARTED = 'ai:completion:started',
  COMPLETION_SUCCESS = 'ai:completion:success',
  COMPLETION_FAILED = 'ai:completion:failed',

  // Streaming events
  STREAM_STARTED = 'ai:stream:started',
  STREAM_CHUNK = 'ai:stream:chunk',
  STREAM_COMPLETED = 'ai:stream:completed',
  STREAM_FAILED = 'ai:stream:failed',

  // Provider events
  PROVIDER_REGISTERED = 'ai:provider:registered',
  PROVIDER_UNREGISTERED = 'ai:provider:unregistered',
  PROVIDER_SWITCHED = 'ai:provider:switched',
  PROVIDER_ERROR = 'ai:provider:error',

  // Model events
  MODEL_LOADED = 'ai:model:loaded',
  MODEL_UNLOADED = 'ai:model:unloaded',
  MODEL_SWITCHED = 'ai:model:switched',

  // Token/Cost events
  TOKENS_CONSUMED = 'ai:tokens:consumed',
  COST_INCURRED = 'ai:cost:incurred',
  QUOTA_EXCEEDED = 'ai:quota:exceeded',

  // Cache events
  CACHE_HIT = 'ai:cache:hit',
  CACHE_MISS = 'ai:cache:miss',
  CACHE_INVALIDATED = 'ai:cache:invalidated'
}
