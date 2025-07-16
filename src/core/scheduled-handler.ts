import { logger } from '../lib/logger';

import type { Env } from '@/types';

export async function handleScheduled(
  event: ScheduledEvent,
  _env: Env,
  _ctx: ExecutionContext
) {
  logger.info(`Scheduled event received: ${event.cron}`);
  // Add your scheduled task logic here
  // For example, sending daily reminders, cleaning up old data, etc.
}
