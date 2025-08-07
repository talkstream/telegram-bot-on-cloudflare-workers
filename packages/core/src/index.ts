/**
 * @wireframe/core - Vendor-agnostic core for AI Assistant Ecosystem
 *
 * Zero vendor dependencies, pure TypeScript
 * Target: < 100KB bundle size
 */

export * from './events'
export * from './interfaces'
export * from './plugins'
export * from './registry'
export { Wireframe } from './wireframe'

// Version
export const VERSION = '2.0.0-alpha.1'
