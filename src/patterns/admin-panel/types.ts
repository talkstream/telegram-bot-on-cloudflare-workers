/**
 * Type definitions for the admin panel pattern
 */

export interface AdminRequest extends Request {
  adminId?: number
  isAuthenticated?: boolean
}

export interface AdminSession {
  adminId: number
  createdAt: number
  expiresAt: number
}

export interface AuthState {
  token: string
  expiresAt: number
}

export interface LayoutOptions {
  title: string
  content: string
  activeMenu?: string
  adminId?: number
}

export interface LoginPageOptions {
  error?: string
  showCodeInput?: boolean
  telegramId?: string
}

export interface DashboardStats {
  [key: string]: {
    label: string
    value: number | string
    icon?: string
  }
}

export interface AdminEnv {
  // Required
  BOT_TOKEN: string
  BOT_OWNER_IDS: string
  SESSIONS: KVNamespace

  // Optional - your bot might have these
  DB?: D1Database
  CACHE?: KVNamespace

  // Add your own environment variables
  [key: string]: unknown
}
