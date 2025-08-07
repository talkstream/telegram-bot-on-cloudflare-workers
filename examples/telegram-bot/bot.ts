/**
 * Basic Telegram Bot Example
 *
 * This example demonstrates how to create a simple Telegram bot
 * using the Wireframe v1.2 platform with TypeScript.
 */

import { TelegramConnector } from '../../src/connectors/messaging/telegram'
import { MonitoringFactory } from '../../src/connectors/monitoring/monitoring-factory'
import { Bot } from '../../src/core/bot'
import { CloudPlatformFactory } from '../../src/core/cloud/platform-factory'
import type { Env } from '../../src/types/env'

// Command handlers
async function handleStartCommand(ctx: any) {
  const userName = ctx.from?.first_name || 'friend'

  await ctx.reply(
    `👋 Hello ${userName}! Welcome to Wireframe Bot.\n\n` +
      `I'm a simple bot built with the Wireframe platform. Try these commands:\n\n` +
      `/help - Show available commands\n` +
      `/echo <text> - Echo your message\n` +
      `/weather <city> - Get weather info (AI-powered)\n` +
      `/about - Learn about Wireframe`
  )
}

async function handleHelpCommand(ctx: any) {
  await ctx.reply(
    `📚 *Available Commands*\n\n` +
      `/start - Welcome message\n` +
      `/help - This help message\n` +
      `/echo <text> - Echo your message\n` +
      `/weather <city> - Get weather info\n` +
      `/about - About this bot\n\n` +
      `This bot is built with Wireframe v1.2 🚀`,
    { parse_mode: 'Markdown' }
  )
}

async function handleEchoCommand(ctx: any) {
  const text = ctx.match || 'Hello!'
  await ctx.reply(`🔊 ${text}`)
}

async function handleWeatherCommand(ctx: any) {
  const city = ctx.match || 'London'

  // In a real bot, you would use the AI service here
  await ctx.reply(
    `🌤️ Weather in ${city}:\n\n` +
      `Temperature: 22°C\n` +
      `Conditions: Partly cloudy\n` +
      `Humidity: 65%\n\n` +
      `_This is a demo response. Connect an AI provider for real weather data!_`,
    { parse_mode: 'Markdown' }
  )
}

async function handleAboutCommand(ctx: any) {
  await ctx.reply(
    `🚀 *About Wireframe*\n\n` +
      `This bot is built with Wireframe v1.2 - a universal AI assistant platform.\n\n` +
      `✨ Features:\n` +
      `• Multi-cloud deployment (Cloudflare, AWS, GCP)\n` +
      `• Multi-messaging platforms (Telegram, Discord, Slack)\n` +
      `• AI provider abstraction\n` +
      `• Plugin system\n` +
      `• TypeScript with 100% type safety\n\n` +
      `[Learn more](https://github.com/talkstream/typescript-wireframe-platform)`,
    { parse_mode: 'Markdown', disable_web_page_preview: true }
  )
}

// Main handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // Initialize monitoring
      const monitoring = await MonitoringFactory.createFromEnv(env)

      // Create cloud platform connector
      const cloudPlatform = CloudPlatformFactory.createFromTypedEnv(env)

      // Create bot instance
      const bot = new Bot({
        connector: new TelegramConnector({
          token: env.TELEGRAM_BOT_TOKEN,
          webhookSecret: env.TELEGRAM_WEBHOOK_SECRET
        }),
        cloudPlatform,
        monitoring
      })

      // Register commands
      bot.command('start', handleStartCommand)
      bot.command('help', handleHelpCommand)
      bot.command('echo', handleEchoCommand)
      bot.command('weather', handleWeatherCommand)
      bot.command('about', handleAboutCommand)

      // Handle the request
      return await bot.handleRequest(request)
    } catch (error) {
      console.error('Bot error:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }
}
