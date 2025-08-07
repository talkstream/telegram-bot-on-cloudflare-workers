/**
 * Authentication middleware for admin panel
 */

import type { AdminEnv, AdminSession } from '../types'

export interface AuthResult {
  adminId: number
  isAuthenticated: boolean
}

/**
 * Require authentication for admin routes
 */
export async function requireAdminAuth(
  request: Request,
  env: AdminEnv
): Promise<Response | AuthResult> {
  const cookie = request.headers.get('Cookie')
  const sessionId = extractSessionId(cookie)

  if (!sessionId) {
    return redirectToLogin()
  }

  try {
    const sessionData = await env.SESSIONS.get(sessionId)
    if (!sessionData) {
      return redirectToLogin()
    }

    const session: AdminSession = JSON.parse(sessionData)

    // Check if session is expired
    if (session.expiresAt < Date.now()) {
      await env.SESSIONS.delete(sessionId)
      return redirectToLogin()
    }

    return {
      adminId: session.adminId,
      isAuthenticated: true
    }
  } catch (error) {
    console.error('Failed to validate session:', error)
    return redirectToLogin()
  }
}

/**
 * Create a new admin session
 */
export async function createAdminSession(
  adminId: number,
  env: AdminEnv
): Promise<{ sessionId: string; cookie: string }> {
  const sessionId = generateSessionId()
  const session: AdminSession = {
    adminId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  }

  await env.SESSIONS.put(sessionId, JSON.stringify(session), {
    expirationTtl: 24 * 60 * 60 // 24 hours
  })

  const cookie = `admin_session=${sessionId}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`

  return { sessionId, cookie }
}

/**
 * Extract session ID from cookie header
 */
function extractSessionId(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';').map(c => c.trim())
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=')
    if (name === 'admin_session') {
      return value || null
    }
  }

  return null
}

/**
 * Generate a secure session ID
 */
function generateSessionId(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Redirect to login page
 */
function redirectToLogin(): Response {
  return new Response('', {
    status: 302,
    headers: {
      Location: '/admin'
    }
  })
}
