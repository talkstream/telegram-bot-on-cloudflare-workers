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
      // Core business logic tests
      'src/core/**/*.test.ts',
      'src/patterns/**/*.test.ts',
      'src/plugins/**/*.test.ts',
      'src/lib/**/*.test.ts',
      'src/services/**/*.test.ts',
      // Exclude integration tests
      '!src/**/*.integration.test.ts',
      '!src/**/*.worker.test.ts',
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
