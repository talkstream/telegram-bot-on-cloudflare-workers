/**
 * Example bot using TelegramConnector
 */

import { Hono } from 'hono'
import { TelegramConnector } from '../../src/connectors/messaging/telegram/index.js'
import { CommonEventType, EventBus } from '../../src/core/events/event-bus.js'
import type { UnifiedMessage } from '../../src/core/interfaces/messaging.js'
import { PluginCommand } from '../../src/core/plugins/plugin.js'

// Environment interface
interface Env {
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_WEBHOOK_SECRET: string
}

// Create event bus
const eventBus = new EventBus({ debug: true })

// Custom commands
const customCommands: PluginCommand[] = [
  {
    name: 'echo',
    description: 'Echo your message',
    handler: async (args, ctx) => {
      const text = args._raw || 'Nothing to echo!'
      await ctx.reply(`🔊 Echo: ${text}`)
    }
  },
  {
    name: 'time',
    description: 'Show current time',
    handler: async (_args, ctx) => {
      const now = new Date()
      await ctx.reply(`🕐 Current time: ${now.toLocaleString()}`)
    }
  },
  {
    name: 'random',
    description: 'Generate random number',
    handler: async (args, ctx) => {
      const max = parseInt(args.max as string) || 100
      const random = Math.floor(Math.random() * max) + 1
      await ctx.reply(`🎲 Random number (1-${max}): <b>${random}</b>`)
    }
  }
]

// Set up event handlers
eventBus.on(CommonEventType.MESSAGE_RECEIVED, event => {
  const message = event.payload.message as UnifiedMessage
  console.log(`📨 Message from ${message.sender?.username || 'Unknown'}: ${message.content.text}`)
})

eventBus.on(CommonEventType.COMMAND_EXECUTED, event => {
  console.log(`⚡ Command executed: /${event.payload.command}`)
})

eventBus.on(CommonEventType.CONNECTOR_ERROR, event => {
  console.error(`❌ Connector error: ${event.payload.error}`)
})

// Create app
const app = new Hono<{ Bindings: Env }>()

// Health check
app.get('/', c => c.text('Telegram Connector Example Bot'))

// Webhook handler
app.post('/webhook/:token', async c => {
  const env = c.env
  const token = c.req.param('token')

  // Validate token
  if (token !== env.TELEGRAM_WEBHOOK_SECRET) {
    return c.text('Unauthorized', 401)
  }

  // Create connector
  const connector = new TelegramConnector()

  // Initialize with custom commands
  await connector.initialize({
    token: env.TELEGRAM_BOT_TOKEN,
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
    eventBus,
    commands: customCommands // This would need to be integrated into the connector
  })

  // Validate and handle webhook
  const isValid = await connector.validateWebhook(c.req.raw)
  if (!isValid) {
    return c.text('Invalid webhook', 401)
  }

  return await connector.handleWebhook(c.req.raw)
})

// Export for Cloudflare Workers
export default {
  fetch: app.fetch.bind(app)
}
