import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  areServicesInitialized,
  getAIConnector,
  getDatabaseStore,
  getKeyValueStore,
  getKVCache,
  getMessagingConnector,
  getRoleService,
  getServiceStats,
  initializeServiceContainer,
  resetServices
} from '../service-container'

import type { Env } from '@/config/env'
import { MockAIConnector } from '@/connectors/ai/mock-ai-connector'
import { MockTelegramConnector } from '@/connectors/messaging/telegram/mock-telegram-connector'
import { getCloudPlatformConnector } from '@/core/cloud/cloud-platform-cache'
import { UniversalRoleService } from '@/core/services/role-service'
import { KVCache } from '@/lib/cache/kv-cache'

// Mock dependencies
vi.mock('@/core/cloud/cloud-platform-cache', () => ({
  getCloudPlatformConnector: vi.fn(() => ({
    getDatabaseStore: vi.fn(() => ({
      prepare: vi.fn(),
      exec: vi.fn(),
      batch: vi.fn()
    })),
    getKeyValueStore: vi.fn(() => ({
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn()
    }))
  }))
}))

vi.mock('@/lib/env-guards', () => ({
  isDemoMode: vi.fn(() => true),
  getBotToken: vi.fn(() => null)
}))

describe('Service Container', () => {
  let testEnv: Env

  beforeEach(() => {
    resetServices()
    vi.clearAllMocks()

    // Reset to default mock implementation
    vi.mocked(getCloudPlatformConnector).mockImplementation(
      () =>
        ({
          env: {
            DB: {
              prepare: vi.fn(() => ({
                bind: vi.fn(() => ({
                  run: vi.fn(),
                  first: vi.fn(),
                  all: vi.fn()
                }))
              })),
              exec: vi.fn(),
              batch: vi.fn()
            }
          },
          getDatabaseStore: vi.fn(() => ({
            prepare: vi.fn(),
            exec: vi.fn(),
            batch: vi.fn()
          })),
          getKeyValueStore: vi.fn(() => ({
            get: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            list: vi.fn()
          }))
        }) as ReturnType<typeof getCloudPlatformConnector>
    )

    testEnv = {
      CLOUD_PLATFORM: 'cloudflare',
      ENVIRONMENT: 'test',
      BOT_TOKEN: 'test-token',
      BOT_OWNER_IDS: '123456789,987654321'
    } as Env
  })

  describe('Initialization', () => {
    it('should initialize container with environment', () => {
      expect(areServicesInitialized()).toBe(false)

      initializeServiceContainer(testEnv)

      expect(areServicesInitialized()).toBe(true)
    })

    it('should not create services on initialization', () => {
      initializeServiceContainer(testEnv)

      const stats = getServiceStats()
      expect(stats.core.initialized).toEqual([])
    })
  })

  describe('Lazy Service Creation', () => {
    beforeEach(() => {
      initializeServiceContainer(testEnv)
    })

    it('should create RoleService on first access', () => {
      const stats1 = getServiceStats()
      expect(stats1.core.initialized).not.toContain('roleService')

      const roleService = getRoleService()

      expect(roleService).toBeInstanceOf(UniversalRoleService)

      const stats2 = getServiceStats()
      expect(stats2.core.initialized).toContain('roleService')
    })

    it('should create AIConnector on first access', () => {
      const aiConnector = getAIConnector()

      expect(aiConnector).toBeInstanceOf(MockAIConnector)

      const stats = getServiceStats()
      expect(stats.core.initialized).toContain('aiConnector')
    })

    it('should create MessagingConnector on first access', () => {
      const messagingConnector = getMessagingConnector()

      expect(messagingConnector).toBeInstanceOf(MockTelegramConnector)

      const stats = getServiceStats()
      expect(stats.core.initialized).toContain('messagingConnector')
    })

    it('should create KVCache on first access', () => {
      const kvCache = getKVCache()

      expect(kvCache).toBeInstanceOf(KVCache)

      const stats = getServiceStats()
      expect(stats.core.initialized).toContain('kvCache')
    })

    it('should reuse same instance on multiple calls', () => {
      const role1 = getRoleService()
      const role2 = getRoleService()

      expect(role1).toBe(role2)
    })
  })

  describe('Database and KV Store', () => {
    beforeEach(() => {
      initializeServiceContainer(testEnv)
    })

    it('should lazily initialize database store', () => {
      const db1 = getDatabaseStore()
      const db2 = getDatabaseStore()

      expect(db1).toBeTruthy()
      expect(db1).toBe(db2)
    })

    it('should lazily initialize KV store', () => {
      const kv1 = getKeyValueStore()
      const kv2 = getKeyValueStore()

      expect(kv1).toBeTruthy()
      expect(kv1).toBe(kv2)
    })
  })

  describe('Service Statistics', () => {
    beforeEach(() => {
      initializeServiceContainer(testEnv)
    })

    it('should track service initialization', () => {
      const stats1 = getServiceStats()
      expect(stats1.core.initialized).toEqual([])
      expect(stats1.core.registered).toContain('roleService')
      expect(stats1.core.registered).toContain('aiConnector')
      expect(stats1.core.registered).toContain('messagingConnector')
      expect(stats1.core.registered).toContain('kvCache')

      getRoleService()
      getAIConnector()

      const stats2 = getServiceStats()
      expect(stats2.core.initialized).toEqual(['roleService', 'aiConnector'])
      expect(stats2.core.creationTimes.roleService).toBeGreaterThanOrEqual(0)
      expect(stats2.core.creationTimes.aiConnector).toBeGreaterThanOrEqual(0)
    })

    it('should track initialization times', () => {
      getRoleService()

      const stats = getServiceStats()
      expect(stats.core.creationTimes.roleService).toBeDefined()
      expect(stats.core.creationTimes.roleService).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Reset Functionality', () => {
    it('should reset all services and config', () => {
      initializeServiceContainer(testEnv)
      getRoleService()
      getAIConnector()

      const stats1 = getServiceStats()
      expect(stats1.core.initialized.length).toBe(2)

      resetServices()

      expect(areServicesInitialized()).toBe(false)
      const stats2 = getServiceStats()
      expect(stats2.core.initialized).toEqual([])
    })

    it('should create new instances after reset', () => {
      initializeServiceContainer(testEnv)
      const role1 = getRoleService()

      resetServices()
      initializeServiceContainer(testEnv)

      const role2 = getRoleService()
      expect(role1).not.toBe(role2)
    })
  })

  describe('Error Handling', () => {
    it('should throw error when environment not configured', () => {
      expect(() => getRoleService()).toThrow()
    })

    it('should handle database initialization errors gracefully', () => {
      // Mock platform to throw error
      const mockErrorPlatform = {
        getDatabaseStore: vi.fn(() => {
          throw new Error('DB connection failed')
        }),
        getKeyValueStore: vi.fn(() => null)
      }

      // Mock the getCloudPlatformConnector to return error platform
      vi.mocked(getCloudPlatformConnector).mockReturnValue(
        mockErrorPlatform as ReturnType<typeof getCloudPlatformConnector>
      )

      initializeServiceContainer(testEnv)
      const db = getDatabaseStore()

      expect(db).toBeNull()
    })
  })

  describe('Memory Efficiency', () => {
    it('should only initialize required services', () => {
      initializeServiceContainer(testEnv)

      // Simulate a simple command that only needs role service
      getRoleService()

      const stats = getServiceStats()
      expect(stats.core.initialized).toEqual(['roleService'])

      // Other services not initialized, saving memory
      expect(stats.core.initialized).not.toContain('aiConnector')
      expect(stats.core.initialized).not.toContain('messagingConnector')
      expect(stats.core.initialized).not.toContain('kvCache')
    })

    it('should demonstrate lazy loading pattern', () => {
      initializeServiceContainer(testEnv)

      // Command 1: Only needs messaging
      getMessagingConnector()
      let stats = getServiceStats()
      expect(stats.core.initialized).toEqual(['messagingConnector'])

      // Command 2: Needs AI
      getAIConnector()
      stats = getServiceStats()
      // Order doesn't matter, just check both are present
      expect(stats.core.initialized).toHaveLength(2)
      expect(stats.core.initialized).toContain('messagingConnector')
      expect(stats.core.initialized).toContain('aiConnector')

      // Command 3: Needs cache
      getKVCache()
      stats = getServiceStats()
      expect(stats.core.initialized).toHaveLength(3)
      expect(stats.core.initialized).toContain('messagingConnector')
      expect(stats.core.initialized).toContain('aiConnector')
      expect(stats.core.initialized).toContain('kvCache')
    })
  })
})
