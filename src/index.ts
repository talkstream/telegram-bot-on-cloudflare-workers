import { Hono } from 'hono';

import type { Env } from './config/env';
import { validateEnv } from './config/env';
import { loggerMiddleware } from './middleware/logger';
import { rateLimiter } from './middleware/rate-limiter';
import { wrapSentry } from './config/sentry';
import { handleScheduled } from './core/scheduled-handler';
import { healthHandler } from './core/health-handler';
import { errorHandler } from './middleware/error-handler';
import { EventBus } from './core/events/event-bus';
import { TelegramConnector } from './connectors/messaging/telegram';
import { CloudPlatformFactory } from './core/cloud/platform-factory';
// Register all cloud connectors
import './connectors/cloud';

// Initialize the app
const app = new Hono<{ Bindings: Env }>();

// Global Error Handler
app.onError(errorHandler());

// Middleware
app.use('*', loggerMiddleware());

// Routes
app.get('/', (c) => c.text('Hello, world!'));
app.get('/health', healthHandler);

// Store connectors per environment
const connectors = new Map<string, TelegramConnector>();

async function getTelegramConnector(env: Env): Promise<TelegramConnector> {
  const key = env.TELEGRAM_BOT_TOKEN;

  if (!connectors.has(key)) {
    // Initialize infrastructure
    const eventBus = new EventBus();

    // Initialize service connectors
    if (env.AI_PROVIDER) {
      const { AIServiceConnector } = await import('./connectors/ai/ai-service-connector');
      new AIServiceConnector(
        eventBus,
        {
          defaultProvider: 'google',
          fallbackProviders: ['openai'],
        },
        (env.TIER as 'free' | 'paid') || 'free',
      );
    }

    // Create cloud platform connector using factory
    const cloudConnector = CloudPlatformFactory.createFromTypedEnv(env);

    if (env.SESSIONS) {
      const { SessionServiceConnector } = await import(
        './connectors/session/session-service-connector'
      );
      new SessionServiceConnector(eventBus, {
        sessionsKv: cloudConnector.getKeyValueStore('SESSIONS'),
        tier: (env.TIER as 'free' | 'paid') || 'free',
      });
    }

    if (env.DB) {
      const { PaymentServiceConnector } = await import(
        './connectors/payment/payment-service-connector'
      );
      new PaymentServiceConnector(eventBus, {
        db: cloudConnector.getDatabaseStore('DB'),
        tier: (env.TIER as 'free' | 'paid') || 'free',
      });
    }

    // Create and initialize TelegramConnector
    const telegramConnector = new TelegramConnector();
    await telegramConnector.initialize({
      token: env.TELEGRAM_BOT_TOKEN,
      webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
      eventBus,
      // Additional config
      parseMode: 'HTML',
      linkPreview: false,
      batch: {
        enabled: true,
        maxSize: 30,
        delay: 50,
      },
    });

    // TODO: Load plugins
    // await pluginManager.loadPlugins();

    connectors.set(key, telegramConnector);
  }

  return connectors.get(key) as TelegramConnector;
}

// Telegram Webhook with new connector architecture
app.post('/webhook/:token', rateLimiter(), async (c) => {
  const env = validateEnv(c.env);
  const token = c.req.param('token');

  // Validate webhook token
  if (token !== env.TELEGRAM_WEBHOOK_SECRET) {
    return c.text('Unauthorized', 401);
  }

  // Validate Telegram secret header (required for production security)
  const secretToken = c.req.header('X-Telegram-Bot-Api-Secret-Token');
  if (!secretToken || secretToken !== env.TELEGRAM_WEBHOOK_SECRET) {
    return c.text('Unauthorized', 401);
  }

  // Get or create connector
  const telegramConnector = await getTelegramConnector(env);

  // Validate webhook request
  const request = c.req.raw;
  const isValid = await telegramConnector.validateWebhook(request);
  if (!isValid) {
    return c.text('Unauthorized', 401);
  }

  // Handle webhook
  const response = await telegramConnector.handleWebhook(request);
  return response;
});

export default wrapSentry(app, { scheduled: handleScheduled });
