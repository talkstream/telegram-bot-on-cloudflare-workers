/**
 * Wireframe Hello World Bot
 *
 * Demonstrates the simplicity of the v2.0 ecosystem
 */

import { Wireframe } from '@wireframe/core'
import 'dotenv/config'

// Create bot with just configuration
const bot = await Wireframe.create({
  connectors: ['telegram', 'openai'],
  config: {
    telegram: {
      token: process.env.BOT_TOKEN
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4-turbo-preview'
    }
  }
})

// Handle messages
bot.on('message', async message => {
  console.log(`📨 Received: ${message.text}`)

  // Use AI to generate response
  const response = await bot.ai.complete(message.text!)

  // Reply to user
  await message.reply(response)
  console.log(`✅ Replied: ${response.substring(0, 50)}...`)
})

// Handle commands
bot.on('command:start', async message => {
  await message.reply(
    '👋 Hello! I am a Wireframe bot powered by OpenAI.\n\n' +
      'Send me any message and I will respond using AI!'
  )
})

bot.on('command:help', async message => {
  await message.reply(
    '📖 Available commands:\n\n' +
      '/start - Start the bot\n' +
      '/help - Show this help message\n' +
      '/about - About this bot'
  )
})

bot.on('command:about', async message => {
  await message.reply(
    '🚀 This bot is built with Wireframe v2.0\n\n' +
      'Features:\n' +
      '• 4.1KB core bundle\n' +
      '• < 50ms cold start\n' +
      '• Vendor-agnostic architecture\n' +
      '• 100% TypeScript\n\n' +
      'Learn more: https://wireframe.dev'
  )
})

// Start the bot
await bot.start()
console.log('✨ Wireframe bot is running!')
console.log('📊 Performance: < 50ms cold start, 4.1KB core')
console.log('🔗 Connected: Telegram + OpenAI')
