# 🌩️ Multi-Cloud Platform Support

Wireframe v1.2 introduces a revolutionary cloud-agnostic architecture that allows you to deploy your AI assistant on any cloud platform without changing your code.

## 🎯 Overview

The platform abstraction layer provides:

- **Zero code changes** when switching platforms
- **Unified interfaces** for storage, databases, and caching
- **Platform-specific optimizations** while maintaining compatibility
- **Easy extensibility** for new cloud providers

## 🔧 Supported Platforms

### ✅ Currently Supported

#### Cloudflare Workers

- **Status**: ✅ Fully implemented
- **Storage**: KV Namespaces
- **Database**: D1 (SQLite)
- **Object Storage**: R2
- **Cache**: Cache API
- **Edge Computing**: Global network

#### AWS

- **Status**: 🚧 In development
- **Storage**: DynamoDB
- **Database**: RDS/Aurora
- **Object Storage**: S3
- **Cache**: ElastiCache/CloudFront
- **Compute**: Lambda

#### Google Cloud Platform

- **Status**: 🚧 In development
- **Storage**: Firestore
- **Database**: Cloud SQL/Spanner
- **Object Storage**: Cloud Storage
- **Cache**: Memorystore/CDN
- **Compute**: Cloud Functions/Cloud Run

### 📋 Planned Support

- **Azure** - Functions, Cosmos DB, Blob Storage
- **Vercel** - Edge Functions, KV
- **Supabase** - Edge Functions, PostgreSQL
- **Local** - Development environment

## 🚀 Quick Start

### 1. Set Your Platform

```bash
# .env or wrangler.toml
CLOUD_PLATFORM=cloudflare  # or 'aws', 'gcp', etc.
```

### 2. Deploy

The same code works on any platform:

```typescript
// Your code doesn't change!
const db = ctx.cloudConnector.getDatabaseStore('DB')
const kv = ctx.cloudConnector.getKeyValueStore('SESSIONS')
```

## 🏗️ Architecture

### Platform Abstraction Layer

```typescript
interface ICloudPlatformConnector {
  // Storage abstractions
  getKeyValueStore(namespace: string): IKeyValueStore
  getDatabaseStore(name: string): IDatabaseStore
  getObjectStore(bucket: string): IObjectStore
  getCacheStore(): ICacheStore

  // Platform info
  readonly platform: string
  getEnv(): Record<string, string | undefined>
  getFeatures(): PlatformFeatures
}
```

### Storage Interfaces

#### Key-Value Store

```typescript
interface IKeyValueStore {
  get<T>(key: string): Promise<T | null>
  put(key: string, value: any, options?: PutOptions): Promise<void>
  delete(key: string): Promise<void>
  list(options?: ListOptions): Promise<ListResult>
}
```

#### Database Store

```typescript
interface IDatabaseStore {
  prepare(query: string): IPreparedStatement
  exec(query: string): Promise<void>
  batch(statements: IPreparedStatement[]): Promise<unknown[]>
}
```

## 🔌 Adding a New Platform

### 1. Create Connector

```typescript
// src/connectors/cloud/myplatform/myplatform-connector.ts
export class MyPlatformConnector implements ICloudPlatformConnector {
  readonly platform = 'myplatform'

  getKeyValueStore(namespace: string): IKeyValueStore {
    return new MyPlatformKVStore(/* ... */)
  }

  // Implement other methods...
}
```

### 2. Register Connector

```typescript
// src/connectors/cloud/index.ts
import { MyPlatformConnector } from './myplatform'

cloudPlatformRegistry.register('myplatform', MyPlatformConnector)
```

### 3. Configure Environment

```bash
CLOUD_PLATFORM=myplatform
# Platform-specific configs
MYPLATFORM_API_KEY=xxx
MYPLATFORM_REGION=us-east-1
```

## 🔄 Migration Guide

### From Direct Cloudflare Usage

Before (v1.1):

```typescript
import { KVNamespace, D1Database } from '@cloudflare/workers-types'

const sessions = env.SESSIONS as KVNamespace
await sessions.put(key, value)
```

After (v1.2):

```typescript
// Works on ANY platform!
const kv = ctx.cloudConnector.getKeyValueStore('SESSIONS')
await kv.put(key, value)
```

### Platform-Specific Features

```typescript
const features = ctx.cloudConnector.getFeatures()

if (features.hasEdgeCache) {
  // Use edge caching
}

if (features.maxRequestDuration > 30000) {
  // Can run long tasks
}
```

## 📊 Platform Comparison

| Feature        | Cloudflare | AWS            | GCP              | Azure           |
| -------------- | ---------- | -------------- | ---------------- | --------------- |
| Edge Computing | ✅ Global  | ✅ CloudFront  | ✅ Cloud CDN     | ✅ Front Door   |
| KV Storage     | ✅ KV      | ✅ DynamoDB    | ✅ Firestore     | ✅ Cosmos DB    |
| SQL Database   | ✅ D1      | ✅ RDS         | ✅ Cloud SQL     | ✅ SQL Database |
| Object Storage | ✅ R2      | ✅ S3          | ✅ Cloud Storage | ✅ Blob Storage |
| WebSockets     | ❌         | ✅ API Gateway | ✅ Cloud Run     | ✅ Web PubSub   |
| Max Duration   | 30s/10ms   | 15 min         | 60 min           | 10 min          |
| Cold Starts    | Minimal    | Variable       | Variable         | Variable        |

## 🎯 Best Practices

### 1. Use Abstractions

Always use the platform interfaces:

```typescript
// ✅ Good
const db = ctx.cloudConnector.getDatabaseStore('DB')

// ❌ Bad - platform specific
const db = env.DB as D1Database
```

### 2. Check Features

Adapt to platform capabilities:

```typescript
const features = ctx.cloudConnector.getFeatures()

const timeout = Math.min(
  30000, // Your desired timeout
  features.maxRequestDuration
)
```

### 3. Environment Variables

Use platform-agnostic naming:

```typescript
// Platform determines actual resource
const db = cloudConnector.getDatabaseStore('MAIN_DB')
const cache = cloudConnector.getKeyValueStore('CACHE')
```

## 🚨 Common Issues

### Type Errors

If you see type errors with platform-specific types:

```typescript
// Add type assertion for platform types
const env = context.env as CloudflareEnv
```

### Missing Bindings

Ensure your platform configuration includes all required resources:

```toml
# wrangler.toml for Cloudflare
[[kv_namespaces]]
binding = "SESSIONS"
id = "xxx"

[[d1_databases]]
binding = "DB"
database_name = "wireframe"
```

## 🔮 Future Enhancements

- **Auto-detection** of platform from environment
- **Migration tools** for moving between platforms
- **Performance profiling** per platform
- **Cost optimization** recommendations
- **Platform-specific plugins**

## 📚 Resources

- [Platform Connectors API](./API_REFERENCE.md#platform-connectors)
- [Storage Interfaces](./API_REFERENCE.md#storage-interfaces)
- [Example Implementations](../examples/multi-cloud)
- [Migration Scripts](../scripts/migrate-platform)

---

With Wireframe's multi-cloud architecture, you're never locked into a single provider. Deploy anywhere, scale everywhere! 🚀
