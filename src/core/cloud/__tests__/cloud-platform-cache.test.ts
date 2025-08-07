import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearCloudPlatformCache,
  getCloudPlatformCacheStats,
  getCloudPlatformConnector
} from '../cloud-platform-cache'
import { CloudPlatformFactory } from '../platform-factory'

import type { Env } from '@/config/env'

// Mock CloudPlatformFactory
vi.mock('../platform-factory', () => ({
  CloudPlatformFactory: {
    createFromTypedEnv: vi.fn()
  }
}))

describe('CloudPlatform Cache', () => {
  beforeEach(() => {
    clearCloudPlatformCache()
    vi.clearAllMocks()
  })

  it('should return same instance for same environment', () => {
    const env: Env = {
      CLOUD_PLATFORM: 'cloudflare',
      ENVIRONMENT: 'production'
    } as Env

    const mockConnector = { platform: 'cloudflare', id: 'test-1' }
    vi.mocked(CloudPlatformFactory.createFromTypedEnv).mockReturnValue(mockConnector)

    const instance1 = getCloudPlatformConnector(env)
    const instance2 = getCloudPlatformConnector(env)

    expect(instance1).toBe(instance2)
    expect(CloudPlatformFactory.createFromTypedEnv).toHaveBeenCalledTimes(1)
  })

  it('should return different instances for different environments', () => {
    const env1: Env = {
      CLOUD_PLATFORM: 'cloudflare',
      ENVIRONMENT: 'development'
    } as Env

    const env2: Env = {
      CLOUD_PLATFORM: 'cloudflare',
      ENVIRONMENT: 'production'
    } as Env

    const mockConnector1 = { platform: 'cloudflare', id: 'dev' }
    const mockConnector2 = { platform: 'cloudflare', id: 'prod' }

    vi.mocked(CloudPlatformFactory.createFromTypedEnv)
      .mockReturnValueOnce(mockConnector1)
      .mockReturnValueOnce(mockConnector2)

    const instance1 = getCloudPlatformConnector(env1)
    const instance2 = getCloudPlatformConnector(env2)

    expect(instance1).not.toBe(instance2)
    expect(instance1.id).toBe('dev')
    expect(instance2.id).toBe('prod')
  })

  it('should call factory only once per environment', () => {
    const env: Env = {
      CLOUD_PLATFORM: 'cloudflare',
      ENVIRONMENT: 'test'
    } as Env

    const mockConnector = { platform: 'cloudflare' }
    vi.mocked(CloudPlatformFactory.createFromTypedEnv).mockReturnValue(mockConnector)

    // Multiple calls with same environment
    getCloudPlatformConnector(env)
    getCloudPlatformConnector(env)
    getCloudPlatformConnector(env)

    expect(CloudPlatformFactory.createFromTypedEnv).toHaveBeenCalledTimes(1)
  })

  it('should handle different platforms correctly', () => {
    const cfEnv: Env = {
      CLOUD_PLATFORM: 'cloudflare',
      ENVIRONMENT: 'production'
    } as Env

    const awsEnv: Env = {
      CLOUD_PLATFORM: 'aws',
      ENVIRONMENT: 'production'
    } as Env

    const cfConnector = { platform: 'cloudflare' }
    const awsConnector = { platform: 'aws' }

    vi.mocked(CloudPlatformFactory.createFromTypedEnv)
      .mockReturnValueOnce(cfConnector)
      .mockReturnValueOnce(awsConnector)

    const cf = getCloudPlatformConnector(cfEnv)
    const aws = getCloudPlatformConnector(awsEnv)

    expect(cf.platform).toBe('cloudflare')
    expect(aws.platform).toBe('aws')
    expect(CloudPlatformFactory.createFromTypedEnv).toHaveBeenCalledTimes(2)
  })

  it('should use default values when environment fields are missing', () => {
    const env: Env = {} as Env

    const mockConnector = { platform: 'cloudflare' }
    vi.mocked(CloudPlatformFactory.createFromTypedEnv).mockReturnValue(mockConnector)

    getCloudPlatformConnector(env)

    // Should create cache key with defaults: cloudflare_production
    const stats = getCloudPlatformCacheStats()
    expect(stats.size).toBe(1)
    expect(stats.keys).toContain('cloudflare_production')
  })

  it('should clear cache correctly', () => {
    const env: Env = {
      CLOUD_PLATFORM: 'cloudflare',
      ENVIRONMENT: 'test'
    } as Env

    const mockConnector = { platform: 'cloudflare' }
    vi.mocked(CloudPlatformFactory.createFromTypedEnv).mockReturnValue(mockConnector)

    getCloudPlatformConnector(env)
    expect(getCloudPlatformCacheStats().size).toBe(1)

    clearCloudPlatformCache()
    expect(getCloudPlatformCacheStats().size).toBe(0)
  })

  it('should provide accurate cache statistics', () => {
    const env1: Env = {
      CLOUD_PLATFORM: 'cloudflare',
      ENVIRONMENT: 'dev'
    } as Env

    const env2: Env = {
      CLOUD_PLATFORM: 'aws',
      ENVIRONMENT: 'prod'
    } as Env

    vi.mocked(CloudPlatformFactory.createFromTypedEnv).mockReturnValue({ platform: 'mock' })

    getCloudPlatformConnector(env1)
    getCloudPlatformConnector(env2)

    const stats = getCloudPlatformCacheStats()
    expect(stats.size).toBe(2)
    expect(stats.keys).toContain('cloudflare_dev')
    expect(stats.keys).toContain('aws_prod')
  })

  it('should handle rapid concurrent calls efficiently', async () => {
    const env: Env = {
      CLOUD_PLATFORM: 'cloudflare',
      ENVIRONMENT: 'production'
    } as Env

    const mockConnector = { platform: 'cloudflare' }
    vi.mocked(CloudPlatformFactory.createFromTypedEnv).mockReturnValue(mockConnector)

    // Simulate concurrent calls
    const promises = Array.from({ length: 100 }, () =>
      Promise.resolve(getCloudPlatformConnector(env))
    )

    const connectors = await Promise.all(promises)

    // All should be the same instance
    const firstConnector = connectors[0]
    connectors.forEach(connector => {
      expect(connector).toBe(firstConnector)
    })

    // Factory should be called only once
    expect(CloudPlatformFactory.createFromTypedEnv).toHaveBeenCalledTimes(1)
  })
})
