import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  getCloudPlatformConnector,
  clearCloudPlatformCache,
  getCloudPlatformCacheStats,
} from '../cloud-platform-cache';

import type { Env } from '@/config/env';
import type { CloudflareEnv } from '@/types/env';

// Import the actual module to test

describe('CloudPlatform Cache', () => {
  beforeEach(() => {
    clearCloudPlatformCache();
  });

  afterEach(() => {
    clearCloudPlatformCache();
  });

  it('should return same instance for same environment', () => {
    const env: Env = {
      CLOUD_PLATFORM: 'cloudflare',
      ENVIRONMENT: 'production',
      DB: {},
      CACHE: {},
    } as Env;

    const instance1 = getCloudPlatformConnector(env);
    const instance2 = getCloudPlatformConnector(env);

    expect(instance1).toBe(instance2);
    expect(instance1.platform).toBe('cloudflare');
  });

  it('should return different instances for different environments', () => {
    const env1: Env = {
      CLOUD_PLATFORM: 'cloudflare',
      ENVIRONMENT: 'development',
      DB: {},
      CACHE: {},
    } as Env;

    const env2: Env = {
      CLOUD_PLATFORM: 'cloudflare',
      ENVIRONMENT: 'production',
      DB: {},
      CACHE: {},
    } as Env;

    const instance1 = getCloudPlatformConnector(env1);
    const instance2 = getCloudPlatformConnector(env2);

    expect(instance1).not.toBe(instance2);
    expect(instance1.platform).toBe('cloudflare');
    expect(instance2.platform).toBe('cloudflare');
  });

  it('should cache instances properly', () => {
    const env = {
      CLOUD_PLATFORM: 'cloudflare',
      ENVIRONMENT: 'development',
      DB: {},
      CACHE: {},
    } as unknown as CloudflareEnv;

    // First call - creates new instance
    const instance1 = getCloudPlatformConnector(env);
    const stats1 = getCloudPlatformCacheStats();
    expect(stats1.size).toBe(1);

    // Multiple calls with same environment - should return cached instance
    const instance2 = getCloudPlatformConnector(env);
    const instance3 = getCloudPlatformConnector(env);

    expect(instance2).toBe(instance1);
    expect(instance3).toBe(instance1);

    // Cache should still have only 1 entry
    const stats2 = getCloudPlatformCacheStats();
    expect(stats2.size).toBe(1);
  });

  it('should handle cloudflare platform correctly', () => {
    const cfEnv: Env = {
      CLOUD_PLATFORM: 'cloudflare',
      ENVIRONMENT: 'production',
      DB: {},
      CACHE: {},
    } as Env;

    const cf = getCloudPlatformConnector(cfEnv);
    expect(cf.platform).toBe('cloudflare');

    // Should have cloudflare features
    const features = cf.getFeatures();
    expect(features.hasEdgeCache).toBe(true);
  });

  it('should use default values when environment fields are missing', () => {
    const env: Env = {
      DB: {},
      CACHE: {},
    } as Env;

    getCloudPlatformConnector(env);

    // Should create cache key with defaults: cloudflare_production
    const stats = getCloudPlatformCacheStats();
    expect(stats.size).toBe(1);
    expect(stats.keys).toContain('cloudflare_production');
  });

  it('should clear cache correctly', () => {
    const env = {
      CLOUD_PLATFORM: 'cloudflare',
      ENVIRONMENT: 'development',
      DB: {},
      CACHE: {},
    } as unknown as CloudflareEnv;

    getCloudPlatformConnector(env);
    expect(getCloudPlatformCacheStats().size).toBe(1);

    clearCloudPlatformCache();
    expect(getCloudPlatformCacheStats().size).toBe(0);
  });

  it('should provide accurate cache statistics', () => {
    const env1 = {
      CLOUD_PLATFORM: 'cloudflare',
      ENVIRONMENT: 'development',
      DB: {},
      CACHE: {},
    } as unknown as CloudflareEnv;

    const env2 = {
      CLOUD_PLATFORM: 'cloudflare',
      ENVIRONMENT: 'production',
      DB: {},
      CACHE: {},
    } as unknown as CloudflareEnv;

    getCloudPlatformConnector(env1);
    getCloudPlatformConnector(env2);

    const stats = getCloudPlatformCacheStats();
    expect(stats.size).toBe(2);
    expect(stats.keys).toContain('cloudflare_development');
    expect(stats.keys).toContain('cloudflare_production');
  });

  it('should handle rapid concurrent calls efficiently', async () => {
    const env: Env = {
      CLOUD_PLATFORM: 'cloudflare',
      ENVIRONMENT: 'production',
      DB: {},
      CACHE: {},
    } as Env;

    // Simulate concurrent calls
    const promises = Array.from({ length: 100 }, () =>
      Promise.resolve(getCloudPlatformConnector(env)),
    );

    const connectors = await Promise.all(promises);

    // All should be the same instance
    const firstConnector = connectors[0];
    connectors.forEach((connector) => {
      expect(connector).toBe(firstConnector);
    });

    // Cache should have only one entry
    const stats = getCloudPlatformCacheStats();
    expect(stats.size).toBe(1);
  });
});
