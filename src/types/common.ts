// Common types used across the application

export interface User {
  id: number
  telegramId: number
  username?: string
  firstName?: string
  lastName?: string
  languageCode?: string
  isPremium?: boolean
  createdAt: string
  updatedAt: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  version: string
  environment: string
  timestamp: string
  services: {
    database: boolean
    cache: boolean
    telegram: boolean
    ai?: boolean
  }
}

export type AsyncFunction<T = void> = (...args: unknown[]) => Promise<T>
