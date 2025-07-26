import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { edgeCache, cacheInvalidator, warmupCache } from '../src/middleware/edge-cache';
import { EdgeCacheService } from '../src/core/services/cache/edge-cache-service';
import { generateCacheKey } from '../src/core/services/cache/edge-cache-service';

/**
 * Example: Edge Cache Service Usage
 *
 * This example demonstrates how to use the Edge Cache Service
 * to improve performance of your Cloudflare Workers application.
 */

// Initialize cache service with custom configuration
const cacheService = new EdgeCacheService({
  baseUrl: 'https://cache.myapp.internal',
  logger: console, // Use console for demo
});

// Create Hono app
const app = new Hono();

// Apply edge cache middleware globally
app.use(
  '*',
  edgeCache({
    cacheService,
    routeConfig: {
      // Static content - cache for 24 hours
      '/api/config': { ttl: 86400, tags: ['config', 'static'] },
      '/api/regions': { ttl: 86400, tags: ['regions', 'static'] },

      // Dynamic content - cache for 5 minutes
      '/api/users': { ttl: 300, tags: ['users'] },
      '/api/posts': { ttl: 300, tags: ['posts'] },

      // Real-time data - cache for 1 minute
      '/api/stats': { ttl: 60, tags: ['stats', 'realtime'] },

      // No cache
      '/api/auth': { ttl: 0, tags: [] },
      '/webhooks': { ttl: 0, tags: [] },
    },

    // Custom cache key generator for query parameters
    keyGenerator: (c) => {
      const url = new URL(c.req.url);
      const params: Record<string, string> = {};

      // Extract and sort query parameters
      url.searchParams.forEach((value, key) => {
        params[key] = value;
      });

      return generateCacheKey(url.pathname, params);
    },

    debug: true, // Enable debug logging
  }),
);

// Example API endpoints
app.get('/api/config', async (c) => {
  console.log('Fetching config from database...');
  // Simulate database query
  await new Promise((resolve) => setTimeout(resolve, 100));

  return c.json({
    app: 'Edge Cache Example',
    version: '1.0.0',
    features: ['caching', 'performance', 'scalability'],
  });
});

app.get('/api/users', async (c) => {
  const page = c.req.query('page') || '1';
  const limit = c.req.query('limit') || '10';

  console.log(`Fetching users page ${page} with limit ${limit}...`);
  // Simulate database query
  await new Promise((resolve) => setTimeout(resolve, 50));

  const users = Array.from({ length: parseInt(limit) }, (_, i) => ({
    id: (parseInt(page) - 1) * parseInt(limit) + i + 1,
    name: `User ${(parseInt(page) - 1) * parseInt(limit) + i + 1}`,
    email: `user${(parseInt(page) - 1) * parseInt(limit) + i + 1}@example.com`,
  }));

  return c.json({
    page: parseInt(page),
    limit: parseInt(limit),
    total: 100,
    data: users,
  });
});

app.get('/api/posts/:id', async (c) => {
  const id = c.req.param('id');

  console.log(`Fetching post ${id}...`);
  // Simulate database query
  await new Promise((resolve) => setTimeout(resolve, 30));

  return c.json({
    id: parseInt(id),
    title: `Post ${id}`,
    content: `This is the content of post ${id}`,
    author: `User ${Math.floor(Math.random() * 10) + 1}`,
    createdAt: new Date().toISOString(),
  });
});

app.get('/api/stats', async (c) => {
  console.log('Calculating real-time statistics...');
  // Simulate real-time calculation
  await new Promise((resolve) => setTimeout(resolve, 20));

  return c.json({
    activeUsers: Math.floor(Math.random() * 1000) + 500,
    totalPosts: Math.floor(Math.random() * 10000) + 5000,
    serverTime: new Date().toISOString(),
  });
});

// Cache management endpoints
app.post('/cache/invalidate', cacheInvalidator(cacheService));

app.get('/cache/warmup', async (c) => {
  console.log('Starting cache warmup...');

  // Warm up frequently accessed data
  await warmupCache(cacheService, [
    {
      key: '/api/config',
      factory: async () => {
        console.log('Warming up config...');
        return {
          app: 'Edge Cache Example',
          version: '1.0.0',
          features: ['caching', 'performance', 'scalability'],
        };
      },
      options: { ttl: 86400, tags: ['config', 'static'] },
    },
    {
      key: generateCacheKey('/api/users', { page: '1', limit: '10' }),
      factory: async () => {
        console.log('Warming up first page of users...');
        return {
          page: 1,
          limit: 10,
          total: 100,
          data: Array.from({ length: 10 }, (_, i) => ({
            id: i + 1,
            name: `User ${i + 1}`,
            email: `user${i + 1}@example.com`,
          })),
        };
      },
      options: { ttl: 300, tags: ['users'] },
    },
  ]);

  return c.json({ success: true, message: 'Cache warmup completed' });
});

// Performance monitoring endpoint
app.get('/cache/stats', async (c) => {
  // In a real application, you would track cache hit/miss rates
  return c.json({
    message: 'Cache statistics',
    tips: [
      'Check X-Cache-Status header for HIT/MISS',
      'Use browser developer tools to see cache headers',
      'Monitor Cloudflare dashboard for cache analytics',
    ],
  });
});

// Export for Cloudflare Workers
export default app;

// For local development with Node.js
if (process.env.NODE_ENV !== 'production') {
  const port = 3000;
  console.log(`
🚀 Edge Cache Example Server
   Running at http://localhost:${port}

📝 Try these endpoints:
   - GET  /api/config         (24h cache)
   - GET  /api/users?page=1   (5min cache)
   - GET  /api/posts/123      (5min cache)
   - GET  /api/stats          (1min cache)
   
🔧 Cache management:
   - POST /cache/invalidate   (Clear cache by tags or keys)
   - GET  /cache/warmup       (Pre-populate cache)
   - GET  /cache/stats        (View cache statistics)

💡 Tips:
   - Check X-Cache-Status header in responses
   - First request will show MISS, subsequent will show HIT
   - Use tags to invalidate related cache entries
  `);

  serve({
    fetch: app.fetch,
    port,
  });
}
