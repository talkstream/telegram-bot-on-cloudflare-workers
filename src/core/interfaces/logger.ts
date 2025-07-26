/**
 * Logger interface for application logging
 */

export interface ILogger {
  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>): void;

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void;

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void;

  /**
   * Log error message
   */
  error(message: string, context?: Record<string, unknown>): void;

  /**
   * Create child logger with additional context
   */
  child(context: Record<string, unknown>): ILogger;
}
