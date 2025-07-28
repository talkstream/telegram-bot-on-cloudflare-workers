import type { Middleware } from 'grammy';

import type { BotContext } from '@/types/telegram';
import type { IMonitoringConnector } from '@/core/interfaces/monitoring.js';

/**
 * Middleware that automatically sets user context for monitoring
 */
export function createMonitoringContextMiddleware(
  monitoring: IMonitoringConnector | undefined,
): Middleware<BotContext> {
  return async (ctx, next) => {
    // Set user context if monitoring is available
    if (monitoring?.isAvailable() && ctx.from) {
      const userData: Record<string, unknown> = {
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        languageCode: ctx.from.language_code,
        isPremium: ctx.from.is_premium,
        isBot: ctx.from.is_bot,
      };

      // Filter out undefined values
      const filteredData = Object.entries(userData).reduce(
        (acc, [key, value]) => {
          if (value !== undefined) {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, unknown>,
      );

      monitoring.setUserContext(ctx.from.id.toString(), filteredData);

      // Add breadcrumb for the current update
      if (ctx.update.message) {
        monitoring.addBreadcrumb({
          message: `Message from user ${ctx.from.id}`,
          category: 'telegram.message',
          level: 'info',
          type: 'user',
          data: {
            chatId: ctx.chat?.id,
            chatType: ctx.chat?.type,
            messageId: ctx.update.message.message_id,
            hasText: !!ctx.update.message.text,
            hasPhoto: !!ctx.update.message.photo,
            hasDocument: !!ctx.update.message.document,
          },
        });
      } else if (ctx.update.callback_query) {
        monitoring.addBreadcrumb({
          message: `Callback query from user ${ctx.from.id}`,
          category: 'telegram.callback',
          level: 'info',
          type: 'user',
          data: {
            callbackData: ctx.update.callback_query.data,
            messageId: ctx.update.callback_query.message?.message_id,
          },
        });
      }
    }

    // Continue to next middleware
    await next();

    // Clear user context after handling (optional, depends on requirements)
    // monitoring?.clearUserContext();
  };
}

/**
 * Helper to track command execution with monitoring
 */
export function trackCommand(
  monitoring: IMonitoringConnector | undefined,
  commandName: string,
  ctx: BotContext,
): void {
  if (!monitoring?.isAvailable()) return;

  monitoring.addBreadcrumb({
    message: `Command /${commandName} executed`,
    category: 'command',
    level: 'info',
    type: 'user',
    data: {
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      chatType: ctx.chat?.type,
      args: ctx.match,
    },
  });
}

/**
 * Helper to track errors with context
 */
export function trackError(
  monitoring: IMonitoringConnector | undefined,
  error: Error,
  ctx: BotContext,
  additionalContext?: Record<string, unknown>,
): void {
  if (!monitoring?.isAvailable()) return;

  monitoring.captureException(error, {
    user: {
      id: ctx.from?.id,
      username: ctx.from?.username,
    },
    chat: {
      id: ctx.chat?.id,
      type: ctx.chat?.type,
    },
    update: {
      updateId: ctx.update.update_id,
      hasMessage: !!ctx.update.message,
      hasCallback: !!ctx.update.callback_query,
    },
    ...additionalContext,
  });
}

/**
 * Create a command wrapper that automatically tracks execution
 */
export function createMonitoredCommand<T extends BotContext>(
  monitoring: IMonitoringConnector | undefined,
  commandName: string,
  handler: (ctx: T) => Promise<void>,
): (ctx: T) => Promise<void> {
  return async (ctx: T) => {
    const transaction = monitoring?.startTransaction?.({
      name: `command.${commandName}`,
      op: 'command',
      tags: {
        command: commandName,
        userId: ctx.from?.id.toString() || 'unknown',
        chatType: ctx.chat?.type || 'unknown',
      },
    });

    try {
      trackCommand(monitoring, commandName, ctx);
      await handler(ctx);
      transaction?.setStatus('ok');
    } catch (error) {
      transaction?.setStatus('internal_error');
      trackError(monitoring, error as Error, ctx, { command: commandName });
      throw error;
    } finally {
      transaction?.finish();
    }
  };
}
