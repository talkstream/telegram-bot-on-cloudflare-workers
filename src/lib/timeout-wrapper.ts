import { logger } from '@/lib/logger'

export interface TimeoutOptions {
  timeoutMs: number
  errorMessage?: string
  operation?: string
}

/**
 * Custom timeout error for better error handling
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number,
    public readonly operation?: string
  ) {
    super(message)
    this.name = 'TimeoutError'
  }
}

/**
 * Wraps a promise with a timeout
 * @param promise The promise to wrap
 * @param options Timeout options
 * @returns Promise that rejects if timeout is exceeded
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  options: TimeoutOptions | number
): Promise<T> {
  const config: TimeoutOptions = typeof options === 'number' ? { timeoutMs: options } : options

  const { timeoutMs, errorMessage, operation } = config

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    setTimeout(() => {
      const message = errorMessage || `Operation timed out after ${timeoutMs}ms`
      reject(new TimeoutError(message, timeoutMs, operation))
    }, timeoutMs)
  })

  try {
    const result = await Promise.race([promise, timeoutPromise])
    return result
  } catch (error) {
    if (error instanceof TimeoutError) {
      logger.error('Operation timeout', {
        operation: error.operation,
        timeoutMs: error.timeoutMs,
        message: error.message
      })
    }
    throw error
  }
}

/**
 * Creates a timeout wrapper function with default timeout
 * @param defaultTimeoutMs Default timeout in milliseconds
 * @returns Timeout wrapper function
 */
export function createTimeoutWrapper(defaultTimeoutMs: number) {
  return <T>(promise: Promise<T>, options?: Partial<TimeoutOptions> | number): Promise<T> => {
    const config: TimeoutOptions =
      typeof options === 'number'
        ? { timeoutMs: options }
        : { timeoutMs: defaultTimeoutMs, ...options }

    return withTimeout(promise, config)
  }
}

/**
 * Timeout configurations for different tiers
 */
export const TIMEOUT_CONFIGS = {
  free: {
    api: 2000, // 2s for API calls
    database: 1000, // 1s for database
    cache: 500, // 500ms for cache
    default: 1500 // 1.5s default
  },
  paid: {
    api: 10000, // 10s for API calls
    database: 5000, // 5s for database
    cache: 2000, // 2s for cache
    default: 7500 // 7.5s default
  }
} as const

/**
 * Gets timeout configuration based on tier
 * @param tier The service tier
 * @returns Timeout configuration
 */
export function getTimeoutConfig(tier: 'free' | 'paid' = 'free') {
  return TIMEOUT_CONFIGS[tier]
}

/**
 * Retry with exponential backoff and timeout
 * @param fn Function to retry
 * @param options Retry options
 * @returns Result of the function
 */
export async function retryWithTimeout<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    retryDelayMs?: number
    backoffMultiplier?: number
    timeoutMs?: number
    operation?: string
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelayMs = 100,
    backoffMultiplier = 2,
    timeoutMs = 5000,
    operation = 'unknown'
  } = options

  let lastError: Error | unknown
  let delay = retryDelayMs

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await withTimeout(fn(), {
        timeoutMs,
        operation: `${operation} (attempt ${attempt}/${maxRetries})`
      })

      if (attempt > 1) {
        logger.info('Retry successful', {
          operation,
          attempt,
          totalAttempts: maxRetries
        })
      }

      return result
    } catch (error) {
      lastError = error

      if (attempt < maxRetries) {
        logger.warn('Operation failed, retrying', {
          operation,
          attempt,
          maxRetries,
          error: error instanceof Error ? error.message : 'Unknown error',
          nextDelayMs: delay
        })

        await new Promise(resolve => setTimeout(resolve, delay))
        delay *= backoffMultiplier
      }
    }
  }

  logger.error('All retry attempts failed', {
    operation,
    maxRetries,
    lastError: lastError instanceof Error ? lastError.message : 'Unknown error'
  })

  throw lastError
}

/**
 * Batch operations with timeout for each operation
 * @param operations Array of operations to execute
 * @param options Batch options
 * @returns Results of all operations
 */
export async function batchWithTimeout<T>(
  operations: Array<() => Promise<T>>,
  options: {
    timeoutMs?: number
    concurrency?: number
    continueOnError?: boolean
  } = {}
): Promise<Array<{ success: boolean; value?: T; error?: Error }>> {
  const { timeoutMs = 5000, concurrency = 10, continueOnError = true } = options

  const results: Array<{ success: boolean; value?: T; error?: Error }> = []
  const executing: Array<Promise<void>> = []

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i]

    const promise = withTimeout(
      operation?.() || Promise.reject(new Error('Invalid operation')),
      timeoutMs
    )
      .then(value => {
        results[i] = { success: true, value }
        return value
      })
      .catch(error => {
        results[i] = { success: false, error }
        if (!continueOnError) throw error
      })

    executing.push(promise as Promise<void>)

    if (executing.length >= concurrency) {
      await Promise.race(executing)
      const completedIndex = executing.findIndex(() => true)
      if (completedIndex !== -1) {
        executing.splice(completedIndex, 1)
      }
    }
  }

  await Promise.all(executing)
  return results
}
