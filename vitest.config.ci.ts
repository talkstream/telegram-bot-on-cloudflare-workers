import path from 'path';
import { fileURLToPath } from 'url';

import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineWorkersConfig({
  test: {
    globals: true,
    setupFiles: ['./src/__tests__/setup/grammy-mock.ts'],
    exclude: ['eslint-rules/**', 'node_modules/**', 'website/**', '**/node_modules/**'],
    // Run tests sequentially to reduce memory pressure in CI
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        maxForks: 1,
      },
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
      provider: 'istanbul',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'src/__tests__/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        '**/*.type.ts',
        'eslint-rules/**',
      ],
    },
    // Timeout for CI environment
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
