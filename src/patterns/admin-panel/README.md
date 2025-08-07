# Admin Panel Pattern for Telegram Bots on Cloudflare Workers

## Overview

This document describes a pattern for implementing a web-based admin panel for Telegram bots running on Cloudflare Workers. The pattern was successfully implemented in the Kogotochki bot project.

## Key Features

1. **Web-based Interface**: HTML-based admin panel accessible via browser
2. **Authentication**: Telegram-based 2FA authentication
3. **Session Management**: KV-based session storage
4. **Database Integration**: Direct D1 database access
5. **Responsive Design**: Mobile-friendly interface
6. **TypeScript Support**: Full type safety

## Architecture

### Directory Structure

```
src/admin/
├── handlers/           # Request handlers for each admin section
│   ├── auth.ts        # Login/authentication
│   ├── dashboard.ts   # Main dashboard
│   ├── users.ts       # User management
│   └── ...            # Other sections
├── middleware/        # Middleware functions
│   └── auth.ts        # Authentication middleware
├── templates/         # HTML templates
│   └── layout.ts      # Layout wrapper
├── routes.ts          # Route definitions
└── __tests__/         # Test files
```

### Core Components

#### 1. Route Handler (`routes.ts`)

```typescript
import type { ExecutionContext } from '@cloudflare/workers-types'
import type { Env } from '@/types/env'

export interface AdminRequest extends Request {
  adminId?: number
  isAuthenticated?: boolean
}

export async function handleAdminRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname

  // Public routes
  if (path === '/admin' || path === '/admin/') {
    return handleAdminAuth(request, env)
  }

  // Check authentication
  const authResult = await requireAdminAuth(request, env)
  if (authResult instanceof Response) {
    return authResult // Redirect to login
  }

  // Authenticated routes
  const authenticatedRequest = request as AdminRequest
  authenticatedRequest.adminId = authResult.adminId
  authenticatedRequest.isAuthenticated = true

  // Route to handlers
  switch (path) {
    case '/admin/dashboard':
      return handleAdminDashboard(authenticatedRequest, env)
    case '/admin/users':
      return handleAdminUsers(authenticatedRequest, env)
    // ... other routes
    default:
      return new Response('Not Found', { status: 404 })
  }
}
```

#### 2. Authentication System

##### Login Flow (`handlers/auth.ts`)

```typescript
export async function handleAdminAuth(request: Request, env: Env): Promise<Response> {
  if (request.method === 'POST') {
    const formData = await request.formData()
    const adminId = parseInt(formData.get('admin_id') as string)
    const authCode = formData.get('auth_code') as string

    if (env.SESSIONS) {
      const storedAuth = await env.SESSIONS.get(`auth:${adminId}`)
      if (storedAuth) {
        const authState = JSON.parse(storedAuth) as AuthState
        if (authState.token === authCode && Date.now() < authState.expiresAt) {
          // Create session
          const sessionId = generateSessionId()
          const session = {
            adminId,
            createdAt: Date.now(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
          }

          await env.SESSIONS.put(`session:${sessionId}`, JSON.stringify(session), {
            expirationTtl: 86400
          })

          return new Response('Authenticated', {
            status: 302,
            headers: {
              Location: '/admin/dashboard',
              'Set-Cookie': `admin_session=${sessionId}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
            }
          })
        }
      }
    }
    // Show error
  }

  // Show login form
  return new Response(renderLoginForm(), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}
```

##### Middleware (`middleware/auth.ts`)

```typescript
export async function requireAdminAuth(
  request: Request,
  env: Env
): Promise<{ adminId: number } | Response> {
  const cookieHeader = request.headers.get('Cookie')
  if (!cookieHeader) {
    return redirectToLogin()
  }

  const sessionId = parseSessionCookie(cookieHeader)
  if (!sessionId || !env.SESSIONS) {
    return redirectToLogin()
  }

  const sessionData = await env.SESSIONS.get(`session:${sessionId}`)
  if (!sessionData) {
    return redirectToLogin()
  }

  const session = JSON.parse(sessionData) as Session
  if (Date.now() > session.expiresAt) {
    await env.SESSIONS.delete(`session:${sessionId}`)
    return redirectToLogin()
  }

  return { adminId: session.adminId }
}
```

#### 3. HTML Templates

##### Layout Template (`templates/layout.ts`)

```typescript
export interface LayoutOptions {
  title: string
  content: string
  activeMenu?: string
  adminId?: number
}

export function renderAdminLayout(options: LayoutOptions): string {
  const { title, content, activeMenu = 'dashboard', adminId } = options

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Admin Panel</title>
    <style>
        /* Inline CSS for better performance */
        /* Include Tailwind-like utility classes */
    </style>
</head>
<body>
    <div class="header">
        <!-- Header with navigation -->
    </div>
    <div class="content">
        ${content}
    </div>
</body>
</html>
  `
}
```

#### 4. Handler Example (`handlers/users.ts`)

```typescript
export async function handleAdminUsers(request: AdminRequest, env: Env): Promise<Response> {
  const url = new URL(request.url)

  // Handle POST actions
  if (request.method === 'POST') {
    const formData = await request.formData()
    const action = formData.get('action')
    const userId = formData.get('user_id')

    if (action && userId && env.DB) {
      switch (action) {
        case 'block':
          await env.DB.prepare('UPDATE users SET is_blocked = 1 WHERE id = ?')
            .bind(parseInt(userId as string))
            .run()
          break
        // ... other actions
      }
      return Response.redirect(url.toString(), 302)
    }
  }

  // Get users with pagination
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = 50
  const offset = (page - 1) * limit

  let users = []
  let total = 0

  if (env.DB) {
    const countResult = await env.DB.prepare('SELECT COUNT(*) as total FROM users').first()
    total = (countResult?.total as number) || 0

    const result = await env.DB.prepare(
      `
      SELECT * FROM users 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `
    )
      .bind(limit, offset)
      .all()

    users = result.results
  }

  const content = renderUsersTable(users, total, page, limit)

  return new Response(
    renderAdminLayout({
      title: 'User Management',
      content,
      activeMenu: 'users',
      adminId: request.adminId
    }),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}
```

## Security Considerations

1. **Authentication**:
   - Use Telegram 2FA for admin authentication
   - Store auth codes in KV with TTL
   - Generate secure session tokens

2. **Session Management**:
   - HttpOnly, Secure cookies
   - Session expiration
   - Proper logout handling

3. **Authorization**:
   - Check admin permissions in database
   - Validate all user inputs
   - Use prepared statements for DB queries

4. **CSRF Protection**:
   - Consider adding CSRF tokens for POST requests
   - Validate referrer headers

## Integration with Bot

1. **Main Worker Entry**:

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Admin panel routes
    if (url.pathname.startsWith('/admin')) {
      return handleAdminRoutes(request, env, ctx)
    }

    // Telegram webhook
    if (url.pathname === '/webhook') {
      return handleTelegramWebhook(request, env, ctx)
    }

    return new Response('Not Found', { status: 404 })
  }
}
```

2. **Admin Command in Bot**:

```typescript
bot.command('admin', async ctx => {
  if (!isOwner(ctx)) return

  // Generate auth code
  const authCode = generateAuthCode()
  await env.SESSIONS.put(
    `auth:${ctx.from.id}`,
    JSON.stringify({ token: authCode, expiresAt: Date.now() + 300000 }),
    { expirationTtl: 300 }
  )

  await ctx.reply(
    `Admin Panel Access:\n\n` +
      `URL: ${BOT_URL}/admin\n` +
      `ID: ${ctx.from.id}\n` +
      `Code: ${authCode}\n\n` +
      `Code expires in 5 minutes.`
  )
})
```

## Testing

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('Admin Panel', () => {
  it('should require authentication', async () => {
    const request = new Request('https://bot.example.com/admin/dashboard')
    const response = await handleAdminRoutes(request, mockEnv, mockCtx)

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/admin')
  })

  it('should authenticate with valid code', async () => {
    const formData = new FormData()
    formData.append('admin_id', '123456')
    formData.append('auth_code', 'validcode')

    mockEnv.SESSIONS.get.mockResolvedValue(
      JSON.stringify({ token: 'validcode', expiresAt: Date.now() + 60000 })
    )

    const request = new Request('https://bot.example.com/admin', {
      method: 'POST',
      body: formData
    })

    const response = await handleAdminAuth(request, mockEnv)

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/admin/dashboard')
  })
})
```

## Benefits

1. **No External Dependencies**: Pure HTML/CSS, no build step required
2. **Fast**: Runs at the edge with Cloudflare Workers
3. **Secure**: Telegram-based authentication
4. **Type-safe**: Full TypeScript support
5. **Testable**: Easy to unit test
6. **Scalable**: Can handle many concurrent admin sessions

## Potential Enhancements

1. **Real-time Updates**: WebSocket support for live data
2. **Export Features**: CSV/JSON export for reports
3. **Audit Logging**: Track all admin actions
4. **Role-based Access**: Different permission levels
5. **API Mode**: JSON API for programmatic access
6. **Charts**: Add data visualization
7. **Search**: Full-text search capabilities
8. **Bulk Actions**: Process multiple items at once

## Conclusion

This pattern provides a robust foundation for adding admin capabilities to Telegram bots running on Cloudflare Workers. It's production-ready and can be adapted to various bot requirements.
