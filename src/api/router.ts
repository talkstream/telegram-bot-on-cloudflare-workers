/**
 * API Router
 *
 * REST API endpoints
 */

import { Hono } from 'hono'

import type { Env } from '../config/env'

/**
 * Create API router
 */
export async function createApiRouter() {
  const app = new Hono<{ Bindings: Env }>()

  // API info
  app.get('/api', c => {
    return c.json({
      name: 'Wireframe API',
      version: '1.4.0',
      endpoints: ['/api/health', '/api/stats']
    })
  })

  // Health endpoint
  app.get('/api/health', c => {
    return c.json({
      status: 'healthy',
      timestamp: Date.now()
    })
  })

  // Stats endpoint
  app.get('/api/stats', c => {
    return c.json({
      requests: 0,
      errors: 0,
      uptime: process.uptime?.() || 0
    })
  })

  return app
}
