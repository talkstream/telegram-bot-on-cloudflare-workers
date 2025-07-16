import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineWorkersConfig({
  test: {
    globals: true,
    setupFiles: ['./src/__tests__/setup/grammy-mock.ts'],
    poolOptions: {
      workers: {
        isolatedStorage: true,
        wrangler: {
          configPath: './wrangler.toml',
        },
        miniflare: {
          compatibilityDate: '2024-01-01',
          compatibilityFlags: ['nodejs_compat'],
          // Bindings for unit tests
          bindings: {
            TELEGRAM_BOT_TOKEN: 'test-bot-token',
            TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
            GEMINI_API_KEY: 'test-gemini-key',
            ADMIN_KEY: 'test-admin-key',
            ENVIRONMENT: 'test',
            SENTRY_DSN: '',
          },
          // Mock D1 database
          d1Databases: ['DB'],
          // Mock KV namespaces
          kvNamespaces: ['SESSIONS', 'CACHE'],
        },
      },
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
