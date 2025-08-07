/**
 * Admin Panel Router
 *
 * Routes for administrative interface
 */

import { Hono } from 'hono'

import type { Env } from '../../config/env'

/**
 * Create admin router
 */
export async function createAdminRouter() {
  const app = new Hono<{ Bindings: Env }>()

  // Admin dashboard
  app.get('/admin', c => {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Wireframe Admin</title>
        </head>
        <body>
          <h1>Admin Panel</h1>
          <p>Admin interface is under construction</p>
        </body>
      </html>
    `)
  })

  // Admin API endpoints
  app.get('/admin/api/stats', c => {
    return c.json({
      status: 'ok',
      stats: {
        version: '1.4.0',
        uptime: process.uptime?.() || 0
      }
    })
  })

  return app
}
