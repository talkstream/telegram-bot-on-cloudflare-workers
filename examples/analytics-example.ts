/**
 * Analytics Engine usage example
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AnalyticsFactory, type IAnalyticsService } from '../src/core/services/analytics';
import {
  createAnalyticsTracker,
  trackUserAction,
  createPerformanceTracker,
} from '../src/middleware/analytics-tracker';
import type { EventBus } from '../src/core/events/event-bus';

// Types
interface Env {
  API_METRICS: any; // Analytics Engine dataset binding
}

// Create app
const app = new Hono<{ Bindings: Env }>();

// Enable CORS
app.use('/*', cors());

// Initialize analytics
let analytics: IAnalyticsService;

app.use('*', async (c, next) => {
  if (!analytics) {
    // Configure analytics factory
    AnalyticsFactory.configure({
      provider: process.env.NODE_ENV === 'production' ? 'cloudflare' : 'memory',
      env: c.env,
      datasetName: 'API_METRICS',
      batchOptions: {
        maxBatchSize: 100,
        flushInterval: 5000, // 5 seconds
      },
    });

    analytics = AnalyticsFactory.createAutoDetect();
    c.set('analytics', analytics);
  }

  await next();
});

// Add analytics tracking middleware
app.use('*', async (c, next) => {
  const middleware = createAnalyticsTracker({
    analyticsService: analytics,
    metricsPrefix: 'example',
    excludeRoutes: ['/metrics', '/health'],
    dimensions: {
      environment: () => process.env.NODE_ENV || 'development',
      version: () => '1.0.0',
      region: (ctx) => ctx.req.header('cf-ipcountry') || 'unknown',
    },
    trackResponseTime: true,
    trackRequestSize: true,
    trackResponseSize: true,
    trackErrors: true,
    sampleRate: 1.0, // Track all requests for demo
  });

  return middleware(c, next);
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// Dashboard endpoint
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Analytics Example</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        .metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        .metric-card {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
          background: #f9f9f9;
        }
        .metric-value {
          font-size: 2em;
          font-weight: bold;
          color: #333;
        }
        .chart {
          height: 200px;
          margin-top: 10px;
          border: 1px solid #eee;
          display: flex;
          align-items: flex-end;
          gap: 2px;
          padding: 10px;
        }
        .bar {
          flex: 1;
          background: #4CAF50;
          min-height: 5px;
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
        .actions {
          margin: 20px 0;
        }
        .log {
          margin-top: 20px;
          padding: 10px;
          background: #f0f0f0;
          border-radius: 4px;
          max-height: 200px;
          overflow-y: auto;
        }
      </style>
    </head>
    <body>
      <h1>Analytics Engine Example</h1>
      
      <div class="actions">
        <button onclick="simulateTraffic()">Simulate Traffic</button>
        <button onclick="trackAction('button_click')">Track Click</button>
        <button onclick="trackAction('form_submit')">Track Submit</button>
        <button onclick="simulateError()">Simulate Error</button>
        <button onclick="refreshMetrics()">Refresh Metrics</button>
      </div>

      <div class="metrics" id="metrics">
        <div class="metric-card">
          <h3>Total Requests</h3>
          <div class="metric-value" id="total-requests">-</div>
        </div>
        
        <div class="metric-card">
          <h3>Average Response Time</h3>
          <div class="metric-value" id="avg-response-time">-</div>
        </div>
        
        <div class="metric-card">
          <h3>Error Rate</h3>
          <div class="metric-value" id="error-rate">-</div>
        </div>
        
        <div class="metric-card">
          <h3>User Actions</h3>
          <div class="metric-value" id="user-actions">-</div>
        </div>
      </div>

      <div class="metric-card">
        <h3>Requests Over Time</h3>
        <div class="chart" id="requests-chart"></div>
      </div>

      <div class="log" id="log">
        <strong>Activity Log:</strong><br>
      </div>

      <script>
        const log = (message) => {
          const logEl = document.getElementById('log');
          logEl.innerHTML += new Date().toLocaleTimeString() + ' - ' + message + '<br>';
          logEl.scrollTop = logEl.scrollHeight;
        };

        async function simulateTraffic() {
          log('Simulating traffic...');
          const endpoints = ['/api/users', '/api/products', '/api/orders'];
          const methods = ['GET', 'POST', 'PUT', 'DELETE'];
          
          for (let i = 0; i < 20; i++) {
            const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
            const method = methods[Math.floor(Math.random() * methods.length)];
            
            fetch(endpoint, { method })
              .then(() => log('Request to ' + method + ' ' + endpoint))
              .catch(() => log('Failed request to ' + method + ' ' + endpoint));
            
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        async function trackAction(action) {
          log('Tracking action: ' + action);
          const response = await fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
          });
          
          if (response.ok) {
            log('Action tracked successfully');
          }
        }

        async function simulateError() {
          log('Simulating error...');
          try {
            await fetch('/api/error');
          } catch (e) {
            log('Error simulated');
          }
        }

        async function refreshMetrics() {
          log('Refreshing metrics...');
          
          try {
            const response = await fetch('/api/metrics/summary');
            const data = await response.json();
            
            document.getElementById('total-requests').textContent = 
              data.totalRequests.toLocaleString();
            document.getElementById('avg-response-time').textContent = 
              data.avgResponseTime.toFixed(2) + ' ms';
            document.getElementById('error-rate').textContent = 
              data.errorRate.toFixed(2) + '%';
            document.getElementById('user-actions').textContent = 
              data.userActions.toLocaleString();
            
            // Update chart
            const chart = document.getElementById('requests-chart');
            chart.innerHTML = '';
            
            if (data.requestsOverTime && data.requestsOverTime.length > 0) {
              const maxValue = Math.max(...data.requestsOverTime.map(d => d.value));
              
              data.requestsOverTime.forEach(dataPoint => {
                const bar = document.createElement('div');
                bar.className = 'bar';
                bar.style.height = ((dataPoint.value / maxValue) * 180) + 'px';
                bar.title = dataPoint.value + ' requests at ' + 
                  new Date(dataPoint.timestamp).toLocaleTimeString();
                chart.appendChild(bar);
              });
            }
            
            log('Metrics refreshed');
          } catch (error) {
            log('Failed to refresh metrics: ' + error.message);
          }
        }

        // Auto-refresh every 5 seconds
        setInterval(refreshMetrics, 5000);
        
        // Initial load
        refreshMetrics();
      </script>
    </body>
    </html>
  `);
});

// API endpoints for demo
app.all('/api/*', async (c) => {
  // Simulate some processing time
  const processingTime = Math.random() * 200 + 50;
  await new Promise((resolve) => setTimeout(resolve, processingTime));

  // Random chance of error
  if (Math.random() < 0.1) {
    c.status(500);
    return c.json({ error: 'Internal server error' });
  }

  return c.json({
    message: 'Success',
    path: c.req.path,
    method: c.req.method,
    timestamp: Date.now(),
  });
});

// Track custom actions
app.post('/api/track', async (c) => {
  const { action } = await c.req.json();
  const analytics = c.get('analytics') as IAnalyticsService;

  await trackUserAction(analytics, action, 1, {
    userId: 'demo-user',
    sessionId: c.req.header('x-session-id') || 'unknown',
  });

  return c.json({ success: true });
});

// Metrics summary endpoint
app.get('/api/metrics/summary', async (c) => {
  const analytics = c.get('analytics') as IAnalyticsService;
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);
  const fiveMinutesAgo = new Date(now.getTime() - 300000);

  try {
    // Get total requests
    const requestsResult = await analytics.query({
      startTime: oneHourAgo,
      endTime: now,
      metrics: ['example.request_count'],
      aggregation: 'sum',
    });

    const totalRequests = requestsResult.data.reduce(
      (sum, d) => sum + (d.values['example.request_count'] || 0),
      0,
    );

    // Get average response time
    const responseTimeResult = await analytics.query({
      startTime: oneHourAgo,
      endTime: now,
      metrics: ['example.response_time'],
      aggregation: 'avg',
    });

    const avgResponseTime =
      responseTimeResult.data.length > 0
        ? responseTimeResult.data[0].values['example.response_time'] || 0
        : 0;

    // Get error rate
    const errorResult = await analytics.query({
      startTime: oneHourAgo,
      endTime: now,
      metrics: ['example.error_count'],
      aggregation: 'sum',
    });

    const totalErrors = errorResult.data.reduce(
      (sum, d) => sum + (d.values['example.error_count'] || 0),
      0,
    );

    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    // Get user actions
    const actionsResult = await analytics.query({
      startTime: oneHourAgo,
      endTime: now,
      metrics: ['user.action.button_click', 'user.action.form_submit'],
      aggregation: 'sum',
    });

    const userActions = actionsResult.data.reduce(
      (sum, d) =>
        sum +
        (d.values['user.action.button_click'] || 0) +
        (d.values['user.action.form_submit'] || 0),
      0,
    );

    // Get requests over time (last 5 minutes, by minute)
    const timeSeriesResult = await analytics.query({
      startTime: fiveMinutesAgo,
      endTime: now,
      metrics: ['example.request_count'],
      granularity: 'minute',
      aggregation: 'sum',
    });

    const requestsOverTime = timeSeriesResult.data.map((d) => ({
      timestamp: d.timestamp,
      value: d.values['example.request_count'] || 0,
    }));

    return c.json({
      totalRequests,
      avgResponseTime,
      errorRate,
      userActions,
      requestsOverTime,
    });
  } catch (error) {
    console.error('Failed to query metrics:', error);

    // Return mock data for demo
    return c.json({
      totalRequests: Math.floor(Math.random() * 1000),
      avgResponseTime: Math.random() * 200 + 50,
      errorRate: Math.random() * 10,
      userActions: Math.floor(Math.random() * 100),
      requestsOverTime: Array.from({ length: 5 }, (_, i) => ({
        timestamp: Date.now() - (4 - i) * 60000,
        value: Math.floor(Math.random() * 50),
      })),
    });
  }
});

// Error simulation endpoint
app.get('/api/error', async (c) => {
  const tracker = createPerformanceTracker(
    c.get('analytics') as IAnalyticsService,
    'simulated_operation',
  );

  try {
    throw new Error('Simulated error for testing');
  } catch (error) {
    await tracker.fail(error as Error, { type: 'simulation' });
    c.status(500);
    return c.json({ error: 'Simulated error' });
  }
});

// Export handlers for Cloudflare Workers
export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Env) => {
    // Flush any pending analytics data
    const analytics = AnalyticsFactory.getAnalyticsService('cloudflare', {
      env,
      datasetName: 'API_METRICS',
    });

    await analytics.flush();
    console.log('Analytics flushed on schedule');
  },
};

// For local development
if (process.env.NODE_ENV !== 'production') {
  const port = 3004;
  console.log(`Analytics example server running at http://localhost:${port}`);
  console.log('');
  console.log('Try these actions:');
  console.log('- Click "Simulate Traffic" to generate API requests');
  console.log('- Click tracking buttons to record user actions');
  console.log('- Click "Simulate Error" to see error tracking');
  console.log('- Metrics refresh automatically every 5 seconds');
}
