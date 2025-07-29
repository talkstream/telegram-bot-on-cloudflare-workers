# Test Helpers Suite

A comprehensive collection of testing utilities for TypeScript applications, especially those using Cloudflare Workers, D1 Database, KV storage, and messaging platforms.

## Installation

The test helpers are included in the Wireframe platform. Import them in your tests:

```typescript
import {
  createMockD1Database,
  createMockKVNamespace,
  createUserFixture,
  waitFor,
  // ... and more
} from '@/test-helpers';
```

## Database Testing

### D1 Mock with Query Tracking

```typescript
import { createMockD1Database } from '@/test-helpers';

const mockDb = createMockD1Database();

// Set up expected results
mockDb._setQueryResult('SELECT * FROM users', [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
]);

// Use in your code
const result = await mockDb.prepare('SELECT * FROM users').all();

// Verify queries
expect(mockDb._queries).toHaveLength(1);
expect(mockDb._queries[0].sql).toBe('SELECT * FROM users');
```

### Query Builder for Tests

```typescript
import { TestQueryBuilder, createInsertQuery } from '@/test-helpers';

// Build complex queries
const query = new TestQueryBuilder()
  .select('id', 'name', 'email')
  .from('users')
  .where('active', '=', true)
  .where('role', '=', 'admin')
  .orderBy('created_at', 'DESC')
  .limit(10)
  .build();

// Simple insert
const insert = createInsertQuery('users', {
  name: 'John Doe',
  email: 'john@example.com',
  active: true,
});
```

### Database Fixtures

```typescript
import { createUserFixture, FixtureGenerator, TEST_DATA } from '@/test-helpers';

// Single fixture
const user = createUserFixture({
  username: 'testuser',
  role: 'admin',
});

// Multiple fixtures
const generator = new FixtureGenerator(createUserFixture);
const users = generator.createMany(10, (index) => ({
  username: `user${index}`,
  email: `user${index}@test.com`,
}));

// Use predefined test data
const adminUser = TEST_DATA.users.admin;
```

## Storage Testing

### KV Namespace Mock

```typescript
import { createMockKVNamespace, KVTestUtils } from '@/test-helpers';

const mockKV = createMockKVNamespace();

// Basic operations
await mockKV.put('key', 'value');
const value = await mockKV.get('key');

// With expiration
await mockKV.put('temp', 'data', { expirationTtl: 60 });

// Namespaced KV
const userKV = KVTestUtils.createNamespacedKV(mockKV, 'users');
await userKV.put('123', JSON.stringify({ name: 'Alice' }));

// Batch operations
const batch = KVTestUtils.createBatchWriter(mockKV);
batch.put('key1', 'value1');
batch.put('key2', 'value2');
await batch.flush();
```

### Cache Testing

```typescript
import { MockCacheService, CacheTestUtils } from '@/test-helpers';

const cache = new MockCacheService();

// Track statistics
await cache.set('key', 'value');
await cache.get('key'); // hit
await cache.get('missing'); // miss

const stats = cache.getStats();
console.log(`Hit rate: ${stats.hitRate}`);

// Tag-based operations
await cache.set('user:1', userData, { tags: ['users', 'active'] });
await cache.set('post:1', postData, { tags: ['posts'] });
await cache.purgeByTags(['users']);

// Simulate expiration
vi.useFakeTimers();
await cache.set('temp', 'value', { ttl: 60 });
await CacheTestUtils.simulateExpiration(cache, 61);
vi.useRealTimers();
```

## Platform Testing

### Worker Environment

```typescript
import { createMockWorkerEnv, createMockExecutionContext } from '@/test-helpers';

// Create full environment
const env = createMockWorkerEnv({
  API_KEY: 'test-key',
  DATABASE_URL: 'sqlite://test.db',
});

// Create execution context
const ctx = createMockExecutionContext();
ctx.waitUntil(someAsyncOperation());

// Access services
const db = env.DB;
const kv = env.KV;
const queue = env.QUEUE;
```

### Durable Objects

```typescript
import { createMockDurableObjectNamespace } from '@/test-helpers';

const namespace = createMockDurableObjectNamespace();
const id = namespace.newUniqueId();
const stub = namespace.get(id);

// Interact with stub
const response = await stub.fetch(
  new Request('https://example.com/put', {
    method: 'POST',
    body: JSON.stringify({ key: 'data', value: 123 }),
  }),
);
```

## Async Testing Utilities

### Wait for Conditions

```typescript
import { waitFor, sleep } from '@/test-helpers';

// Wait for async condition
await waitFor(
  async () => {
    const status = await checkStatus();
    return status === 'ready';
  },
  { timeout: 5000, interval: 100 },
);

// Simple delay
await sleep(1000);
```

### Retry with Backoff

```typescript
import { retry } from '@/test-helpers';

const result = await retry(
  async () => {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error('Failed');
    return response.json();
  },
  {
    maxAttempts: 5,
    initialDelay: 100,
    maxDelay: 5000,
    onError: (error, attempt) => {
      console.log(`Attempt ${attempt} failed:`, error);
    },
  },
);
```

### Event Testing

```typescript
import { TestEventEmitter } from '@/test-helpers';

const emitter = new TestEventEmitter<{
  message: [string, number];
  error: [Error];
}>();

// Wait for event
setTimeout(() => emitter.emit('message', 'hello', 42), 100);
const [msg, num] = await emitter.waitForEvent('message');

// Check history
const history = emitter.getEventHistory();
expect(history[0].event).toBe('message');
```

### Async Queue

```typescript
import { AsyncQueue } from '@/test-helpers';

const queue = new AsyncQueue<string>();

// Producer
queue.push('item1');
queue.push('item2');

// Consumer
const item1 = await queue.pop(); // 'item1'
const item2 = await queue.pop(); // 'item2'
const item3 = await queue.pop(); // Will wait for next push
```

## Advanced Patterns

### Integration Test Setup

```typescript
import {
  createMockWorkerEnv,
  createMockD1Database,
  TestDatabaseSeeder,
  createUserFixture,
} from '@/test-helpers';

describe('Integration Test', () => {
  let env: ReturnType<typeof createMockWorkerEnv>;
  let seeder: TestDatabaseSeeder;

  beforeEach(async () => {
    env = createMockWorkerEnv();

    // Seed database
    seeder = new TestDatabaseSeeder();
    seeder.add('users', [
      createUserFixture({ id: 1, role: 'admin' }),
      createUserFixture({ id: 2, role: 'user' }),
    ]);

    // Set up expected queries
    env.DB._setQueryResult(/SELECT.*FROM users/, seeder.fixtures.get('users'));
  });

  afterEach(() => {
    env.DB._reset();
    env.KV._reset();
  });
});
```

### Performance Testing

```typescript
import { parallelLimit, CacheTestUtils } from '@/test-helpers';

// Test concurrent operations
const operations = Array.from({ length: 100 }, (_, i) => async () => {
  return await processItem(i);
});

const results = await parallelLimit(operations, 10);

// Monitor cache performance
const monitor = CacheTestUtils.createCacheMonitor();
monitor.recordSet('key', 'value');
monitor.recordGet('key', true);

const stats = monitor.getStats();
console.log(`Cache hit rate: ${stats.hitRate}`);
```

### Snapshot Testing

```typescript
import { createMockKVNamespace } from '@/test-helpers';

const kv = createMockKVNamespace();

// Populate data
await kv.put('config', JSON.stringify({ version: 1 }));
await kv.put('user:1', JSON.stringify({ name: 'Alice' }));

// Take snapshot
const snapshot = kv._dump();
expect(snapshot).toMatchSnapshot();
```

## Best Practices

1. **Reset Between Tests**: Always reset mocks between tests to avoid state leakage

   ```typescript
   afterEach(() => {
     mockDb._reset();
     mockKV._reset();
     vi.clearAllMocks();
   });
   ```

2. **Use Type-Safe Fixtures**: Leverage TypeScript for fixture typing

   ```typescript
   interface CustomUser extends UserFixture {
     customField: string;
   }

   const user = createUserFixture<CustomUser>({
     customField: 'value',
   });
   ```

3. **Mock at the Right Level**: Mock external dependencies, not your own code

   ```typescript
   // Good: Mock the database
   mockDb._setQueryResult('SELECT * FROM users', users);

   // Bad: Mock your service method
   vi.spyOn(userService, 'getUsers').mockResolvedValue(users);
   ```

4. **Use Realistic Test Data**: Make fixtures as realistic as possible

   ```typescript
   const user = createUserFixture({
     email: 'real.email@example.com',
     createdAt: new Date('2024-01-01').toISOString(),
   });
   ```

5. **Test Async Flows**: Use the async utilities for complex flows

   ```typescript
   const emitter = new TestEventEmitter();
   const queue = new AsyncQueue();

   // Simulate real async behavior
   setTimeout(() => queue.push('data'), 100);
   const data = await waitFor(() => queue.pop());
   ```

## Troubleshooting

### Common Issues

1. **Queries not matching**: Use regex patterns for flexible matching

   ```typescript
   mockDb._setQueryResult(/SELECT.*FROM users.*WHERE/i, results);
   ```

2. **Timing issues**: Use fake timers for time-dependent tests

   ```typescript
   vi.useFakeTimers();
   // ... test code
   vi.advanceTimersByTime(1000);
   vi.useRealTimers();
   ```

3. **Memory leaks**: Always clean up resources
   ```typescript
   afterEach(() => {
     emitter.removeAllListeners();
     queue.clear();
   });
   ```

## Contributing

When adding new test helpers:

1. Follow the existing patterns
2. Add comprehensive tests
3. Update this documentation
4. Consider backwards compatibility
5. Add TypeScript types for everything
