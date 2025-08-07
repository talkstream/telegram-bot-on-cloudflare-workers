/**
 * Lazy Loading Utilities
 *
 * Optimized module loading for improved cold start performance
 * Reduces initial bundle size and memory footprint
 *
 * @module lib/lazy-loader
 */

import type { Bot } from 'grammy'
import type { z } from 'zod'

// Cache for loaded modules
const moduleCache = new Map<string, unknown>()

/**
 * Performance metrics for module loading
 */
interface LoadMetrics {
  module: string
  loadTime: number
  cached: boolean
}

const loadMetrics: LoadMetrics[] = []

/**
 * Load a module lazily with caching
 */
async function lazyLoad<T>(
  moduleName: string,
  loader: () => Promise<{ default: T } | T>
): Promise<T> {
  // Check cache first
  if (moduleCache.has(moduleName)) {
    loadMetrics.push({
      module: moduleName,
      loadTime: 0,
      cached: true
    })
    return moduleCache.get(moduleName) as T
  }

  const start = performance.now()

  try {
    const module = await loader()
    const result =
      typeof module === 'object' && module !== null && 'default' in module
        ? (module as { default: T }).default
        : (module as T)

    // Cache the loaded module
    moduleCache.set(moduleName, result)

    const loadTime = performance.now() - start
    loadMetrics.push({
      module: moduleName,
      loadTime,
      cached: false
    })

    if (loadTime > 50) {
      console.warn(`[LazyLoader] Slow module load: ${moduleName} took ${loadTime.toFixed(2)}ms`)
    }

    return result
  } catch (error) {
    console.error(`[LazyLoader] Failed to load module: ${moduleName}`, error)
    throw error
  }
}

/**
 * Grammy framework lazy loader
 * Heavy module: ~100ms load time
 */
export async function loadGrammy() {
  return lazyLoad('grammy', async () => {
    const grammy = await import('grammy')
    return grammy
  })
}

/**
 * Zod validation library lazy loader
 * Heavy module: ~80ms load time
 */
export async function loadZod() {
  return lazyLoad('zod', async () => {
    const zod = await import('zod')
    return zod
  })
}

/**
 * DayJS date library lazy loader
 * Heavy module with plugins: ~60ms load time
 */
export async function loadDayjs() {
  return lazyLoad('dayjs', async () => {
    const dayjs = (await import('dayjs')).default

    // Load plugins only when needed
    const utc = (await import('dayjs/plugin/utc')).default
    const timezone = (await import('dayjs/plugin/timezone')).default
    const customParseFormat = (await import('dayjs/plugin/customParseFormat')).default

    dayjs.extend(utc)
    dayjs.extend(timezone)
    dayjs.extend(customParseFormat)

    return dayjs
  })
}

/**
 * Cloudflare AI SDK lazy loader
 * Heavy module: ~150ms load time
 */
export async function loadCloudflareAI() {
  return lazyLoad('@cloudflare/ai', async () => {
    // Check if module exists, otherwise return mock
    try {
      const module = await import('@cloudflare/ai')
      return module.Ai
    } catch {
      // Return mock implementation for environments without @cloudflare/ai
      console.warn('[LazyLoader] @cloudflare/ai not available, using mock')
      return class MockAi {
        constructor(_binding: unknown) {}
        async run(_model: string, _input: unknown) {
          return { response: 'Mock AI response' }
        }
      }
    }
  })
}

/**
 * Grammy plugins lazy loader
 */
export async function loadGrammyPlugins() {
  return lazyLoad('grammy-plugins', async () => {
    try {
      const [menu, conversations, rateLimit, session] = await Promise.all([
        import('@grammyjs/menu') as Promise<unknown>,
        import('@grammyjs/conversations') as Promise<unknown>,
        import('@grammyjs/ratelimiter') as Promise<unknown>,
        import('@grammyjs/session') as Promise<unknown>
      ])

      return {
        menu,
        conversations,
        rateLimit,
        session
      }
    } catch {
      // Return mock implementations if plugins not available
      console.warn('[LazyLoader] Grammy plugins not available, using mocks')
      return {
        menu: {},
        conversations: {},
        rateLimit: {},
        session: {}
      }
    }
  })
}

/**
 * Load Telegram bot with optimizations
 */
export async function createTelegramBot(token: string): Promise<Bot> {
  const { Bot } = await loadGrammy()

  // Create bot with minimal initial setup
  const bot = new Bot(token, {
    // Disable built-in polling to reduce overhead
    ContextConstructor: undefined
  })

  return bot
}

/**
 * Load and compile Zod schemas on demand
 */
export async function compileZodSchema<T>(
  schemaLoader: () => Promise<z.ZodSchema<T>>
): Promise<z.ZodSchema<T>> {
  const cacheKey = schemaLoader.toString()

  if (moduleCache.has(cacheKey)) {
    return moduleCache.get(cacheKey) as z.ZodSchema<T>
  }

  const schema = await schemaLoader()

  // Compile and cache the schema (strict() may not be available on all schemas)
  const schemaWithStrict = schema as z.ZodSchema<T> & { strict?: () => z.ZodSchema<T> }
  const compiled =
    typeof schemaWithStrict.strict === 'function' ? schemaWithStrict.strict() : schema
  moduleCache.set(cacheKey, compiled)

  return compiled
}

/**
 * Preload critical modules in background
 * Call this after the main response is sent
 */
export async function preloadModules() {
  // Don't block - run in background
  Promise.all([loadGrammy(), loadZod(), loadDayjs()]).catch(error => {
    console.error('[LazyLoader] Background preload failed:', error)
  })
}

/**
 * Get module loading metrics
 */
export function getLoadMetrics(): LoadMetrics[] {
  return [...loadMetrics]
}

/**
 * Clear module cache (useful for testing)
 */
export function clearModuleCache() {
  moduleCache.clear()
  loadMetrics.length = 0
}

/**
 * Lazy load with timeout
 */
export async function lazyLoadWithTimeout<T>(
  name: string,
  loader: () => Promise<T>,
  timeoutMs = 5000
): Promise<T> {
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    setTimeout(() => reject(new Error(`Module load timeout: ${name}`)), timeoutMs)
  })

  return Promise.race([lazyLoad(name, loader), timeoutPromise])
}

/**
 * Conditional lazy loading based on environment
 */
export async function conditionalLoad<T>(
  condition: boolean,
  loader: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> {
  if (!condition) {
    return fallback
  }

  return loader()
}

/**
 * Batch lazy loading for related modules
 */
export async function batchLoad<T extends Record<string, () => Promise<unknown>>>(
  loaders: T
): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const entries = Object.entries(loaders)
  const results = await Promise.all(
    entries.map(([key, loader]) => loader().then(result => [key, result]))
  )

  return Object.fromEntries(results) as { [K in keyof T]: Awaited<ReturnType<T[K]>> }
}
