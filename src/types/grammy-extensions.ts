/**
 * Grammy extension types for proper typing of context properties
 */

import type { Context } from 'grammy'

/**
 * Command data that Grammy adds to context when processing commands
 */
export interface CommandData {
  command: string
  args: string
  match?: RegExpMatchArray | null
}

/**
 * Extended Grammy context with command property
 */
export interface CommandContext extends Context {
  command?: CommandData
}

/**
 * Extended Grammy context with updateType property
 */
export interface UpdateContext extends Context {
  updateType: string
}

/**
 * Extended Grammy context with error property
 */
export interface ErrorContext extends Context {
  error?: Error
}

/**
 * Combined Grammy context with all extensions
 */
export type ExtendedGrammyContext = Context & {
  command?: CommandData
  updateType?: string
  error?: Error
}
