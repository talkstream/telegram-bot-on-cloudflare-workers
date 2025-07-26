/**
 * Example: Durable Objects Usage
 *
 * This example demonstrates various Durable Objects patterns including
 * WebSocket rooms, counters, and rate limiting.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  WebSocketRoom,
  Counter,
  NamedCounters,
  RateLimiter,
  AdvancedRateLimiter,
} from '../src/core/services/durable-objects';

// Type definitions for environment bindings
interface Env {
  CHAT_ROOMS: DurableObjectNamespace;
  COUNTERS: DurableObjectNamespace;
  RATE_LIMITER: DurableObjectNamespace;
}

// Export Durable Object classes
export { WebSocketRoom as ChatRoom } from '../src/core/services/durable-objects/websocket-room';
export { Counter } from '../src/core/services/durable-objects/counter';
export { NamedCounters } from '../src/core/services/durable-objects/counter';
export { AdvancedRateLimiter as RateLimiter } from '../src/core/services/durable-objects/rate-limiter';

/**
 * Main worker that routes requests to Durable Objects
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const app = new Hono<{ Bindings: Env }>();

    // Enable CORS for demo
    app.use('*', cors());

    // Home page with examples
    app.get('/', (c) => {
      return c.html(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Durable Objects Examples</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; }
            button { margin: 5px; padding: 10px; }
            #messages { height: 200px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; }
            .message { margin: 5px 0; }
            .system { color: #666; font-style: italic; }
          </style>
        </head>
        <body>
          <h1>Durable Objects Examples</h1>
          
          <div class="section">
            <h2>1. WebSocket Chat Room</h2>
            <input type="text" id="roomName" placeholder="Room name" value="demo">
            <input type="text" id="userName" placeholder="Your name" value="User${Math.floor(Math.random() * 1000)}">
            <button onclick="connectToRoom()">Connect</button>
            <button onclick="disconnect()">Disconnect</button>
            <br><br>
            <input type="text" id="messageInput" placeholder="Type a message...">
            <button onclick="sendMessage()">Send</button>
            <div id="messages"></div>
          </div>
          
          <div class="section">
            <h2>2. Global Counter</h2>
            <button onclick="incrementCounter()">Increment</button>
            <button onclick="decrementCounter()">Decrement</button>
            <button onclick="getCounter()">Get Value</button>
            <button onclick="resetCounter()">Reset</button>
            <div id="counterValue">Value: 0</div>
          </div>
          
          <div class="section">
            <h2>3. Named Counters</h2>
            <input type="text" id="counterName" placeholder="Counter name" value="pageViews">
            <input type="number" id="counterAmount" placeholder="Amount" value="1">
            <button onclick="incrementNamed()">Increment</button>
            <button onclick="getNamedCounter()">Get Value</button>
            <button onclick="getAllCounters()">List All</button>
            <div id="namedCounterValue"></div>
          </div>
          
          <div class="section">
            <h2>4. Rate Limiting</h2>
            <input type="text" id="rateLimitKey" placeholder="Key (e.g., user ID)" value="user123">
            <input type="number" id="rateLimitCount" placeholder="Limit" value="10">
            <input type="number" id="rateLimitWindow" placeholder="Window (ms)" value="60000">
            <br><br>
            <button onclick="checkRateLimit()">Check Limit</button>
            <button onclick="checkSlidingWindow()">Sliding Window</button>
            <button onclick="checkTokenBucket()">Token Bucket</button>
            <div id="rateLimitResult"></div>
          </div>
          
          <script>
            let ws = null;
            
            // WebSocket Chat
            function connectToRoom() {
              const room = document.getElementById('roomName').value;
              const user = document.getElementById('userName').value;
              
              if (ws) ws.close();
              
              ws = new WebSocket(\`wss://\${location.host}/rooms/\${room}/websocket?userId=\${user}\`);
              
              ws.onopen = () => {
                addMessage('Connected to room: ' + room, 'system');
              };
              
              ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
              };
              
              ws.onclose = () => {
                addMessage('Disconnected from room', 'system');
              };
              
              ws.onerror = (error) => {
                addMessage('Connection error: ' + error, 'system');
              };
            }
            
            function disconnect() {
              if (ws) {
                ws.close();
                ws = null;
              }
            }
            
            function sendMessage() {
              const input = document.getElementById('messageInput');
              if (ws && ws.readyState === WebSocket.OPEN && input.value) {
                ws.send(JSON.stringify({
                  type: 'message',
                  payload: input.value
                }));
                input.value = '';
              }
            }
            
            function handleWebSocketMessage(data) {
              switch (data.type) {
                case 'welcome':
                  addMessage('Joined room. Connected users: ' + data.roomState.connectedUsers.length, 'system');
                  break;
                case 'message':
                  addMessage(data.userId + ': ' + data.message);
                  break;
                case 'user_joined':
                  addMessage(data.userId + ' joined the room', 'system');
                  break;
                case 'user_left':
                  addMessage(data.userId + ' left the room', 'system');
                  break;
              }
            }
            
            function addMessage(text, className = '') {
              const messages = document.getElementById('messages');
              const div = document.createElement('div');
              div.className = 'message ' + className;
              div.textContent = text;
              messages.appendChild(div);
              messages.scrollTop = messages.scrollHeight;
            }
            
            // Global Counter
            async function incrementCounter() {
              const res = await fetch('/counters/global/increment', { method: 'POST' });
              const data = await res.json();
              document.getElementById('counterValue').textContent = 'Value: ' + data.value;
            }
            
            async function decrementCounter() {
              const res = await fetch('/counters/global/decrement', { method: 'POST' });
              const data = await res.json();
              document.getElementById('counterValue').textContent = 'Value: ' + data.value;
            }
            
            async function getCounter() {
              const res = await fetch('/counters/global/value');
              const data = await res.json();
              document.getElementById('counterValue').textContent = 'Value: ' + data.value;
            }
            
            async function resetCounter() {
              const res = await fetch('/counters/global/reset', { method: 'DELETE' });
              const data = await res.json();
              document.getElementById('counterValue').textContent = 'Value: ' + data.value;
            }
            
            // Named Counters
            async function incrementNamed() {
              const name = document.getElementById('counterName').value;
              const amount = parseInt(document.getElementById('counterAmount').value);
              const res = await fetch(\`/named-counters/\${name}\`, {
                method: 'POST',
                body: JSON.stringify({ action: 'increment', amount })
              });
              const data = await res.json();
              document.getElementById('namedCounterValue').textContent = \`\${name}: \${data.value}\`;
            }
            
            async function getNamedCounter() {
              const name = document.getElementById('counterName').value;
              const res = await fetch(\`/named-counters/\${name}\`);
              const data = await res.json();
              document.getElementById('namedCounterValue').textContent = \`\${name}: \${data.value}\`;
            }
            
            async function getAllCounters() {
              const res = await fetch('/named-counters/');
              const data = await res.json();
              document.getElementById('namedCounterValue').textContent = 
                'All counters: ' + JSON.stringify(data.counters, null, 2);
            }
            
            // Rate Limiting
            async function checkRateLimit() {
              const key = document.getElementById('rateLimitKey').value;
              const limit = parseInt(document.getElementById('rateLimitCount').value);
              const window = parseInt(document.getElementById('rateLimitWindow').value);
              
              const res = await fetch('/rate-limit/check', {
                method: 'POST',
                body: JSON.stringify({ key, limit, window })
              });
              const data = await res.json();
              
              document.getElementById('rateLimitResult').innerHTML = 
                \`Allowed: \${data.allowed}<br>Count: \${data.count}/\${data.limit}<br>Reset: \${new Date(data.resetAt).toLocaleTimeString()}\`;
            }
            
            async function checkSlidingWindow() {
              const key = document.getElementById('rateLimitKey').value;
              const limit = parseInt(document.getElementById('rateLimitCount').value);
              const window = parseInt(document.getElementById('rateLimitWindow').value);
              
              const res = await fetch('/rate-limit/check/sliding-window', {
                method: 'POST',
                body: JSON.stringify({ key, limit, window })
              });
              const data = await res.json();
              
              document.getElementById('rateLimitResult').innerHTML = 
                \`Sliding Window - Allowed: \${data.allowed}<br>Count: \${data.count}/\${data.limit}\`;
            }
            
            async function checkTokenBucket() {
              const key = document.getElementById('rateLimitKey').value;
              const capacity = parseInt(document.getElementById('rateLimitCount').value);
              
              const res = await fetch('/rate-limit/check/token-bucket', {
                method: 'POST',
                body: JSON.stringify({ key, capacity, refillRate: 1 })
              });
              const data = await res.json();
              
              document.getElementById('rateLimitResult').innerHTML = 
                \`Token Bucket - Allowed: \${data.allowed}<br>Tokens: \${data.tokens}\/\${data.capacity}\`;
            }
            
            // Initial load
            getCounter();
          </script>
        </body>
        </html>
      `);
    });

    // Chat room routes
    app.all('/rooms/:roomId/*', async (c) => {
      const roomId = c.req.param('roomId');
      const id = c.env.CHAT_ROOMS.idFromName(roomId);
      const room = c.env.CHAT_ROOMS.get(id);

      // Create new URL with path after room ID
      const url = new URL(c.req.url);
      const path = url.pathname.replace(`/rooms/${roomId}`, '');
      url.pathname = path;

      return room.fetch(url.toString(), c.req.raw);
    });

    // Global counter routes
    app.all('/counters/global/*', async (c) => {
      const id = c.env.COUNTERS.idFromName('global');
      const counter = c.env.COUNTERS.get(id);

      // Extract path after /counters/global
      const url = new URL(c.req.url);
      url.pathname = url.pathname.replace('/counters/global', '');

      return counter.fetch(url.toString(), c.req.raw);
    });

    // Named counters routes
    app.all('/named-counters/*', async (c) => {
      const id = c.env.COUNTERS.idFromName('named');
      const counters = c.env.COUNTERS.get(id);

      // Extract path after /named-counters
      const url = new URL(c.req.url);
      url.pathname = url.pathname.replace('/named-counters', '');

      return counters.fetch(url.toString(), c.req.raw);
    });

    // Rate limiter routes
    app.all('/rate-limit/*', async (c) => {
      const id = c.env.RATE_LIMITER.idFromName('main');
      const limiter = c.env.RATE_LIMITER.get(id);

      // Extract path after /rate-limit
      const url = new URL(c.req.url);
      url.pathname = url.pathname.replace('/rate-limit', '');

      return limiter.fetch(url.toString(), c.req.raw);
    });

    return app.fetch(request, env);
  },
};

/**
 * Configuration for wrangler.toml:
 *
 * [[durable_objects.bindings]]
 * name = "CHAT_ROOMS"
 * class_name = "ChatRoom"
 *
 * [[durable_objects.bindings]]
 * name = "COUNTERS"
 * class_name = "NamedCounters"
 *
 * [[durable_objects.bindings]]
 * name = "RATE_LIMITER"
 * class_name = "RateLimiter"
 *
 * [[migrations]]
 * tag = "v1"
 * new_classes = ["ChatRoom", "NamedCounters", "RateLimiter"]
 */
