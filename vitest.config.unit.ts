/**
 * Lightweight unit test configuration using Node.js runner
 * For tests that don't require Cloudflare Workers environment
 */
import path from 'path';
import { fileURLToPath } from 'url';

import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    name: 'unit',
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup/unit-test-setup.ts'],
    include: [
      // All test files
      'src/**/*.{test,spec}.ts',
      // Exclude integration and worker tests
      '!src/**/*.integration.{test,spec}.ts',
      '!src/**/*.worker.{test,spec}.ts',
      // Exclude commands and middleware (they need Worker environment)
      '!src/adapters/telegram/commands/**/*.{test,spec}.ts',
      '!src/adapters/telegram/middleware/**/*.{test,spec}.ts',
      '!src/connectors/**/*.{test,spec}.ts',
    ],
    exclude: ['eslint-rules/**', 'node_modules/**', 'website/**'],
    // Memory-efficient pool configuration
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Disable file parallelism for memory efficiency
    fileParallelism: false,
    // Use v8 coverage provider (more memory efficient)
    coverage: {
      provider: 'v8',
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
    // Shorter timeouts for unit tests
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Mock heavy dependencies in unit tests
      miniflare: path.resolve(__dirname, './src/__tests__/mocks/miniflare-mock.ts'),
      '@cloudflare/workers-types': path.resolve(
        __dirname,
        './src/__tests__/mocks/workers-types-mock.ts',
      ),
    },
  },
});
