# 🏗️ Wireframe Ecosystem Technical Architecture

## Overview

This document describes the technical implementation of Wireframe's transformation from a monolithic framework into a vendor-agnostic ecosystem with a package marketplace.

## Core Architecture

### Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Applications                      │
├─────────────────────────────────────────────────────────┤
│                    Wireframe CLI/SDK                      │
├─────────────────────────────────────────────────────────┤
│                   Package Registry                        │
├──────────────┬──────────────┬──────────────┬───────────┤
│  Connectors  │   Plugins    │  Templates   │  Themes   │
├──────────────┴──────────────┴──────────────┴───────────┤
│                   @wireframe/core                        │
│          (Interfaces, EventBus, Registry)                │
└─────────────────────────────────────────────────────────┘
```

## Package System

### Package Structure

Every Wireframe package follows this structure:

```
@wireframe/package-name/
├── package.json           # NPM package metadata
├── wireframe.json        # Wireframe-specific metadata
├── src/
│   ├── index.ts         # Main entry point
│   ├── interfaces.ts    # Package interfaces
│   └── implementation/  # Implementation code
├── tests/
├── docs/
└── examples/
```

### wireframe.json Schema

```json
{
  "$schema": "https://wireframe.dev/schemas/package.json",
  "type": "connector|plugin|template|theme",
  "name": "@wireframe/connector-telegram",
  "version": "1.0.0",
  "compatibility": {
    "core": "^2.0.0",
    "node": ">=18.0.0"
  },
  "provides": {
    "interfaces": ["messaging", "webhook", "file-upload"],
    "events": ["message.received", "user.joined"],
    "commands": ["start", "help", "settings"]
  },
  "requires": {
    "connectors": [],
    "plugins": [],
    "permissions": ["network", "storage"]
  },
  "config": {
    "schema": "./config.schema.json",
    "defaults": "./config.defaults.json"
  },
  "marketplace": {
    "category": "messaging",
    "tags": ["telegram", "bot", "chat"],
    "pricing": "free|paid|freemium",
    "support": "community|premium",
    "author": {
      "name": "Wireframe Team",
      "email": "support@wireframe.dev"
    }
  }
}
```

## Registry System

### Package Discovery

```typescript
interface PackageRegistry {
  // Discovery
  search(query: PackageQuery): Promise<PackageInfo[]>
  getPackage(name: string): Promise<PackageInfo>
  getVersions(name: string): Promise<Version[]>

  // Installation
  install(name: string, version?: string): Promise<void>
  uninstall(name: string): Promise<void>
  update(name: string): Promise<void>

  // Management
  list(): Promise<InstalledPackage[]>
  verify(name: string): Promise<VerificationResult>

  // Registry sources
  addSource(url: string, options?: SourceOptions): void
  removeSource(url: string): void
  listSources(): RegistrySource[]
}
```

### Registry Sources

```typescript
interface RegistrySource {
  url: string
  type: 'npm' | 'github' | 'private' | 'local'
  priority: number
  auth?: AuthConfig
  cache?: CacheConfig
}

// Default sources
const DEFAULT_SOURCES = [
  { url: 'https://registry.npmjs.org', type: 'npm', priority: 1 },
  { url: 'https://npm.pkg.github.com', type: 'github', priority: 2 },
  { url: 'https://registry.wireframe.dev', type: 'private', priority: 0 }
]
```

## Connector Architecture

### Base Connector Interface

```typescript
interface IConnector<TConfig = any> {
  readonly type: ConnectorType
  readonly name: string
  readonly version: string

  // Lifecycle
  initialize(config: TConfig): Promise<void>
  shutdown(): Promise<void>
  healthCheck(): Promise<HealthStatus>

  // Events
  on(event: string, handler: EventHandler): void
  off(event: string, handler: EventHandler): void
  emit(event: string, data: any): void
}
```

### Connector Types

```typescript
// Messaging Connectors
interface IMessagingConnector extends IConnector {
  sendMessage(recipient: string, message: Message): Promise<void>
  editMessage(messageId: string, content: string): Promise<void>
  deleteMessage(messageId: string): Promise<void>
  onMessage(handler: MessageHandler): void
}

// AI Provider Connectors
interface IAIConnector extends IConnector {
  complete(prompt: string, options?: CompletionOptions): Promise<string>
  stream(prompt: string, options?: StreamOptions): AsyncGenerator<string>
  embed(text: string): Promise<number[]>
}

// Cloud Platform Connectors
interface ICloudConnector extends IConnector {
  storage: IStorageService
  compute: IComputeService
  network: INetworkService
  monitoring: IMonitoringService
}

// Monitoring Connectors
interface IMonitoringConnector extends IConnector {
  captureException(error: Error, context?: any): void
  captureMessage(message: string, level: LogLevel): void
  captureMetric(name: string, value: number, tags?: Tags): void
  startTransaction(name: string): Transaction
}
```

## Plugin System

### Plugin Interface

```typescript
interface IPlugin {
  readonly name: string
  readonly version: string
  readonly priority: number

  // Lifecycle hooks
  onInstall?(context: PluginContext): Promise<void>
  onEnable?(context: PluginContext): Promise<void>
  onDisable?(context: PluginContext): Promise<void>
  onUninstall?(context: PluginContext): Promise<void>

  // Runtime hooks
  beforeRequest?(request: Request): Promise<Request | void>
  afterRequest?(request: Request, response: Response): Promise<void>
  onError?(error: Error): Promise<void>

  // Extension points
  registerCommands?(): Command[]
  registerMiddleware?(): Middleware[]
  registerServices?(): Service[]
  registerUI?(): UIComponent[]
}
```

### Plugin Context

```typescript
interface PluginContext {
  // Core services
  readonly eventBus: EventBus
  readonly registry: PackageRegistry
  readonly config: ConfigService
  readonly logger: Logger

  // Storage
  readonly storage: {
    get<T>(key: string): Promise<T | null>
    set<T>(key: string, value: T): Promise<void>
    delete(key: string): Promise<void>
    list(prefix?: string): Promise<string[]>
  }

  // API access
  readonly api: {
    registerEndpoint(path: string, handler: RequestHandler): void
    unregisterEndpoint(path: string): void
    callEndpoint(path: string, data: any): Promise<any>
  }

  // Inter-plugin communication
  readonly plugins: {
    get(name: string): IPlugin | null
    call(name: string, method: string, ...args: any[]): Promise<any>
    emit(event: string, data: any): void
  }
}
```

## Event System

### EventBus Implementation

```typescript
class EventBus {
  private handlers = new Map<string, Set<EventHandler>>()
  private middleware: EventMiddleware[] = []

  on(event: string, handler: EventHandler, options?: EventOptions): void
  once(event: string, handler: EventHandler): void
  off(event: string, handler?: EventHandler): void

  emit(event: string, data: any, metadata?: EventMetadata): void
  emitAsync(event: string, data: any, metadata?: EventMetadata): Promise<void>

  use(middleware: EventMiddleware): void

  // Wildcard support
  on('*', handler)              // All events
  on('user.*', handler)         // All user events
  on('**.error', handler)       // All error events at any level
}
```

### Event Namespacing

```
connector:telegram:message.received
plugin:analytics:event.tracked
core:registry:package.installed
user:auth:login.success
system:error:uncaught
```

## Configuration System

### Hierarchical Configuration

```typescript
interface ConfigService {
  // Loading
  load(source: ConfigSource): Promise<void>
  reload(): Promise<void>

  // Getting values
  get<T>(path: string, defaultValue?: T): T
  getRequired<T>(path: string): T
  has(path: string): boolean

  // Setting values
  set(path: string, value: any): void
  merge(config: Partial<Config>): void

  // Validation
  validate(schema: Schema): ValidationResult

  // Watching
  watch(path: string, callback: ConfigChangeHandler): void
  unwatch(path: string, callback?: ConfigChangeHandler): void
}
```

### Configuration Sources Priority

1. Environment variables (highest)
2. CLI arguments
3. Local config file (wireframe.config.ts)
4. User config (~/.wireframe/config.json)
5. Project config (./wireframe.json)
6. Package defaults (lowest)

## Dependency Injection

### Service Container

```typescript
class ServiceContainer {
  // Registration
  register<T>(token: Token<T>, provider: Provider<T>): void
  registerSingleton<T>(token: Token<T>, instance: T): void
  registerFactory<T>(token: Token<T>, factory: Factory<T>): void

  // Resolution
  resolve<T>(token: Token<T>): T
  resolveAsync<T>(token: Token<T>): Promise<T>
  tryResolve<T>(token: Token<T>): T | null

  // Scoping
  createScope(): ServiceContainer

  // Lifecycle
  dispose(): Promise<void>
}

// Usage
const container = new ServiceContainer()

// Register services
container.register(TOKENS.Logger, ConsoleLogger)
container.register(TOKENS.Database, {
  useFactory: (logger: Logger) => new Database(logger),
  deps: [TOKENS.Logger]
})

// Resolve
const logger = container.resolve(TOKENS.Logger)
```

## Security Model

### Package Verification

```typescript
interface PackageVerification {
  // Signature verification
  verifySignature(package: Package): Promise<boolean>

  // Checksum validation
  validateChecksum(package: Package): Promise<boolean>

  // Dependency scanning
  scanDependencies(package: Package): Promise<SecurityReport>

  // Permission checking
  checkPermissions(package: Package): Promise<PermissionReport>

  // License compliance
  checkLicense(package: Package): Promise<LicenseReport>
}
```

### Permission System

```typescript
enum Permission {
  // Network
  NETWORK_HTTP = 'network:http',
  NETWORK_WEBSOCKET = 'network:websocket',

  // Storage
  STORAGE_READ = 'storage:read',
  STORAGE_WRITE = 'storage:write',

  // System
  SYSTEM_ENV = 'system:env',
  SYSTEM_EXEC = 'system:exec',

  // Inter-package
  PACKAGE_CALL = 'package:call',
  PACKAGE_EVENT = 'package:event'
}

interface PermissionManager {
  request(permissions: Permission[]): Promise<boolean>
  check(permission: Permission): boolean
  grant(packageName: string, permissions: Permission[]): void
  revoke(packageName: string, permissions: Permission[]): void
}
```

## Performance Optimizations

### Lazy Loading

```typescript
class LazyLoader {
  private loaded = new Map<string, any>()
  private loading = new Map<string, Promise<any>>()

  async load<T>(name: string, loader: () => Promise<T>): Promise<T> {
    // Return cached if available
    if (this.loaded.has(name)) {
      return this.loaded.get(name)
    }

    // Wait for in-progress loading
    if (this.loading.has(name)) {
      return this.loading.get(name)
    }

    // Start loading
    const promise = loader().then(result => {
      this.loaded.set(name, result)
      this.loading.delete(name)
      return result
    })

    this.loading.set(name, promise)
    return promise
  }
}
```

### Bundle Optimization

```typescript
// Dynamic imports for code splitting
const loadConnector = async (name: string) => {
  switch (name) {
    case 'telegram':
      return import('@wireframe/connector-telegram')
    case 'discord':
      return import('@wireframe/connector-discord')
    default:
      throw new Error(`Unknown connector: ${name}`)
  }
}

// Tree-shaking friendly exports
export { EventBus } from './event-bus'
export { Registry } from './registry'
export type { IConnector, IPlugin } from './interfaces'
```

## Testing Strategy

### Package Testing

```typescript
interface PackageTestSuite {
  // Unit tests
  unit: {
    test(name: string, fn: TestFunction): void
    describe(name: string, fn: SuiteFunction): void
  }

  // Integration tests
  integration: {
    withCore(version: string): TestEnvironment
    withConnectors(...connectors: string[]): TestEnvironment
    withPlugins(...plugins: string[]): TestEnvironment
  }

  // E2E tests
  e2e: {
    scenario(name: string, steps: TestStep[]): void
    withFixture(fixture: Fixture): TestEnvironment
  }

  // Performance tests
  performance: {
    benchmark(name: string, fn: BenchmarkFunction): void
    profile(name: string, fn: ProfileFunction): void
  }
}
```

## Migration Path

### From v1.x to v2.0

```typescript
// v1.x (monolithic)
import { TelegramBot } from 'wireframe'
const bot = new TelegramBot(config)

// v2.0 (ecosystem)
import { Wireframe } from '@wireframe/core'
const bot = await Wireframe.create({
  connectors: ['telegram'],
  config
})
```

### Compatibility Layer

```typescript
// Backwards compatibility wrapper
export class TelegramBot {
  private wireframe: Wireframe

  constructor(config: LegacyConfig) {
    this.wireframe = await Wireframe.create({
      connectors: ['telegram'],
      config: this.migrateCon fig(config)
    })
  }

  // Legacy method mapping
  onMessage(handler) {
    this.wireframe.on('message', handler)
  }
}
```

## Deployment Architecture

### Multi-Platform Deployment

```yaml
# wireframe.deploy.yml
deployments:
  production:
    platform: cloudflare
    connectors:
      - telegram
      - openai
    plugins:
      - analytics
      - monitoring
    config:
      source: env

  staging:
    platform: aws-lambda
    connectors:
      - discord
      - anthropic
    config:
      source: secrets-manager
```

### Container Support

```dockerfile
# Optimized multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM gcr.io/distroless/nodejs20
COPY --from=builder /app /app
WORKDIR /app
CMD ["node", "dist/index.js"]
```

## Monitoring & Observability

### Built-in Telemetry

```typescript
interface Telemetry {
  // Metrics
  counter(name: string, value?: number, tags?: Tags): void
  gauge(name: string, value: number, tags?: Tags): void
  histogram(name: string, value: number, tags?: Tags): void

  // Tracing
  startSpan(name: string, options?: SpanOptions): Span

  // Logging
  log(level: LogLevel, message: string, context?: any): void

  // Events
  track(event: string, properties?: any): void
}
```

This architecture ensures Wireframe remains vendor-agnostic while providing a robust foundation for the package ecosystem and marketplace vision.
