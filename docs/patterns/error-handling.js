/**
 * Error Handling Pattern
 *
 * This pattern demonstrates comprehensive error handling strategies used throughout
 * the Telegram Bot Cloudflare Workers Wireframe. It shows how to properly handle
 * errors with user-friendly messages, logging, monitoring, and recovery strategies.
 *
 * Files in wireframe using this pattern:
 * - /src/middleware/error-handler.ts - Global error handling middleware
 * - /src/lib/errors.ts - Custom error classes
 * - /src/config/sentry.ts - Sentry configuration
 * - /src/core/telegram-adapter.ts - Bot error handling
 *
 * Key concepts demonstrated:
 * 1. Custom error classes for different error types
 * 2. Integration with Sentry for production monitoring
 * 3. User-friendly error messages with i18n support
 * 4. Graceful error recovery and retry logic
 * 5. Debug mode for development
 */

// Note: In a real implementation, these would be imported from the wireframe:
// import { Toucan } from 'toucan-js';
// import { TelegramApiError, ValidationError, RateLimitError } from '../../src/lib/errors';
// import { logger } from '../../src/lib/logger';

// For this example, we'll define mock versions to avoid import errors
const Toucan = class {
  constructor(config) {
    this.config = config
  }
  captureException(error, context) {
    console.error('Sentry:', error, context)
  }
}

// Initialize Sentry for Cloudflare Workers
// This matches the pattern used in /src/config/sentry.ts
export function initSentry(env) {
  return new Toucan({
    dsn: env.SENTRY_DSN,
    context: env.SENTRY_CONTEXT || {},
    environment: env.ENVIRONMENT || 'development',
    release: env.BOT_VERSION || 'unknown'
  })
}

// Custom Error Classes
export class TelegramBotError extends Error {
  constructor(message, code, context) {
    super(message)
    this.name = 'TelegramBotError'
    this.code = code
    this.context = context
  }
}

export class RateLimitError extends TelegramBotError {
  constructor(retryAfter, context) {
    super('Rate limit exceeded', 429, context)
    this.retryAfter = retryAfter
  }
}

export class ValidationError extends TelegramBotError {
  constructor(message, field) {
    super(message, 400, { field })
  }
}

// Global Error Handler for Bot
export function setupErrorHandler(bot, env) {
  bot.catch(err => {
    const ctx = err.ctx
    const error = err.error

    // Log to console in development
    if (env.ENVIRONMENT === 'development') {
      console.error('Bot error:', error)
    }

    // Send to Sentry in production
    if (env.SENTRY_DSN) {
      const sentry = initSentry(env)
      sentry.captureException(error, {
        tags: {
          bot_version: env.BOT_VERSION || 'unknown',
          update_type: ctx.updateType,
          user_id: ctx.from?.id
        },
        extra: {
          update: ctx.update,
          session: ctx.session
        }
      })
    }

    // Handle specific error types
    return handleSpecificError(ctx, error)
  })
}

// Specific Error Handlers
async function handleSpecificError(ctx, error) {
  // Telegram API errors
  if (error.error_code) {
    switch (error.error_code) {
      case 400:
        return handleBadRequest(ctx, error)
      case 403:
        return handleForbidden(ctx, error)
      case 429:
        return handleRateLimit(ctx, error)
      default:
        return handleGenericError(ctx, error)
    }
  }

  // Custom errors
  if (error instanceof ValidationError) {
    return ctx.reply(`❌ Invalid input: ${error.message}`)
  }

  if (error instanceof RateLimitError) {
    return ctx.reply(`⏳ Too many requests. Please try again in ${error.retryAfter} seconds.`)
  }

  // Unknown errors
  return handleGenericError(ctx, error)
}

async function handleBadRequest(ctx, error) {
  console.error('Bad request:', error.description)

  // Common bad request scenarios
  if (error.description.includes('message is not modified')) {
    // Silently ignore - user clicked button multiple times
    return ctx.answerCallbackQuery('Already updated')
  }

  if (error.description.includes('MESSAGE_TOO_LONG')) {
    return ctx.reply('❌ Message is too long. Please try with a shorter message.')
  }

  return ctx.reply('❌ Invalid request. Please try again.')
}

async function handleForbidden(ctx, error) {
  if (error.description.includes('bot was blocked by the user')) {
    // Mark user as blocked in database
    if (ctx.env.DB) {
      await markUserBlocked(ctx.env.DB, ctx.from.id)
    }
    // Can't send message, just log
    console.log(`User ${ctx.from.id} has blocked the bot`)
    return
  }

  if (error.description.includes('bot is not a member')) {
    console.log('Bot removed from chat:', ctx.chat?.id)
    return
  }

  return ctx.reply('❌ Permission denied. Please check bot permissions.')
}

async function handleRateLimit(ctx, error) {
  const retryAfter = parseInt(error.parameters?.retry_after || 60)

  // Store in retry queue
  if (ctx.env.RETRY_QUEUE) {
    await ctx.env.RETRY_QUEUE.put(
      `retry:${ctx.from.id}:${Date.now()}`,
      JSON.stringify({
        update: ctx.update,
        retryAt: Date.now() + retryAfter * 1000
      }),
      { expirationTtl: retryAfter + 300 } // Expire after retry time + 5 min
    )
  }

  return ctx.reply(`⏳ Too many messages. Please wait ${retryAfter} seconds.`)
}

async function handleGenericError(ctx, error) {
  const errorId = crypto.randomUUID()

  console.error(`Error ${errorId}:`, error)

  return ctx.reply(
    `❌ An error occurred. Please try again later.\n\n` + `Error ID: \`${errorId}\``,
    { parse_mode: 'MarkdownV2' }
  )
}

// Retry Logic with Exponential Backoff
export async function withRetry(fn, options = {}) {
  const { retries = 3, minDelay = 1000, maxDelay = 10000, factor = 2, onRetry = () => {} } = options

  let lastError

  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (i === retries - 1) {
        throw error
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(minDelay * Math.pow(factor, i), maxDelay)

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * delay * 0.1
      const totalDelay = delay + jitter

      onRetry(error, i + 1, totalDelay)

      await sleep(totalDelay)
    }
  }

  throw lastError
}

// Timeout Wrapper
export async function withTimeout(promise, timeoutMs, timeoutError) {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => {
      reject(timeoutError || new Error(`Operation timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  return Promise.race([promise, timeout])
}

// Safe Execute with Fallback
export async function safeExecute(fn, fallback, context = {}) {
  try {
    return await fn()
  } catch (error) {
    console.error('Safe execute error:', error, context)

    if (typeof fallback === 'function') {
      return fallback(error)
    }

    return fallback
  }
}

// Error Middleware for Hono
export function errorMiddleware(env) {
  return async (ctx, next) => {
    try {
      await next()
    } catch (error) {
      console.error('Request error:', error)

      // Send to Sentry
      if (env.SENTRY_DSN) {
        const sentry = initSentry(env)
        sentry.captureException(error, {
          tags: {
            path: ctx.req.path,
            method: ctx.req.method
          }
        })
      }

      // Return appropriate error response
      if (error instanceof ValidationError) {
        return ctx.json({ error: error.message, field: error.context.field }, 400)
      }

      if (error instanceof RateLimitError) {
        return ctx.json({ error: 'Rate limit exceeded', retryAfter: error.retryAfter }, 429)
      }

      // Generic error
      const errorId = crypto.randomUUID()
      console.error(`Error ${errorId}:`, error)

      return ctx.json(
        {
          error: 'Internal server error',
          errorId,
          message: env.ENVIRONMENT === 'development' ? error.message : undefined
        },
        500
      )
    }
  }
}

// User-Friendly Error Messages
export const ERROR_MESSAGES = {
  COMMAND_NOT_FOUND: '❓ Command not found. Type /help to see available commands.',
  PERMISSION_DENIED: "🚫 You don't have permission to use this command.",
  INVALID_ARGUMENT: '❌ Invalid argument. Please check the command format.',
  SERVICE_UNAVAILABLE: '⚠️ Service temporarily unavailable. Please try again later.',
  SESSION_EXPIRED: '⏰ Your session has expired. Please start over with /start.',
  PAYMENT_FAILED: '💳 Payment processing failed. Please try again or contact support.',
  AI_ERROR: '🤖 AI service is temporarily unavailable. Please try again later.',
  DATABASE_ERROR: '💾 Database error. Our team has been notified.',
  NETWORK_ERROR: '🌐 Network error. Please check your connection and try again.',
  UNKNOWN_ERROR: '❌ An unexpected error occurred. Please try again later.'
}

// Error Recovery Strategies
export async function recoverFromError(ctx, error, strategies) {
  for (const strategy of strategies) {
    try {
      const result = await strategy(ctx, error)
      if (result !== false) {
        return result
      }
    } catch (strategyError) {
      console.error('Recovery strategy failed:', strategyError)
    }
  }

  // All strategies failed
  return ctx.reply(ERROR_MESSAGES.UNKNOWN_ERROR)
}

// Common Recovery Strategies
export const recoveryStrategies = {
  // Clear session and restart
  clearSession: async (ctx, error) => {
    if (error.message.includes('session')) {
      await ctx.env.SESSIONS.delete(`session:${ctx.from.id}`)
      return ctx.reply('Session cleared. Please try /start to begin again.')
    }
    return false
  },

  // Fallback to simpler response
  simplifyResponse: async (ctx, error) => {
    if (error.message.includes('MESSAGE_TOO_LONG')) {
      return ctx.reply('Response was too long. Type /help for a summary.')
    }
    return false
  },

  // Retry with different parameters
  retryModified: async (ctx, error) => {
    if (error.error_code === 400) {
      // Try without parse_mode, keyboard, etc.
      return ctx.reply('Please try your request again.')
    }
    return false
  }
}

// Utility Functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function markUserBlocked(db, userId) {
  try {
    await db
      .prepare(
        'UPDATE users SET is_blocked = TRUE, blocked_at = CURRENT_TIMESTAMP WHERE telegram_id = ?'
      )
      .bind(userId)
      .run()
  } catch (error) {
    console.error('Failed to mark user as blocked:', error)
  }
}

// Usage Example
/*
// In your bot setup
import { setupErrorHandler, withRetry, ERROR_MESSAGES } from './patterns/error-handling.js';

// Setup global error handler
setupErrorHandler(bot, env);

// Use in commands
bot.command('risky', async (ctx) => {
  try {
    const result = await withRetry(
      () => riskyOperation(ctx),
      {
        retries: 3,
        onRetry: (error, attempt) => {
          console.log(`Retry attempt ${attempt} after error:`, error.message);
        }
      }
    );
    
    await ctx.reply(`Success: ${result}`);
  } catch (error) {
    await ctx.reply(ERROR_MESSAGES.SERVICE_UNAVAILABLE);
  }
});
*/
