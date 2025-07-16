import { MiddlewareHandler } from 'hono';
import { logger } from '../lib/logger';
import { BotError, ValidationError, UnauthorizedError } from '../lib/errors';

export const errorHandler = (): MiddlewareHandler => async (err, c) => {
  if (err instanceof ValidationError) {
    logger.warn(`Validation Error: ${err.message}`);
    return c.json({ error: err.message }, err.statusCode);
  } else if (err instanceof UnauthorizedError) {
    logger.warn(`Unauthorized Access: ${err.message}`);
    return c.json({ error: err.message }, err.statusCode);
  } else if (err instanceof BotError) {
    logger.error(`Bot Error: ${err.message}`, err);
    return c.json({ error: err.message }, err.statusCode);
  } else if (err instanceof Error) {
    logger.error(`Unhandled Error: ${err.message}`, err);
    // Sentry should catch this via wrapSentry
    return c.json({ error: 'Internal Server Error', message: err.message }, 500);
  } else {
    logger.error(`Unknown Error: ${err}`, err);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
};
