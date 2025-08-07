/**
 * Mock context utilities for admin panel tests
 */

import { vi } from 'vitest'

export interface MockAdminRequest extends Request {
  adminId?: number
  isAuthenticated?: boolean
}

export function createMockAdminRequest(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: BodyInit
    adminId?: number
    isAuthenticated?: boolean
  } = {}
): MockAdminRequest {
  const request = new Request(url, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body
  }) as MockAdminRequest

  request.adminId = options.adminId
  request.isAuthenticated = options.isAuthenticated

  return request
}

export function createMockFormData(data: Record<string, string>): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value)
  }
  return formData
}

export function createMockKVNamespace(): KVNamespace {
  const store = new Map<string, string>()

  return {
    get: vi.fn(async (key: string) => store.get(key) || null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key)
    }),
    list: vi.fn(async () => ({
      keys: Array.from(store.keys()).map(name => ({ name })),
      list_complete: true,
      cursor: ''
    })),
    getWithMetadata: vi.fn(async (key: string) => ({
      value: store.get(key) || null,
      metadata: null
    }))
  } as unknown as KVNamespace
}
