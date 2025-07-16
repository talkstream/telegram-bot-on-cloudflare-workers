import { Hono } from 'hono';

import type { Env } from './config/env';
import { validateEnv } from './config/env';
import { loggerMiddleware } from './middleware/logger';
import { rateLimiter } from './middleware/rate-limiter';
import { wrapSentry } from './config/sentry';
import { handleScheduled } from './core/scheduled-handler';
import { healthHandler } from './core/health-handler';
import { UpdateSchema } from './lib/telegram-types';
import { errorHandler } from './middleware/error-handler';
import { ValidationError } from './lib/errors';
import { TelegramAdapter } from './core/telegram-adapter';

// Initialize the app
const app = new Hono<{ Bindings: Env }>();

// Global Error Handler
app.onError(errorHandler());

// Middleware
app.use('*', loggerMiddleware());

// Routes
app.get('/', (c) => c.text('Hello, world!'));
app.get('/health', healthHandler);

// Telegram Webhook with security validation
app.post('/webhook/:token', rateLimiter(), async (c) => {
  const env = validateEnv(c.env);
  const token = c.req.param('token');

  // Validate webhook token
  if (token !== env.TELEGRAM_WEBHOOK_SECRET) {
    return c.text('Unauthorized', 401);
  }

  // Validate Telegram secret header if provided
  const secretToken = c.req.header('X-Telegram-Bot-Api-Secret-Token');
  if (secretToken && secretToken !== env.TELEGRAM_WEBHOOK_SECRET) {
    return c.text('Unauthorized', 401);
  }

  const telegramAdapter = new TelegramAdapter(env);

  // Validate incoming Telegram update
  const rawBody = await c.req.json();
  const parsedUpdate = UpdateSchema.safeParse(rawBody);

  if (!parsedUpdate.success) {
    throw new ValidationError('Invalid Telegram update payload.');
  }

  await telegramAdapter.handleUpdate(parsedUpdate.data as any);
  return c.text('OK', 200);
});

export default { ...wrapSentry(app), scheduled: handleScheduled };
