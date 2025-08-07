/**
 * Logger adapter to make the simple logger compatible with ILogger interface
 */

import { logger as simpleLogger } from './logger'

import type { ILogger } from '@/core/interfaces/logger'

class LoggerAdapter implements ILogger {
  private context: Record<string, unknown>

  constructor(context: Record<string, unknown> = {}) {
    this.context = context
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    simpleLogger.debug(message, { ...this.context, ...meta })
  }

  info(message: string, meta?: Record<string, unknown>): void {
    simpleLogger.info(message, { ...this.context, ...meta })
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    simpleLogger.warn(message, { ...this.context, ...meta })
  }

  error(message: string, meta?: Record<string, unknown>): void {
    simpleLogger.error(message, { ...this.context, ...meta })
  }

  child(meta: Record<string, unknown>): ILogger {
    return new LoggerAdapter({ ...this.context, ...meta })
  }
}

export const loggerAdapter: ILogger = new LoggerAdapter()
