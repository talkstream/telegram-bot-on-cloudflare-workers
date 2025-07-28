import path from 'path';
import { fileURLToPath } from 'url';

import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineWorkersConfig({
  test: {
    globals: true,
    setupFiles: ['./src/__tests__/setup/grammy-mock.ts'],
    exclude: ['eslint-rules/**', 'node_modules/**', 'website/**', '**/node_modules/**'],
    // Run tests sequentially to reduce memory usage
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        // Limit the number of threads
        maxThreads: 1,
        minThreads: 1,
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
    // Reduce test timeout for faster feedback
    testTimeout: 30000,
    // Run garbage collection more frequently
    hookTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      exclude: [
        'node_modules/**',
        'src/__tests__/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        '**/*.type.ts',
        'eslint-rules/**',
        'coverage/**',
        'dist/**',
        'website/**',
        'src/cli/**',
        'scripts/**',
      ],
      // Reduce memory usage
      all: false,
      clean: true,
      reportOnFailure: false,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
