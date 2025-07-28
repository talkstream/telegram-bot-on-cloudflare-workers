import type { CommandHandler } from '@/types';
import { createMonitoredCommand } from '@/middleware/monitoring-context';

/**
 * Wraps a command handler with monitoring capabilities
 */
export function withMonitoring(commandName: string, handler: CommandHandler): CommandHandler {
  return async (ctx) => {
    // Get monitoring from context
    const monitoring = ctx.monitoring;

    // Create monitored version of the handler
    const monitoredHandler = createMonitoredCommand(monitoring, commandName, handler);

    // Execute the monitored handler
    await monitoredHandler(ctx);
  };
}
