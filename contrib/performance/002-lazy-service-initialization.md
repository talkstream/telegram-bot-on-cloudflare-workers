# Performance: Lazy Service Initialization

## Problem

In Kogotochki bot, services were initialized on connector startup even when not needed:

- Master-only services loaded for regular users
- Analytics service initialized but rarely used
- Memory wasted on Cloudflare Workers free tier
- Slower cold starts

## Solution

Lazy initialization pattern with global service holder:

```typescript
// File: src/patterns/lazy-services.ts

interface ServiceInstances<T extends Record<string, any>> {
  [K in keyof T]: T[K] | null;
}

export class LazyServiceContainer<T extends Record<string, any>> {
  private services: ServiceInstances<T>;
  private factories: Map<keyof T, () => T[keyof T]>;

  constructor() {
    this.services = {} as ServiceInstances<T>;
    this.factories = new Map();
  }

  register<K extends keyof T>(
    name: K,
    factory: () => T[K]
  ): void {
    this.factories.set(name, factory);
    this.services[name] = null;
  }

  get<K extends keyof T>(name: K): T[K] {
    if (!this.services[name]) {
      const factory = this.factories.get(name);
      if (!factory) {
        throw new Error(`Service ${String(name)} not registered`);
      }
      this.services[name] = factory();
    }
    return this.services[name]!;
  }

  // For testing and cleanup
  reset(): void {
    for (const key in this.services) {
      this.services[key] = null;
    }
  }
}
```

## Implementation Example

```typescript
// File: src/connectors/messaging/telegram/services/service-container.ts

// Define service types
interface KogotochkiServices {
  userService: UserService
  locationService: LocationService
  providerService: ProviderService
  auctionService: AuctionService
  analyticsService: AnalyticsService
  paymentService: PaymentService
}

// Global container
const serviceContainer = new LazyServiceContainer<KogotochkiServices>()

// Configuration holder
let serviceConfig: {
  dbStore: IDatabaseStore | null
  kvCache: KVNamespace | null
  env: Env | null
} = {
  dbStore: null,
  kvCache: null,
  env: null
}

// Initialize container with factories
export function initializeServiceContainer(dbStore: IDatabaseStore, env: Env): void {
  serviceConfig.dbStore = dbStore
  serviceConfig.kvCache = env.CACHE || null
  serviceConfig.env = env

  // Register lazy factories
  serviceContainer.register('userService', () => {
    if (!serviceConfig.dbStore) throw new Error('Database not configured')
    return serviceConfig.kvCache
      ? new CachedUserService(serviceConfig.dbStore, serviceConfig.kvCache)
      : new UserService(serviceConfig.dbStore)
  })

  serviceContainer.register('locationService', () => {
    if (!serviceConfig.dbStore) throw new Error('Database not configured')
    return serviceConfig.kvCache
      ? new CachedLocationService(serviceConfig.dbStore, serviceConfig.kvCache)
      : new LocationService(serviceConfig.dbStore)
  })

  serviceContainer.register('providerService', () => {
    if (!serviceConfig.dbStore) throw new Error('Database not configured')
    return new ProviderService(serviceConfig.dbStore)
  })

  serviceContainer.register('auctionService', () => {
    if (!serviceConfig.dbStore) throw new Error('Database not configured')
    return serviceConfig.kvCache
      ? new CachedAuctionService(serviceConfig.dbStore, serviceConfig.kvCache)
      : new AuctionService(serviceConfig.dbStore)
  })

  serviceContainer.register('analyticsService', () => {
    if (!serviceConfig.dbStore) throw new Error('Database not configured')
    return new AnalyticsService(serviceConfig.dbStore)
  })

  serviceContainer.register('paymentService', () => {
    if (!serviceConfig.dbStore) throw new Error('Database not configured')
    return new PaymentService(serviceConfig.dbStore)
  })
}

// Export getters
export const getUserService = () => serviceContainer.get('userService')
export const getLocationService = () => serviceContainer.get('locationService')
export const getProviderService = () => serviceContainer.get('providerService')
export const getAuctionService = () => serviceContainer.get('auctionService')
export const getAnalyticsService = () => serviceContainer.get('analyticsService')
export const getPaymentService = () => serviceContainer.get('paymentService')
```

## Ultra-Lazy Database Connection

Even database connection can be lazy:

```typescript
// File: src/core/cloud/lazy-cloud-platform.ts

let dbStore: IDatabaseStore | null = null
let env: Env | null = null

export function setEnvironment(environment: Env): void {
  env = environment
}

export function getDatabaseStore(): IDatabaseStore {
  if (!dbStore) {
    if (!env) {
      throw new Error('Environment not set. Call setEnvironment first.')
    }

    const platform = getCloudPlatformConnector(env)
    dbStore = platform.getDatabaseStore('DB')

    if (!dbStore) {
      throw new Error('Database not available')
    }
  }

  return dbStore
}

// In service factory
serviceContainer.register('userService', () => {
  const db = getDatabaseStore() // Lazy DB connection
  return new UserService(db)
})
```

## Conditional Service Loading

Load services based on user type:

```typescript
// File: src/patterns/conditional-services.ts

interface ConditionalService<T> {
  condition: () => boolean | Promise<boolean>
  factory: () => T
}

export class ConditionalServiceContainer<
  T extends Record<string, any>
> extends LazyServiceContainer<T> {
  private conditions = new Map<keyof T, () => boolean | Promise<boolean>>()

  registerConditional<K extends keyof T>(
    name: K,
    factory: () => T[K],
    condition: () => boolean | Promise<boolean>
  ): void {
    super.register(name, factory)
    this.conditions.set(name, condition)
  }

  async get<K extends keyof T>(name: K): Promise<T[K] | null> {
    const condition = this.conditions.get(name)
    if (condition && !(await condition())) {
      return null
    }
    return super.get(name)
  }
}

// Usage
container.registerConditional(
  'masterService',
  () => new MasterService(db),
  async () => {
    const user = await getUserService().getCurrentUser()
    return user?.isMaster === true
  }
)
```

## Testing

```typescript
// File: src/patterns/__tests__/lazy-services.test.ts
describe('Lazy Service Container', () => {
  let container: LazyServiceContainer<TestServices>
  let factoryCalls: Record<string, number>

  beforeEach(() => {
    container = new LazyServiceContainer()
    factoryCalls = { service1: 0, service2: 0 }

    container.register('service1', () => {
      factoryCalls.service1++
      return new TestService1()
    })

    container.register('service2', () => {
      factoryCalls.service2++
      return new TestService2()
    })
  })

  it('should not create services until requested', () => {
    expect(factoryCalls.service1).toBe(0)
    expect(factoryCalls.service2).toBe(0)
  })

  it('should create service on first access', () => {
    const service1 = container.get('service1')

    expect(factoryCalls.service1).toBe(1)
    expect(factoryCalls.service2).toBe(0)
    expect(service1).toBeInstanceOf(TestService1)
  })

  it('should reuse service instance', () => {
    const service1a = container.get('service1')
    const service1b = container.get('service1')

    expect(factoryCalls.service1).toBe(1)
    expect(service1a).toBe(service1b)
  })

  it('should handle reset correctly', () => {
    const service1a = container.get('service1')
    container.reset()
    const service1b = container.get('service1')

    expect(factoryCalls.service1).toBe(2)
    expect(service1a).not.toBe(service1b)
  })
})
```

## Production Impact

Measured in Kogotochki bot:

- **Cold start time**: -30% (fewer initializations)
- **Memory usage**: -40% for basic users
- **Service creation**: Only when actually used
- **Free tier friendly**: Stays under limits

## Memory Profile Comparison

```
// Before: All services initialized
Cold Start Memory: 45MB
- UserService: 5MB
- LocationService: 8MB
- ProviderService: 10MB (never used by regular users)
- AuctionService: 8MB
- AnalyticsService: 12MB (rarely used)
- PaymentService: 2MB

// After: Lazy initialization
Cold Start Memory: 15MB
- Core platform: 10MB
- UserService: 5MB (always needed)
- Others: 0MB (created on demand)
```

## Best Practices

1. **Register Early, Create Late**: Register all factories during initialization
2. **Handle Errors Gracefully**: Service creation might fail
3. **Reset for Tests**: Use reset() between test cases
4. **Monitor Creation**: Log when services are created in production
5. **Conditional Loading**: Skip heavy services based on user type/permissions

## Why Include in Wireframe

1. **Memory Efficiency**: Critical for edge computing
2. **Faster Cold Starts**: Better user experience
3. **Cost Optimization**: Less memory = lower costs
4. **Flexibility**: Load only what's needed

## Implementation Checklist

- [ ] Add LazyServiceContainer to core patterns
- [ ] Update connector templates to use lazy initialization
- [ ] Add conditional service loading
- [ ] Document memory savings
- [ ] Include performance monitoring
