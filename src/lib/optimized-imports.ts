/**
 * Optimized imports for better tree-shaking
 *
 * This module provides optimized imports to reduce bundle size
 */

// Re-export only what we need from Zod
export { z } from 'zod'
export type { ZodError, ZodSchema, ZodType } from 'zod'

// Lazy load heavy dependencies
export const loadGrammy = () => import('grammy')
export const loadSentry = () => import('@sentry/cloudflare')

// Export common utilities with tree-shaking hints
export const pureFunction = /* #__PURE__ */ <T>(fn: () => T): T => fn()

// Conditional exports based on environment
export const isDevelopment = process.env.NODE_ENV === 'development'
export const isProduction = process.env.NODE_ENV === 'production'

// Bundle size optimization helpers
export const lazyImport = <T>(importFn: () => Promise<T>): (() => Promise<T>) => {
  let module: T | null = null
  return async () => {
    if (!module) {
      module = await importFn()
    }
    return module
  }
}
