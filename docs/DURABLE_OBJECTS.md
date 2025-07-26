# Durable Objects Pattern

Durable Objects provide a way to coordinate state and real-time features at the edge. They offer strong consistency guarantees and are perfect for building collaborative applications, game servers, and distributed systems.

## Features

- **Strong Consistency** - Single-threaded JavaScript execution with transactional storage
- **Global Uniqueness** - Each object has a globally unique ID
- **WebSocket Support** - Built-in support for real-time connections
- **Automatic Scaling** - Objects are created on-demand and hibernate when idle
- **Edge Location** - Run close to users for low latency

## Quick Start

### Basic Durable Object

```typescript
import { BaseDurableObject } from '@/core/services/durable-objects/base-durable-object';

export class MyDurableObject extends BaseDurableObject {
  private counter = 0;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/increment':
        this.counter++;
        await this.put('counter', this.counter);
        return this.json({ counter: this.counter });

      case '/value':
        return this.json({ counter: this.counter });

      default:
        return this.error('Not found', 404);
    }
  }

  protected async onInitialize(): Promise<void> {
    // Load state on startup
    const saved = await this.get<number>('counter');
    if (saved !== undefined) {
      this.counter = saved;
    }
  }
}
```

### Using Durable Objects

```typescript
// In your worker
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Get or create a Durable Object instance
    const id = env.MY_DURABLE_OBJECT.idFromName('singleton');
    const stub = env.MY_DURABLE_OBJECT.get(id);

    // Forward the request to the Durable Object
    return stub.fetch(request);
  },
};
```

## Built-in Patterns

### 1. WebSocket Room

Perfect for chat rooms, collaborative editing, and real-time games:

```typescript
import { WebSocketRoom } from '@/core/services/durable-objects/websocket-room';

// In your worker
const roomId = env.ROOMS.idFromName(roomName);
const room = env.ROOMS.get(roomId);

// Client connects via WebSocket
const response = await room.fetch(request);
```

Client-side connection:

```javascript
const ws = new WebSocket('wss://your-worker.workers.dev/room?userId=user123');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

ws.send(
  JSON.stringify({
    type: 'message',
    payload: 'Hello, room!',
  }),
);
```

### 2. Distributed Counter

Atomic counting across the globe:

```typescript
import { Counter } from '@/core/services/durable-objects/counter';

// Get counter instance
const counterId = env.COUNTERS.idFromName('page-views');
const counter = env.COUNTERS.get(counterId);

// Increment
const response = await counter.fetch(new Request('https://internal/increment', { method: 'POST' }));
const { value } = await response.json();
```

### 3. Rate Limiter

Accurate rate limiting with multiple algorithms:

```typescript
import { RateLimiter } from '@/core/services/durable-objects/rate-limiter';

// Check rate limit
const limiterId = env.RATE_LIMITER.idFromName('api-limiter');
const limiter = env.RATE_LIMITER.get(limiterId);

const response = await limiter.fetch(
  new Request('https://internal/check', {
    method: 'POST',
    body: JSON.stringify({
      key: `user:${userId}`,
      limit: 100, // 100 requests
      window: 3600000, // per hour (in ms)
    }),
  }),
);

const { allowed, count, resetAt } = await response.json();
```

### 4. Advanced Rate Limiting

The advanced rate limiter supports multiple algorithms:

```typescript
// Sliding window
const response = await limiter.fetch(
  new Request('https://internal/check/sliding-window', {
    method: 'POST',
    body: JSON.stringify({
      key: userId,
      limit: 100,
      window: 3600000,
    }),
  }),
);

// Token bucket
const response = await limiter.fetch(
  new Request('https://internal/check/token-bucket', {
    method: 'POST',
    body: JSON.stringify({
      key: userId,
      capacity: 100, // Max tokens
      refillRate: 10, // Tokens per second
      tokens: 1, // Tokens to consume
    }),
  }),
);

// Leaky bucket
const response = await limiter.fetch(
  new Request('https://internal/check/leaky-bucket', {
    method: 'POST',
    body: JSON.stringify({
      key: userId,
      capacity: 100, // Max bucket size
      leakRate: 10, // Leak per second
    }),
  }),
);
```

## Creating Custom Durable Objects

### Step 1: Define Your Object

```typescript
import { BaseDurableObject } from '@/core/services/durable-objects/base-durable-object';

export class GameServer extends BaseDurableObject {
  private players = new Map<string, Player>();
  private gameState: GameState = { status: 'waiting' };

  async fetch(request: Request): Promise<Response> {
    await this.initialize();

    const url = new URL(request.url);
    const playerId = url.searchParams.get('playerId');

    switch (url.pathname) {
      case '/join':
        return this.handleJoin(playerId!);

      case '/move':
        return this.handleMove(playerId!, await request.json());

      case '/state':
        return this.json(this.gameState);

      default:
        return this.error('Not found', 404);
    }
  }

  protected async onInitialize(): Promise<void> {
    // Load game state
    const saved = await this.get<GameState>('gameState');
    if (saved) {
      this.gameState = saved;
    }
  }

  private async handleJoin(playerId: string): Promise<Response> {
    if (this.players.size >= 4) {
      return this.error('Game is full', 400);
    }

    this.players.set(playerId, { id: playerId, score: 0 });
    await this.saveState();

    return this.success({ joined: true, players: this.players.size });
  }

  private async saveState(): Promise<void> {
    await this.put('gameState', this.gameState);
    await this.put('players', Array.from(this.players.entries()));
  }
}
```

### Step 2: Configure in wrangler.toml

```toml
[[durable_objects.bindings]]
name = "GAME_SERVERS"
class_name = "GameServer"

[[migrations]]
tag = "v1"
new_classes = ["GameServer"]
```

### Step 3: Export from Worker

```typescript
export { GameServer } from './game-server';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/game/')) {
      const gameId = url.pathname.split('/')[2];
      const id = env.GAME_SERVERS.idFromName(gameId);
      const game = env.GAME_SERVERS.get(id);

      // Remove /game/{id} prefix
      const newUrl = new URL(request.url);
      newUrl.pathname = url.pathname.slice(`/game/${gameId}`.length);

      return game.fetch(newUrl.toString(), request);
    }

    return new Response('Not found', { status: 404 });
  },
};
```

## Storage Operations

### Basic Storage

```typescript
// Single value
await this.put('key', value);
const value = await this.get('key');
await this.delete('key');

// Multiple values
await this.put({ key1: value1, key2: value2 });
const values = await this.get(['key1', 'key2']); // Returns Map
await this.delete(['key1', 'key2']);

// List with options
const items = await this.list({
  prefix: 'user:',
  limit: 100,
  reverse: true,
});
```

### Transactions

```typescript
await this.state.storage.transaction(async (txn) => {
  const balance = (await txn.get<number>('balance')) || 0;

  if (balance < amount) {
    throw new Error('Insufficient funds');
  }

  await txn.put('balance', balance - amount);
  await txn.put(`transaction:${Date.now()}`, { amount, type: 'debit' });
});
```

### Concurrency Control

```typescript
// Ensure atomic operations
await this.blockConcurrencyWhile(async () => {
  const current = (await this.get('counter')) || 0;
  await this.put('counter', current + 1);
});
```

## WebSocket Handling

### Server-side WebSocket Room

```typescript
export class ChatRoom extends WebSocketRoom {
  protected async onInitialize(): Promise<void> {
    await super.onInitialize();
    // Custom initialization
  }

  async handleMessage(ws: WebSocket, message: string): Promise<void> {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'chat':
        // Broadcast to all users
        await this.broadcast({
          type: 'chat',
          userId: this.findUserIdByWebSocket(ws),
          message: data.message,
          timestamp: Date.now(),
        });
        break;
    }
  }
}
```

### Client-side Connection

```typescript
class ChatClient {
  private ws: WebSocket;

  connect(roomId: string, userId: string) {
    this.ws = new WebSocket(`wss://your-worker.workers.dev/rooms/${roomId}?userId=${userId}`);

    this.ws.onopen = () => {
      console.log('Connected to room');
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onclose = (event) => {
      console.log('Disconnected:', event.code, event.reason);
    };
  }

  sendMessage(text: string) {
    this.ws.send(
      JSON.stringify({
        type: 'chat',
        message: text,
      }),
    );
  }

  handleMessage(data: any) {
    switch (data.type) {
      case 'welcome':
        console.log('Joined room:', data.roomState);
        break;

      case 'chat':
        console.log(`${data.userId}: ${data.message}`);
        break;

      case 'user_joined':
        console.log(`${data.userId} joined the room`);
        break;

      case 'user_left':
        console.log(`${data.userId} left the room`);
        break;
    }
  }
}
```

## Best Practices

### 1. State Management

- Keep in-memory state minimal
- Persist important data immediately
- Use transactions for atomic operations
- Clean up old data periodically

```typescript
protected async onInitialize(): Promise<void> {
  // Load only essential state
  this.criticalData = await this.get('critical');

  // Lazy load other data as needed
}

private async saveImportantData(): Promise<void> {
  // Save immediately after important changes
  await this.put('critical', this.criticalData);
}
```

### 2. Error Handling

```typescript
async fetch(request: Request): Promise<Response> {
  try {
    await this.initialize();
    return await this.handleRequest(request);
  } catch (error) {
    console.error('Durable Object error:', error);
    return this.error('Internal error', 500);
  }
}
```

### 3. Performance

- Batch operations when possible
- Use appropriate storage options
- Implement cleanup strategies
- Monitor object lifetime

```typescript
// Batch updates
await this.state.storage.put({
  'user:1': userData1,
  'user:2': userData2,
  'user:3': userData3,
});

// Cleanup old data
const old = await this.list({
  prefix: 'temp:',
  end: `temp:${Date.now() - 86400000}`, // 24 hours ago
});
await this.delete(Array.from(old.keys()));
```

### 4. Testing

Use the SimpleState implementation for testing:

```typescript
import { SimpleState } from '@/core/services/durable-objects/base-durable-object';

describe('MyDurableObject', () => {
  let obj: MyDurableObject;
  let state: SimpleState;

  beforeEach(() => {
    state = new SimpleState();
    obj = new MyDurableObject(state, {});
  });

  it('should handle requests', async () => {
    const response = await obj.fetch(new Request('http://test/action'));
    expect(response.status).toBe(200);
  });
});
```

## Common Patterns

### Leader Election

```typescript
export class LeaderElection extends BaseDurableObject {
  private leaderId?: string;
  private leaderExpiry?: number;

  async claimLeadership(nodeId: string, ttl: number): Promise<boolean> {
    return this.blockConcurrencyWhile(async () => {
      const now = Date.now();

      if (!this.leaderId || this.leaderExpiry! < now) {
        this.leaderId = nodeId;
        this.leaderExpiry = now + ttl;
        await this.put('leader', { id: this.leaderId, expiry: this.leaderExpiry });
        return true;
      }

      return this.leaderId === nodeId;
    });
  }
}
```

### Distributed Lock

```typescript
export class DistributedLock extends BaseDurableObject {
  async acquire(lockId: string, ttl: number): Promise<boolean> {
    return this.blockConcurrencyWhile(async () => {
      const existing = await this.get<{ expiry: number }>(`lock:${lockId}`);

      if (existing && existing.expiry > Date.now()) {
        return false;
      }

      await this.put(`lock:${lockId}`, { expiry: Date.now() + ttl });
      return true;
    });
  }

  async release(lockId: string): Promise<void> {
    await this.delete(`lock:${lockId}`);
  }
}
```

### Event Aggregation

```typescript
export class EventAggregator extends BaseDurableObject {
  private events: Event[] = [];

  async addEvent(event: Event): Promise<void> {
    this.events.push(event);

    // Flush periodically
    if (this.events.length >= 100) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.events.length === 0) return;

    // Send to analytics service
    await fetch('https://analytics.example.com/events', {
      method: 'POST',
      body: JSON.stringify(this.events),
    });

    this.events = [];
  }
}
```

## Monitoring and Debugging

### Metrics Collection

```typescript
export class MetricsDurableObject extends BaseDurableObject {
  private metrics = new Map<string, number>();

  async recordMetric(name: string, value: number): Promise<void> {
    const current = this.metrics.get(name) || 0;
    this.metrics.set(name, current + value);

    // Periodic flush to monitoring service
    if (Math.random() < 0.01) {
      // 1% chance
      await this.flushMetrics();
    }
  }

  private async flushMetrics(): Promise<void> {
    // Send to monitoring service
    console.log('Metrics:', Object.fromEntries(this.metrics));
    this.metrics.clear();
  }
}
```

### Request Logging

```typescript
async fetch(request: Request): Promise<Response> {
  const start = Date.now();
  const requestId = crypto.randomUUID();

  console.log(`[${requestId}] ${request.method} ${request.url}`);

  try {
    const response = await this.handleRequest(request);
    const duration = Date.now() - start;

    console.log(`[${requestId}] ${response.status} in ${duration}ms`);
    return response;
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    throw error;
  }
}
```

## Limitations and Considerations

1. **Single-threaded** - Each object processes one request at a time
2. **Memory limits** - Keep in-memory state under 128MB
3. **CPU limits** - Same as Workers (10ms free, 30s paid)
4. **Geographic placement** - Objects live where they're first accessed
5. **Billing** - Charged for active objects and storage

## Troubleshooting

### Object Not Found

```typescript
// Always check if binding exists
if (!env.MY_DURABLE_OBJECT) {
  throw new Error('Durable Object binding not configured');
}
```

### State Not Persisting

```typescript
// Ensure you await storage operations
await this.put('key', value); // ✓ Correct
this.put('key', value); // ✗ Wrong - not awaited
```

### WebSocket Disconnections

```typescript
// Implement reconnection logic on client
class ReconnectingWebSocket {
  private reconnectDelay = 1000;

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onclose = () => {
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    };
  }
}
```
