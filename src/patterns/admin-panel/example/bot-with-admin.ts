/**
 * Example: Bot with Admin Panel
 * Shows how to integrate the admin panel pattern with your bot
 */

import { Bot } from 'grammy'

import { handleAdminRoutes } from '../routes'
import type { AdminEnv } from '../types'

// Generate secure random auth code
function generateAuthCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Check if user is admin
function isAdmin(userId: number, adminIds: number[]): boolean {
  return adminIds.includes(userId)
}

// Main worker
export default {
  async fetch(request: Request, env: AdminEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Handle admin panel routes
    if (url.pathname.startsWith('/admin')) {
      return handleAdminRoutes(request, env, ctx)
    }

    // Handle Telegram webhook
    if (url.pathname === `/webhook/${env.TELEGRAM_WEBHOOK_SECRET}`) {
      const bot = new Bot(String(env.TELEGRAM_BOT_TOKEN))

      // Admin command - generates login code
      bot.command('admin', async ctx => {
        const adminIds = Array.isArray(env.BOT_ADMIN_IDS)
          ? env.BOT_ADMIN_IDS
          : String(env.BOT_ADMIN_IDS)
              .split(',')
              .map(id => parseInt(id.trim(), 10))
        if (!ctx.from || !isAdmin(ctx.from.id, adminIds)) {
          await ctx.reply('Access denied.')
          return
        }

        // Generate auth code
        const authCode = generateAuthCode()

        // Store auth code in KV
        await env.SESSIONS.put(
          `auth:${ctx.from.id}`,
          JSON.stringify({
            token: authCode,
            expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
          }),
          { expirationTtl: 300 } // 5 minutes TTL
        )

        // Send login details
        await ctx.reply(
          `🔐 Admin Panel Access:\n\n` +
            `URL: ${env.ADMIN_URL || url.origin}/admin\n` +
            `Admin ID: ${ctx.from.id}\n` +
            `Auth Code: ${authCode}\n\n` +
            `⏱ Code expires in 5 minutes.\n` +
            `🔒 Keep this information secure!`,
          { parse_mode: 'HTML' }
        )
      })

      // Handle webhook
      const body = await request.text()
      await bot.handleUpdate(JSON.parse(body))

      return new Response('OK')
    }

    // Default response
    return new Response('Not Found', { status: 404 })
  }
}

// Example environment configuration in wrangler.toml:
/*
name = "my-bot"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ADMIN_URL = "https://my-bot.workers.dev"

[[kv_namespaces]]
binding = "SESSIONS"
id = "your-kv-namespace-id"

[[d1_databases]]
binding = "DB"
database_name = "my-bot-db"
database_id = "your-d1-database-id"

[env.production.vars]
BOT_ADMIN_IDS = "[123456789, 987654321]"
*/
