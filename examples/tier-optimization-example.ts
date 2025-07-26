/**
 * Tier optimization example
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  createTierOptimizer,
  getOptimizationService,
  optimizedCache,
  optimizedBatch,
  createTieredResponse,
} from '../src/middleware/tier-optimizer';
import { EdgeCacheService } from '../src/core/services/edge-cache';
import { EventBus } from '../src/core/events/event-bus';
import type { CloudflareTier } from '../src/core/interfaces/tier-optimization';

// Types
interface User {
  id: number;
  name: string;
  email: string;
  profile: {
    bio: string;
    avatar: string;
    social: Record<string, string>;
  };
  stats: {
    posts: number;
    followers: number;
    following: number;
  };
}

// Create app
const app = new Hono();

// Enable CORS
app.use('/*', cors());

// Initialize services
const cacheService = new EdgeCacheService({ provider: 'memory' });
const eventBus = new EventBus();

// Add tier optimization middleware
app.use(
  '*',
  createTierOptimizer({
    cacheService,
    eventBus,
    debug: true, // Enable debug headers
    excludeRoutes: ['/health'],
    config: {
      cache: {
        enabled: true,
        ttl: 300,
        swr: 3600,
      },
      batching: {
        enabled: true,
        size: 10,
        timeout: 100,
      },
    },
  }),
);

// Health check (excluded from optimization)
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// Home page with tier info
app.get('/', (c) => {
  const optimizer = getOptimizationService(c);
  const tier = optimizer?.getCurrentTier() || 'unknown';
  const limits = optimizer?.getTierLimits();
  const usage = optimizer?.getUsage();
  const recommendations = optimizer?.getRecommendations() || [];

  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Tier Optimization Example</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        .tier-info {
          background: #f0f0f0;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .tier-badge {
          display: inline-block;
          padding: 5px 15px;
          border-radius: 20px;
          font-weight: bold;
          color: white;
        }
        .tier-free { background: #666; }
        .tier-paid { background: #2196F3; }
        .tier-enterprise { background: #4CAF50; }
        .metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin: 20px 0;
        }
        .metric {
          background: white;
          border: 1px solid #ddd;
          padding: 15px;
          border-radius: 4px;
        }
        .metric-value {
          font-size: 24px;
          font-weight: bold;
          margin: 5px 0;
        }
        .progress {
          height: 10px;
          background: #eee;
          border-radius: 5px;
          overflow: hidden;
          margin-top: 5px;
        }
        .progress-bar {
          height: 100%;
          background: #2196F3;
          transition: width 0.3s;
        }
        .progress-bar.warning { background: #ff9800; }
        .progress-bar.danger { background: #f44336; }
        .recommendations {
          margin: 20px 0;
        }
        .recommendation {
          padding: 10px;
          margin: 10px 0;
          border-left: 4px solid #2196F3;
          background: #f9f9f9;
        }
        .recommendation.critical { border-color: #f44336; }
        .recommendation.warning { border-color: #ff9800; }
        .actions {
          margin: 20px 0;
        }
        button {
          padding: 10px 20px;
          margin: 5px;
          border: none;
          border-radius: 4px;
          background: #2196F3;
          color: white;
          cursor: pointer;
        }
        button:hover {
          background: #1976D2;
        }
        .results {
          margin: 20px 0;
          padding: 15px;
          background: #f5f5f5;
          border-radius: 4px;
        }
        pre {
          background: #333;
          color: #fff;
          padding: 10px;
          border-radius: 4px;
          overflow-x: auto;
        }
      </style>
    </head>
    <body>
      <h1>Tier Optimization Example</h1>
      
      <div class="tier-info">
        <h2>Current Tier: <span class="tier-badge tier-${tier}">${tier.toUpperCase()}</span></h2>
        
        <div class="metrics">
          <div class="metric">
            <div>CPU Time</div>
            <div class="metric-value">${usage?.cpuTime || 0}ms / ${limits?.cpuTime}ms</div>
            <div class="progress">
              <div class="progress-bar ${getCpuClass(usage?.cpuTime, limits?.cpuTime)}" 
                   style="width: ${getPercent(usage?.cpuTime, limits?.cpuTime)}%"></div>
            </div>
          </div>
          
          <div class="metric">
            <div>Memory</div>
            <div class="metric-value">${(usage?.memory || 0).toFixed(1)}MB / ${limits?.memory}MB</div>
            <div class="progress">
              <div class="progress-bar ${getMemoryClass(usage?.memory, limits?.memory)}" 
                   style="width: ${getPercent(usage?.memory, limits?.memory)}%"></div>
            </div>
          </div>
          
          <div class="metric">
            <div>Subrequests</div>
            <div class="metric-value">${usage?.subrequests || 0} / ${limits?.subrequests}</div>
            <div class="progress">
              <div class="progress-bar" 
                   style="width: ${getPercent(usage?.subrequests, limits?.subrequests)}%"></div>
            </div>
          </div>
          
          <div class="metric">
            <div>KV Reads</div>
            <div class="metric-value">${usage?.kvOperations.read || 0} / ${limits?.kvOperations.read}</div>
            <div class="progress">
              <div class="progress-bar" 
                   style="width: ${getPercent(usage?.kvOperations.read, limits?.kvOperations.read)}%"></div>
            </div>
          </div>
        </div>
      </div>

      ${
        recommendations.length > 0
          ? `
        <div class="recommendations">
          <h3>Optimization Recommendations</h3>
          ${recommendations
            .map(
              (rec) => `
            <div class="recommendation ${rec.type}">
              <strong>${rec.message}</strong>
              ${rec.description ? `<p>${rec.description}</p>` : ''}
              ${rec.action ? `<p><em>Action: ${rec.action}</em></p>` : ''}
            </div>
          `,
            )
            .join('')}
        </div>
      `
          : ''
      }

      <div class="actions">
        <h3>Test Different Operations</h3>
        <button onclick="testSimpleOperation()">Simple Operation</button>
        <button onclick="testComplexOperation()">Complex Operation</button>
        <button onclick="testBatchOperation()">Batch Operation</button>
        <button onclick="testCachedOperation()">Cached Operation</button>
        <button onclick="simulateFreeeTier()">Simulate Free Tier</button>
        <button onclick="simulatePaidTier()">Simulate Paid Tier</button>
      </div>

      <div id="results" class="results" style="display: none;">
        <h3>Operation Results</h3>
        <pre id="result-content"></pre>
      </div>

      <script>
        function getCpuClass(used, limit) {
          const percent = (used / limit) * 100;
          if (percent > 80) return 'danger';
          if (percent > 60) return 'warning';
          return '';
        }

        function getMemoryClass(used, limit) {
          const percent = (used / limit) * 100;
          if (percent > 80) return 'danger';
          if (percent > 60) return 'warning';
          return '';
        }

        function getPercent(used, limit) {
          if (!used || !limit) return 0;
          return Math.min(100, (used / limit) * 100);
        }

        async function showResult(response) {
          const data = await response.json();
          document.getElementById('results').style.display = 'block';
          document.getElementById('result-content').textContent = JSON.stringify(data, null, 2);
          
          // Refresh page after 2 seconds to show updated metrics
          setTimeout(() => location.reload(), 2000);
        }

        async function testSimpleOperation() {
          const response = await fetch('/api/simple');
          await showResult(response);
        }

        async function testComplexOperation() {
          const response = await fetch('/api/complex');
          await showResult(response);
        }

        async function testBatchOperation() {
          const response = await fetch('/api/batch');
          await showResult(response);
        }

        async function testCachedOperation() {
          const response = await fetch('/api/cached');
          await showResult(response);
        }

        async function simulateFreeeTier() {
          await fetch('/api/simulate-tier/free', { method: 'POST' });
          location.reload();
        }

        async function simulatePaidTier() {
          await fetch('/api/simulate-tier/paid', { method: 'POST' });
          location.reload();
        }
      </script>
    </body>
    </html>
  `);
});

// Simple operation
app.get('/api/simple', async (c) => {
  const optimizer = getOptimizationService(c);

  // Simulate some work
  const start = Date.now();
  const data = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    value: Math.random(),
  }));
  const cpuTime = Date.now() - start;

  optimizer?.trackUsage('cpuTime', cpuTime);

  return c.json({
    operation: 'simple',
    tier: optimizer?.getCurrentTier(),
    cpuTime,
    dataCount: data.length,
    data,
  });
});

// Complex operation
app.get('/api/complex', async (c) => {
  const optimizer = getOptimizationService(c);

  // Simulate complex work
  const start = Date.now();
  const users = generateUsers(100);

  // Enrich users (simulated subrequests)
  const enriched = await optimizedBatch(c, users, async (batch) => {
    optimizer?.trackUsage('subrequests', batch.length);

    // Simulate API calls
    return batch.map((user) => ({
      ...user,
      enriched: true,
      processed: Date.now(),
    }));
  });

  const cpuTime = Date.now() - start;
  optimizer?.trackUsage('cpuTime', cpuTime);

  // Return tiered response
  return createTieredResponse(c, enriched, {
    fullDataTiers: ['paid', 'enterprise'],
    summaryFields: ['id', 'name', 'email'],
  });
});

// Batch operation
app.get('/api/batch', async (c) => {
  const optimizer = getOptimizationService(c);

  // Generate items
  const items = Array.from({ length: 50 }, (_, i) => ({ id: i, data: `item-${i}` }));

  // Process in batches
  const results = await optimizedBatch(c, items, async (batch) => {
    // Simulate processing
    optimizer?.trackOperation('kv', 'read', batch.length);

    return batch.map((item) => ({
      ...item,
      processed: true,
      timestamp: Date.now(),
    }));
  });

  return c.json({
    operation: 'batch',
    tier: optimizer?.getCurrentTier(),
    itemCount: items.length,
    batchCount: Math.ceil(items.length / 10),
    results: results.slice(0, 10), // Return sample
  });
});

// Cached operation
app.get('/api/cached', async (c) => {
  const optimizer = getOptimizationService(c);

  // Use optimized cache
  const data = await optimizedCache(
    c,
    'expensive-data',
    async () => {
      // Simulate expensive operation
      optimizer?.trackUsage('cpuTime', 5);
      optimizer?.trackOperation('d1', 'read', 10);

      return {
        timestamp: Date.now(),
        data: generateUsers(20),
        expensive: true,
      };
    },
    { ttl: 300 },
  );

  return c.json({
    operation: 'cached',
    tier: optimizer?.getCurrentTier(),
    cached: data.timestamp !== Date.now(),
    data,
  });
});

// Simulate different tiers
app.post('/api/simulate-tier/:tier', (c) => {
  const tier = c.req.param('tier') as CloudflareTier;

  // In real app, this would be detected automatically
  // This is just for demo purposes
  c.set('simulatedTier', tier);

  return c.json({
    message: `Simulating ${tier} tier`,
    note: 'Refresh page to see changes',
  });
});

// Helper functions
function generateUsers(count: number): User[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    profile: {
      bio: `Bio for user ${i + 1}`,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
      social: {
        twitter: `@user${i + 1}`,
        github: `user${i + 1}`,
      },
    },
    stats: {
      posts: Math.floor(Math.random() * 100),
      followers: Math.floor(Math.random() * 1000),
      following: Math.floor(Math.random() * 500),
    },
  }));
}

// Monitor optimization events
eventBus.on('optimization:applied', (event) => {
  console.log('Optimization applied:', event.payload);
});

eventBus.on('optimization:error', (event) => {
  console.error('Optimization error:', event.payload);
});

// Export for Cloudflare Workers
export default app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  const port = 3005;
  console.log(`Tier optimization example running at http://localhost:${port}`);
  console.log('');
  console.log('This example demonstrates:');
  console.log('- Automatic tier detection and optimization');
  console.log('- Resource usage tracking and limits');
  console.log('- Different optimization strategies');
  console.log('- Tiered responses based on plan');
  console.log('');
  console.log('Try different operations to see how optimizations work!');
}
