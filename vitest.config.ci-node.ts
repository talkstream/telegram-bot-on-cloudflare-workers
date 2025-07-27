import path from 'path';
import { fileURLToPath } from 'url';

import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./src/__tests__/setup/node-env-mock.ts', './src/__tests__/setup/grammy-mock.ts'],
    exclude: ['eslint-rules/**', 'node_modules/**', 'website/**', '**/node_modules/**'],
    // Use standard node pool instead of workers
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
        maxThreads: 1,
        minThreads: 1,
      },
    },
    // Run tests sequentially
    sequence: {
      shuffle: false,
    },
    // Environment setup
    environment: 'node',
    environmentOptions: {
      // Mock bindings as global variables
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
