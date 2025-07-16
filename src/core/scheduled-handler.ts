import { logger } from '../lib/logger';

export async function handleScheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  logger.info(`Scheduled event received: ${event.cron}`);
  // Add your scheduled task logic here
  // For example, sending daily reminders, cleaning up old data, etc.
}
