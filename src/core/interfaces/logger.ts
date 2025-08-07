/**
 * Logger interface for universal logging across platforms
 */

export interface ILogger {
  /**
   * Debug level logging
   */
  debug(message: string, meta?: Record<string, unknown>): void

  /**
   * Info level logging
   */
  info(message: string, meta?: Record<string, unknown>): void

  /**
   * Warning level logging
   */
  warn(message: string, meta?: Record<string, unknown>): void

  /**
   * Error level logging
   */
  error(message: string, meta?: Record<string, unknown>): void

  /**
   * Create child logger with additional context
   */
  child(meta: Record<string, unknown>): ILogger
}
