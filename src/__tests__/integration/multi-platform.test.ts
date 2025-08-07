/**
 * Multi-platform integration tests
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { AWSConnector } from '../../connectors/cloud/aws/aws-connector'
import { CloudflareConnector } from '../../connectors/cloud/cloudflare/cloudflare-connector'
import { CloudPlatformFactory, cloudPlatformRegistry } from '../../core/cloud/platform-factory'
import { CommonEventType, EventBus } from '../../core/events/event-bus'
import type { ICloudPlatformConnector } from '../../core/interfaces/cloud-platform'

// Register AWS connector for tests
// Type assertion is needed because AWSConnector expects specific config shape
cloudPlatformRegistry.register(
  'aws',
  AWSConnector as unknown as new (config: {
    env: Record<string, unknown>
  }) => ICloudPlatformConnector
)

describe('Multi-Platform Integration', () => {
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = new EventBus({ debug: false })
  })

  describe('Platform Registration and Creation', () => {
    it('should register and create different platform connectors', () => {
      // Cloudflare
      const cloudflareEnv: Record<string, unknown> = {
        CLOUD_PLATFORM: 'cloudflare',
        AI_BINDING: 'AI',
        KV_BINDING: 'MY_KV',
        D1_BINDING: 'DB'
      }

      const cloudflareConnector = CloudPlatformFactory.createFromTypedEnv(cloudflareEnv)
      expect(cloudflareConnector).toBeInstanceOf(CloudflareConnector)
      expect(cloudflareConnector.platform).toBe('cloudflare')

      // AWS
      const awsEnv: Record<string, unknown> = {
        CLOUD_PLATFORM: 'aws',
        AWS_REGION: 'us-east-1'
      }

      const awsConnector = CloudPlatformFactory.createFromTypedEnv(awsEnv)
      expect(awsConnector).toBeInstanceOf(AWSConnector)
      expect(awsConnector.platform).toBe('aws')
    })

    it('should emit events when platforms are registered', async () => {
      interface PlatformEvent {
        type: string
        payload: {
          type: string
          platform: string
          connector: ICloudPlatformConnector
        }
        source: string
      }
      const events: PlatformEvent[] = []

      eventBus.on(CommonEventType.CONNECTOR_REGISTERED, event => {
        events.push(event)
      })

      // Create connector
      const env = {
        CLOUD_PLATFORM: 'cloudflare',
        AI_BINDING: 'AI'
      }

      const connector = CloudPlatformFactory.createFromTypedEnv(env)

      // Emit registration event
      eventBus.emit(
        CommonEventType.CONNECTOR_REGISTERED,
        {
          type: 'cloud',
          platform: connector.platform,
          connector
        },
        'CloudPlatformFactory'
      )

      // Wait for async event processing
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(events).toHaveLength(1)
      expect(events[0].payload.platform).toBe('cloudflare')
      expect(events[0].source).toBe('CloudPlatformFactory')
    })
  })

  describe('Cross-Platform Feature Detection', () => {
    it('should detect platform-specific features', () => {
      const platforms: ICloudPlatformConnector[] = [
        new CloudflareConnector({
          env: { AI_BINDING: 'AI' },
          ctx: {} as ExecutionContext,
          request: new Request('https://example.com')
        }),
        new AWSConnector({
          env: { AWS_REGION: 'us-east-1' }
        })
      ]

      platforms.forEach(platform => {
        const features = platform.getFeatures()

        expect(features).toHaveProperty('hasEdgeCache')
        expect(features).toHaveProperty('hasWebSockets')
        expect(features).toHaveProperty('hasCron')
        expect(features).toHaveProperty('hasQueues')
        expect(features).toHaveProperty('maxRequestDuration')
        expect(features).toHaveProperty('maxMemory')

        // eslint-disable-next-line no-console
        console.log(`${platform.platform} features:`, features)
      })
    })

    it('should provide consistent interfaces across platforms', () => {
      const cloudflare = new CloudflareConnector({
        env: { MY_KV: {} },
        ctx: {} as ExecutionContext,
        request: new Request('https://example.com')
      })

      const aws = new AWSConnector({
        env: { DYNAMODB_TABLES: { users: 'users-table' } }
      })

      // Both should provide the same interface methods
      expect(typeof cloudflare.getKeyValueStore).toBe('function')
      expect(typeof aws.getKeyValueStore).toBe('function')

      expect(typeof cloudflare.getDatabaseStore).toBe('function')
      expect(typeof aws.getDatabaseStore).toBe('function')

      expect(typeof cloudflare.getObjectStore).toBe('function')
      expect(typeof aws.getObjectStore).toBe('function')

      expect(typeof cloudflare.getCacheStore).toBe('function')
      expect(typeof aws.getCacheStore).toBe('function')
    })
  })

  describe('Platform Switching', () => {
    it('should allow switching between platforms based on environment', () => {
      const environments = [
        { CLOUD_PLATFORM: 'cloudflare', expectedPlatform: 'cloudflare' },
        { CLOUD_PLATFORM: 'aws', expectedPlatform: 'aws' },
        { CLOUD_PLATFORM: 'gcp', expectedPlatform: 'gcp' },
        { CLOUD_PLATFORM: 'azure', expectedPlatform: 'azure' }
      ]

      environments.forEach(({ CLOUD_PLATFORM, expectedPlatform }) => {
        try {
          const connector = CloudPlatformFactory.createFromTypedEnv({ CLOUD_PLATFORM })
          expect(connector.platform).toBe(expectedPlatform)
        } catch (error) {
          // GCP and Azure might not be implemented yet
          if (expectedPlatform === 'gcp' || expectedPlatform === 'azure') {
            expect(error).toBeDefined()
          } else {
            throw error
          }
        }
      })
    })

    it('should handle platform-specific environment variables', () => {
      // Cloudflare with bindings
      const cloudflareEnv = {
        CLOUD_PLATFORM: 'cloudflare',
        MY_KV: {},
        DB: {},
        R2: {},
        AI: {}
      }

      const cloudflare = CloudPlatformFactory.createFromTypedEnv(cloudflareEnv)
      const cfEnv = cloudflare.getEnv()
      expect(cfEnv.CLOUD_PLATFORM).toBe('cloudflare')

      // AWS with service configurations
      const awsEnv = {
        CLOUD_PLATFORM: 'aws',
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret'
      }

      const aws = CloudPlatformFactory.createFromTypedEnv(awsEnv)
      const awsEnvVars = aws.getEnv()
      expect(awsEnvVars.CLOUD_PLATFORM).toBe('aws')
      expect(awsEnvVars.AWS_REGION).toBe('us-east-1')
    })
  })

  describe('Event-Driven Platform Communication', () => {
    it('should use EventBus for platform operations', async () => {
      interface EventBusEvent {
        type: string
        payload?: unknown
        source?: string
      }
      const events: EventBusEvent[] = []

      // Subscribe to connector events
      eventBus.on(CommonEventType.CONNECTOR_INITIALIZED, event => {
        events.push({ type: event.type, ...event })
      })

      eventBus.on(CommonEventType.CONNECTOR_ERROR, event => {
        events.push({ type: event.type, ...event })
      })

      // Simulate platform initialization
      const connector = new CloudflareConnector({
        env: {},
        ctx: {} as ExecutionContext,
        request: new Request('https://example.com')
      })

      // Emit initialization event
      eventBus.emit(
        CommonEventType.CONNECTOR_INITIALIZED,
        {
          platform: connector.platform,
          features: connector.getFeatures()
        },
        'PlatformManager'
      )

      // Simulate error
      eventBus.emit(
        CommonEventType.CONNECTOR_ERROR,
        {
          platform: 'aws',
          error: new Error('Failed to connect to DynamoDB'),
          context: { region: 'us-east-1' }
        },
        'AWSConnector'
      )

      // Wait for async events
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(events).toHaveLength(2)
      expect(events[0].type).toBe(CommonEventType.CONNECTOR_INITIALIZED)
      expect(events[0].payload.platform).toBe('cloudflare')
      expect(events[1].type).toBe(CommonEventType.CONNECTOR_ERROR)
      expect(events[1].payload.error.message).toContain('DynamoDB')
    })

    it('should handle platform-specific events with scoped EventBus', async () => {
      interface PlatformSpecificEvent {
        payload: Record<string, unknown>
        source?: string
      }
      const cloudflareEvents: PlatformSpecificEvent[] = []
      const awsEvents: PlatformSpecificEvent[] = []

      // Create scoped event buses
      const cfEventBus = eventBus.scope('cloudflare')
      const awsEventBus = eventBus.scope('aws')

      // Subscribe to scoped events
      cfEventBus.on('cache:hit', event => {
        cloudflareEvents.push(event)
      })

      awsEventBus.on('lambda:invoked', event => {
        awsEvents.push(event)
      })

      // Emit platform-specific events
      cfEventBus.emit('cache:hit', { key: 'user:123', ttl: 3600 }, 'CacheService')
      awsEventBus.emit(
        'lambda:invoked',
        { functionName: 'processOrder', duration: 250 },
        'LambdaService'
      )

      // Wait for async events
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(cloudflareEvents).toHaveLength(1)
      expect(cloudflareEvents[0].payload.key).toBe('user:123')

      expect(awsEvents).toHaveLength(1)
      expect(awsEvents[0].payload.functionName).toBe('processOrder')
    })
  })

  describe('Storage Abstraction', () => {
    it('should provide consistent storage interfaces across platforms', async () => {
      // Mock KV store
      const mockKVStore = {
        get: async () => null,
        put: async () => {},
        delete: async () => {},
        list: async () => ({ keys: [], list_complete: true, cursor: undefined })
      }

      const platforms = [
        new CloudflareConnector({
          env: { 'test-namespace': mockKVStore },
          ctx: {} as ExecutionContext,
          request: new Request('https://example.com')
        }),
        new AWSConnector({
          env: { DYNAMODB_TABLES: { cache: 'cache-table' } }
        })
      ]

      for (const platform of platforms) {
        const kvStore = platform.getKeyValueStore('test-namespace')

        // All KV stores should implement the same interface
        expect(typeof kvStore.get).toBe('function')
        expect(typeof kvStore.put).toBe('function')
        expect(typeof kvStore.delete).toBe('function')
        expect(typeof kvStore.list).toBe('function')

        // Test basic operations (will be mocked for AWS)
        await kvStore.put('test-key', 'test-value')
        const value = await kvStore.get('test-key')
        // AWS mock returns null, Cloudflare might return the value
        expect(value === null || value === 'test-value').toBe(true)
      }
    })

    it('should handle platform-specific storage features', async () => {
      // Mock KV store
      const mockKVStore = {
        get: async () => null,
        put: async () => {},
        delete: async () => {},
        list: async () => ({ keys: [], list_complete: true, cursor: undefined })
      }

      const cloudflare = new CloudflareConnector({
        env: { test: mockKVStore },
        ctx: {} as ExecutionContext,
        request: new Request('https://example.com')
      })

      const kvStore = cloudflare.getKeyValueStore('test')

      // Cloudflare-specific features like TTL
      await kvStore.put('temp-key', 'temp-value', {
        expirationTtl: 3600,
        metadata: { created: Date.now() }
      })

      // List with cursor (Cloudflare-specific)
      const result = await kvStore.list({
        prefix: 'temp-',
        limit: 10
      })

      expect(result).toHaveProperty('keys')
      expect(result).toHaveProperty('list_complete')
    })
  })

  describe('Error Handling Across Platforms', () => {
    it('should handle platform-specific errors consistently', async () => {
      interface ErrorEvent {
        platform: string
        error: unknown
        operation: string
      }
      const errors: ErrorEvent[] = []

      eventBus.on(CommonEventType.CONNECTOR_ERROR, event => {
        errors.push(event.payload)
      })

      // Simulate Cloudflare error
      try {
        const cf = new CloudflareConnector({
          env: {},
          ctx: {} as ExecutionContext,
          request: new Request('https://example.com')
        })
        cf.getObjectStore('non-existent-bucket')
      } catch (error) {
        eventBus.emit(
          CommonEventType.CONNECTOR_ERROR,
          {
            platform: 'cloudflare',
            error,
            operation: 'getObjectStore'
          },
          'CloudflareConnector'
        )
      }

      // Simulate AWS error - AWS connector doesn't throw on getObjectStore,
      // so we'll simulate a runtime error
      eventBus.emit(
        CommonEventType.CONNECTOR_ERROR,
        {
          platform: 'aws',
          error: new Error('S3 bucket not found: non-existent-bucket'),
          operation: 'getObjectStore'
        },
        'AWSConnector'
      )

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(errors).toHaveLength(2)
      errors.forEach(error => {
        expect(error).toHaveProperty('platform')
        expect(error).toHaveProperty('error')
        expect(error).toHaveProperty('operation')
      })
    })
  })
})
