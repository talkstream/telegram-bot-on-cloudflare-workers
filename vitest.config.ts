import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare', // Use Miniflare for a Cloudflare Workers-like environment
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
