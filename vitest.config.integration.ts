/**
 * Integration test configuration using Cloudflare Workers pool
 * For tests that require actual Worker environment, D1, KV, etc.
 */
import path from 'path';
import { fileURLToPath } from 'url';

import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineWorkersConfig({
  test: {
    name: 'integration',
    globals: true,
    setupFiles: ['./src/__tests__/setup/integration-test-setup.ts'],
    include: [
      // Only integration tests that need Worker environment
      'src/**/*.integration.test.ts',
      'src/**/*.worker.test.ts',
      // Specific tests that require Cloudflare runtime
      'src/commands/**/*.test.ts',
      'src/middleware/**/*.test.ts',
      'src/connectors/**/*.test.ts',
    ],
    exclude: ['eslint-rules/**', 'node_modules/**', 'website/**'],
    poolOptions: {
      workers: {
        // Disable isolated storage to save memory
        isolatedStorage: false,
        wrangler: {
          configPath: './wrangler.toml',
        },
        miniflare: {
          compatibilityDate: '2024-01-01',
          compatibilityFlags: ['nodejs_compat'],
          // Minimal bindings for tests
          bindings: {
            TELEGRAM_BOT_TOKEN: 'test-bot-token',
            TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
            ENVIRONMENT: 'test',
          },
          // Only create D1/KV when actually needed
          d1Databases: ['DB'],
          kvNamespaces: ['SESSIONS'],
        },
      },
    },
    // Run integration tests sequentially to avoid resource conflicts
    fileParallelism: false,
    maxConcurrency: 1,
    // No coverage for integration tests (run separately)
    coverage: {
      enabled: false,
    },
    // Longer timeouts for integration tests
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
