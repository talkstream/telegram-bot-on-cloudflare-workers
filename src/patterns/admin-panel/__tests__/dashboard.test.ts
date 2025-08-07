import { beforeEach, describe, expect, it, vi } from 'vitest'

import { handleAdminDashboard } from '../handlers/dashboard'
import type { AdminEnv, AdminRequest } from '../types'

import { createMockPreparedStatement } from './test-helpers'

describe('Admin Dashboard', () => {
  let mockEnv: AdminEnv
  let mockRequest: AdminRequest

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock environment
    mockEnv = {
      DB: {
        prepare: vi.fn().mockReturnValue(createMockPreparedStatement()),
        dump: vi.fn(),
        batch: vi.fn(),
        exec: vi.fn()
      },
      SESSIONS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        getWithMetadata: vi.fn()
      },
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_WEBHOOK_SECRET: 'test-secret',
      BOT_ADMIN_IDS: [123456789]
    } as unknown as AdminEnv

    // Create mock request
    mockRequest = new Request('https://example.com/admin/dashboard') as AdminRequest
    mockRequest.adminId = 123456789
    mockRequest.isAuthenticated = true
  })

  it('should render dashboard page', async () => {
    const response = await handleAdminDashboard(mockRequest, mockEnv)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')

    const html = await response.text()
    expect(html).toContain('Dashboard')
    expect(html).toContain('stat-grid')
  })

  it('should display stats from database', async () => {
    // Mock database query for stats
    vi.mocked(mockEnv.DB.prepare).mockImplementation((query: string) => {
      if (query.includes('COUNT(*)')) {
        return createMockPreparedStatement({
          first: vi.fn().mockResolvedValue({ total: 42 })
        })
      }
      return createMockPreparedStatement()
    })

    const response = await handleAdminDashboard(mockRequest, mockEnv)
    const html = await response.text()

    expect(html).toContain('42')
  })

  it('should handle missing database gracefully', async () => {
    const envWithoutDB = { ...mockEnv, DB: undefined }

    const response = await handleAdminDashboard(mockRequest, envWithoutDB as AdminEnv)

    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('Dashboard')
  })

  it('should include quick action links', async () => {
    const response = await handleAdminDashboard(mockRequest, mockEnv)
    const html = await response.text()

    expect(html).toContain('href="/admin/users"')
    expect(html).toContain('Manage Users')
  })
})
