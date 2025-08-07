/**
 * Monitored Command Helper
 *
 * Automatically tracks command execution with monitoring
 */

import type { EventBus } from '@/core/events/event-bus'
import type { IMonitoringConnector } from '@/core/interfaces/monitoring'
import type { BotContext } from '@/types/telegram'

// Command types (local definitions to avoid import errors)
export interface CommandModule<T = object> {
  command: string
  describe: string
  handler: (ctx: BotContext & T) => Promise<void>
}

export interface CommandBuilder {
  command: (cmd: string) => {
    describe: (desc: string) => {
      handler: <T = object>(handler: (ctx: BotContext & T) => Promise<void>) => CommandModule<T>
    }
  }
}

export type CommandContext<T = object> = BotContext & T

export interface MonitoredCommandOptions<T = object> {
  /**
   * The base command module
   */
  command: CommandModule<T>

  /**
   * Monitoring connector
   */
  monitoring?: IMonitoringConnector

  /**
   * Event bus for event emission
   */
  eventBus?: EventBus

  /**
   * Track performance metrics
   */
  trackPerformance?: boolean

  /**
   * Track user context
   */
  trackUserContext?: boolean

  /**
   * Custom metadata to include
   */
  metadata?: Record<string, unknown>
}

/**
 * Create a monitored command that automatically tracks execution
 */
export function createMonitoredCommand<T = object>(
  options: MonitoredCommandOptions<T>
): CommandModule<T> {
  const {
    command,
    monitoring,
    eventBus,
    trackPerformance = true,
    trackUserContext = true,
    metadata = {}
  } = options

  // Return original command if no monitoring
  if (!monitoring && !eventBus) {
    return command
  }

  return {
    ...command,
    handler: async (ctx: CommandContext<T>) => {
      const commandName = command.command
      const startTime = Date.now()
      const requestId = crypto.randomUUID()

      // Extract user info from context
      const userId = ctx.from?.id?.toString()
      const username = ctx.from?.username

      // Set user context in monitoring
      if (trackUserContext && monitoring && userId) {
        monitoring.setUserContext(userId, {
          username,
          firstName: ctx.from?.first_name,
          lastName: ctx.from?.last_name
        })
      }

      // Add breadcrumb for command start
      monitoring?.addBreadcrumb({
        message: `Command started: ${commandName}`,
        category: 'command',
        level: 'info',
        data: {
          userId,
          username,
          ...metadata
        }
      })

      // Emit command start event
      if (eventBus) {
        eventBus.emit(
          'command:executed',
          {
            command: commandName,
            userId,
            username,
            requestId,
            timestamp: startTime
          },
          'MonitoredCommand'
        )
      }

      // Track command execution
      try {
        // Execute the original handler
        const result = await command.handler(ctx)

        const duration = Date.now() - startTime

        // Track success metrics
        if (trackPerformance && monitoring) {
          monitoring.trackMetric('command_duration', duration, {
            command: commandName,
            status: 'success'
          })

          monitoring.trackEvent('command_completed', {
            command: commandName,
            userId,
            username,
            duration,
            requestId,
            ...metadata
          })
        }

        // Add success breadcrumb
        monitoring?.addBreadcrumb({
          message: `Command completed: ${commandName}`,
          category: 'command',
          level: 'info',
          data: {
            duration,
            requestId
          }
        })

        return result
      } catch (error) {
        const duration = Date.now() - startTime
        const errorObj = error instanceof Error ? error : new Error(String(error))

        // Capture exception in monitoring
        monitoring?.captureException(errorObj, {
          command: commandName,
          userId,
          username,
          duration,
          requestId,
          ...metadata
        })

        // Track error metrics
        if (trackPerformance && monitoring) {
          monitoring.trackMetric('command_duration', duration, {
            command: commandName,
            status: 'error'
          })

          monitoring.trackEvent('command_failed', {
            command: commandName,
            userId,
            username,
            duration,
            error: errorObj.message,
            requestId,
            ...metadata
          })
        }

        // Emit error event
        if (eventBus) {
          eventBus.emit(
            'command:error',
            {
              command: commandName,
              error: errorObj,
              userId,
              username,
              duration,
              requestId
            },
            'MonitoredCommand'
          )
        }

        // Re-throw the error
        throw error
      }
    }
  }
}

/**
 * Create a command builder that automatically adds monitoring
 */
export function createMonitoredCommandBuilder(
  monitoring?: IMonitoringConnector,
  eventBus?: EventBus
): CommandBuilder {
  return {
    command: (cmd: string) => ({
      describe: (desc: string) => ({
        handler: <T = object>(handler: (ctx: CommandContext<T>) => Promise<void>) => {
          const command: CommandModule<T> = {
            command: cmd,
            describe: desc,
            handler
          }

          return createMonitoredCommand({
            command,
            monitoring,
            eventBus
          })
        }
      })
    })
  }
}

/**
 * Decorator for monitoring command methods
 */
export function MonitorCommand(commandName?: string) {
  return function (target: object, propertyKey: string | symbol, descriptor?: PropertyDescriptor) {
    if (!descriptor) {
      return
    }

    const originalMethod = descriptor.value

    if (typeof originalMethod !== 'function') {
      throw new Error('MonitorCommand can only be applied to methods')
    }

    const className = target.constructor?.name || 'UnknownClass'
    const methodName = String(propertyKey)
    const command = commandName || `${className}.${methodName}`

    descriptor.value = async function (this: unknown, ctx: CommandContext) {
      // Get monitoring from context or global
      const monitoring = (ctx as { monitoring?: IMonitoringConnector }).monitoring

      if (!monitoring) {
        // No monitoring available, run original method
        return originalMethod.apply(this, [ctx])
      }

      const startTime = Date.now()
      const userId = ctx.from?.id?.toString()

      try {
        const result = await originalMethod.apply(this, [ctx])

        const duration = Date.now() - startTime

        monitoring.trackMetric('command_duration', duration, {
          command,
          status: 'success'
        })

        return result
      } catch (error) {
        const duration = Date.now() - startTime
        const errorObj = error instanceof Error ? error : new Error(String(error))

        monitoring.captureException(errorObj, {
          command,
          userId,
          duration
        })

        throw error
      }
    }

    return descriptor
  }
}
