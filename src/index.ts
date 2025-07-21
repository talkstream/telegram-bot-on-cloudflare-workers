import { Hono } from 'hono';

import type { Env } from './config/env';
import { validateEnv } from './config/env';
import { isDemoMode, getBotToken, getWebhookSecret } from './lib/env-guards';
import { loggerMiddleware } from './middleware/logger';
import { rateLimiter } from './middleware/rate-limiter';
import { wrapSentry } from './config/sentry';
import { handleScheduled } from './core/scheduled-handler';
import { errorHandler } from './middleware/error-handler';
import { EventBus } from './core/events/event-bus';
import { TelegramConnector } from './connectors/messaging/telegram';
import { CloudPlatformFactory } from './core/cloud/platform-factory';
// Register all cloud connectors
import './connectors/cloud';
// Import mock connectors for demo mode
import { MockTelegramConnector } from './connectors/messaging/telegram/mock-telegram-connector';
import { MockMonitoringConnector } from './connectors/monitoring/mock-monitoring-connector';

// Initialize the app
const app = new Hono<{ Bindings: Env }>();

// Global Error Handler
app.onError(errorHandler());

// Middleware
app.use('*', loggerMiddleware());

// Routes
app.get('/', (c) => c.text('🚀 Wireframe v1.2 - Universal AI Assistant Platform'));

// Enhanced health endpoint for demo mode
app.get('/health', async (c) => {
  const env = c.env;
  const demoMode = isDemoMode(env);

  return c.json({
    status: 'ok',
    version: '1.2.0',
    mode: demoMode ? 'demo' : 'production',
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT || 'development',
    platform: env.CLOUD_PLATFORM || 'cloudflare',
    features: {
      telegram: demoMode ? 'mock' : 'enabled',
      ai: env.AI_PROVIDER || 'mock',
      monitoring: env.SENTRY_DSN ? 'enabled' : 'mock',
      database: env.DB ? 'enabled' : 'disabled',
      sessions: env.SESSIONS ? 'enabled' : 'disabled',
    },
    message: demoMode
      ? '🎯 Running in DEMO mode - configure secrets to enable full functionality'
      : '✅ All systems operational',
  });
});

// Store connectors per environment
const connectors = new Map<string, TelegramConnector | MockTelegramConnector>();

async function getTelegramConnector(env: Env): Promise<TelegramConnector | MockTelegramConnector> {
  const demoMode = isDemoMode(env);
  const key = demoMode ? 'mock' : getBotToken(env);

  if (!connectors.has(key)) {
    // Initialize infrastructure
    const eventBus = new EventBus();

    // Initialize monitoring (use mock if no Sentry DSN)
    if (!env.SENTRY_DSN) {
      const mockMonitoring = new MockMonitoringConnector();
      await mockMonitoring.initialize({
        environment: env.ENVIRONMENT || 'development',
        release: '1.2.0',
      });
    }

    // Create cloud platform connector using factory
    const cloudConnector = CloudPlatformFactory.createFromTypedEnv(env);
    const constraints = cloudConnector.getResourceConstraints();

    // Initialize AI service connector or mock
    if (env.AI_PROVIDER && env.AI_PROVIDER !== 'mock') {
      const { AIServiceConnector } = await import('./connectors/ai/ai-service-connector');
      new AIServiceConnector(
        eventBus,
        {
          defaultProvider: 'google',
          fallbackProviders: ['openai'],
        },
        constraints,
      );
    } else {
      // Use mock AI connector in demo mode
      const { MockAIConnector } = await import('./connectors/ai/mock-ai-connector');
      const mockAI = new MockAIConnector();
      await mockAI.initialize({});
    }

    if (env.SESSIONS) {
      const { SessionServiceConnector } = await import(
        './connectors/session/session-service-connector'
      );
      new SessionServiceConnector(eventBus, {
        sessionsKv: cloudConnector.getKeyValueStore('SESSIONS'),
        constraints,
      });
    }

    if (env.DB) {
      const { PaymentServiceConnector } = await import(
        './connectors/payment/payment-service-connector'
      );
      new PaymentServiceConnector(eventBus, {
        db: cloudConnector.getDatabaseStore('DB'),
        constraints,
      });
    }

    // Create appropriate connector
    if (!demoMode) {
      const telegramConnector = new TelegramConnector();
      await telegramConnector.initialize({
        token: getBotToken(env),
        webhookSecret: getWebhookSecret(env),
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
    } else {
      // In demo mode, use mock connector
      const mockConnector = new MockTelegramConnector();
      await mockConnector.initialize({});
      connectors.set(key, mockConnector);
    }
  }

  return connectors.get(key) as TelegramConnector | MockTelegramConnector;
}

// Telegram Webhook with new connector architecture
app.post('/webhook/:token', rateLimiter(), async (c) => {
  const env = validateEnv(c.env);
  const token = c.req.param('token');
  const demoMode = isDemoMode(env);

  // In demo mode, accept any token
  if (!demoMode) {
    // Validate webhook token
    if (token !== getWebhookSecret(env)) {
      return c.text('Unauthorized', 401);
    }

    // Validate Telegram secret header (required for production security)
    const secretToken = c.req.header('X-Telegram-Bot-Api-Secret-Token');
    if (!secretToken || secretToken !== getWebhookSecret(env)) {
      return c.text('Unauthorized', 401);
    }
  }

  // Get or create connector
  const telegramConnector = await getTelegramConnector(env);

  // Handle webhook
  const response = await telegramConnector.handleWebhook(c.req.raw);
  return response;
});

// Demo endpoint
app.get('/demo', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Wireframe v1.2 Demo</title>
      <style>
        body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
        h1 { color: #333; }
        .status { background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .feature { margin: 10px 0; }
        .enabled { color: green; }
        .disabled { color: orange; }
        code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
      </style>
    </head>
    <body>
      <h1>🚀 Wireframe v1.2 - Universal AI Assistant Platform</h1>
      
      <div class="status">
        <h2>System Status</h2>
        <p>✅ Running in DEMO mode</p>
        <p>Check <a href="/health">/health</a> for detailed status</p>
      </div>
      
      <h2>Features</h2>
      <div class="feature">
        <span class="enabled">✅</span> Multi-cloud deployment (Cloudflare, AWS, GCP)
      </div>
      <div class="feature">
        <span class="enabled">✅</span> Multi-messaging platforms (Telegram, Discord, Slack)
      </div>
      <div class="feature">
        <span class="enabled">✅</span> Event-driven architecture with EventBus
      </div>
      <div class="feature">
        <span class="enabled">✅</span> Plugin system for extensibility
      </div>
      <div class="feature">
        <span class="enabled">✅</span> AI provider abstraction
      </div>
      
      <h2>Quick Start</h2>
      <p>To enable full functionality:</p>
      <ol>
        <li>Set <code>TELEGRAM_BOT_TOKEN</code> and <code>TELEGRAM_WEBHOOK_SECRET</code></li>
        <li>Configure AI provider with <code>AI_PROVIDER</code> and API keys</li>
        <li>Add monitoring with <code>SENTRY_DSN</code></li>
        <li>Deploy to production</li>
      </ol>
      
      <p>
        <a href="https://github.com/talkstream/typescript-wireframe-platform">GitHub</a> |
        <a href="https://github.com/talkstream/typescript-wireframe-platform/releases/tag/v1.2.0">Release Notes</a>
      </p>
    </body>
    </html>
  `);
});

export default wrapSentry(app, { scheduled: handleScheduled });
