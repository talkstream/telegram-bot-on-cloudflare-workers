/**
 * Authentication handler for admin panel
 * Uses Telegram bot for 2FA
 */

import { Bot } from 'grammy'

import { createAdminSession } from '../middleware/auth'
import { renderLoginPage } from '../templates/login'
import type { AdminEnv, AuthState } from '../types'

export async function handleAdminAuth(request: Request, env: AdminEnv): Promise<Response> {
  if (request.method === 'GET') {
    // Show login page
    return new Response(renderLoginPage(), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    })
  }

  if (request.method === 'POST') {
    // Handle login
    const formData = await request.formData()
    const action = formData.get('action')

    if (action === 'request-code') {
      return handleRequestCode(formData, env)
    } else if (action === 'verify-code') {
      return handleVerifyCode(formData, env)
    }
  }

  return new Response('Method not allowed', { status: 405 })
}

async function handleRequestCode(formData: FormData, env: AdminEnv): Promise<Response> {
  const telegramId = formData.get('telegram_id')?.toString()

  if (!telegramId || !/^\d+$/.test(telegramId)) {
    return new Response(renderLoginPage({ error: 'Invalid Telegram ID' }), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }

  const adminIds = env.BOT_OWNER_IDS?.split(',').map(id => parseInt(id.trim())) || []
  if (!adminIds.includes(parseInt(telegramId))) {
    return new Response(renderLoginPage({ error: 'Access denied' }), {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString()

  // Store auth state
  const authState: AuthState = {
    token: code,
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
  }

  await env.SESSIONS.put(
    `auth:${telegramId}`,
    JSON.stringify(authState),
    { expirationTtl: 300 } // 5 minutes
  )

  // Send code via Telegram
  try {
    const bot = new Bot(env.BOT_TOKEN)
    await bot.api.sendMessage(
      parseInt(telegramId),
      `🔐 Your admin panel verification code:\n\n<code>${code}</code>\n\nThis code expires in 5 minutes.`,
      { parse_mode: 'HTML' }
    )
  } catch (error) {
    console.error('Failed to send code:', error)
    return new Response(
      renderLoginPage({ error: 'Failed to send code. Make sure the bot can message you.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    )
  }

  // Show code input form
  return new Response(renderLoginPage({ showCodeInput: true, telegramId }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}

async function handleVerifyCode(formData: FormData, env: AdminEnv): Promise<Response> {
  const telegramId = formData.get('telegram_id')?.toString()
  const code = formData.get('code')?.toString()

  if (!telegramId || !code) {
    return new Response(renderLoginPage({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }

  // Check auth state
  const authStateData = await env.SESSIONS.get(`auth:${telegramId}`)
  if (!authStateData) {
    return new Response(renderLoginPage({ error: 'Code expired or invalid' }), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }

  const authState: AuthState = JSON.parse(authStateData)

  // Verify code
  if (authState.token !== code || authState.expiresAt < Date.now()) {
    return new Response(renderLoginPage({ error: 'Invalid or expired code' }), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }

  // Create session
  const { cookie } = await createAdminSession(parseInt(telegramId), env)

  // Clean up auth state
  await env.SESSIONS.delete(`auth:${telegramId}`)

  // Redirect to dashboard
  return new Response('', {
    status: 302,
    headers: {
      Location: '/admin/dashboard',
      'Set-Cookie': cookie
    }
  })
}
