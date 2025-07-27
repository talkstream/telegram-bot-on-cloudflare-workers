/**
 * Omnichannel Echo Bot Example
 * 
 * This example demonstrates how to create a bot that works
 * across multiple messaging platforms simultaneously
 */

import { WireframeBot } from '../../src/core/omnichannel/wireframe-bot.js';
import type { BotContext } from '../../src/core/omnichannel/wireframe-bot.js';

// Create bot instance with multiple channels
const bot = new WireframeBot({
  channels: ['telegram', 'whatsapp'], // Add more as they become available
  unifiedHandlers: true, // Use same handlers for all channels
});

// Simple echo command - works on ALL platforms
bot.command('echo', async (ctx: BotContext, args: string[]) => {
  const text = args.join(' ') || 'Nothing to echo!';
  await ctx.reply(`🔊 Echo: ${text}`);
  
  // Log which platform the message came from
  console.log(`Echo command from ${ctx.channel}: ${text}`);
});

// Start command with platform-aware response
bot.command('start', async (ctx: BotContext) => {
  const platformEmoji = {
    telegram: '✈️',
    whatsapp: '💬',
    discord: '🎮',
    slack: '💼',
  }[ctx.channel] || '🤖';
  
  await ctx.reply(
    `${platformEmoji} Welcome to Omnichannel Bot!\n\n` +
    `I'm currently talking to you on ${ctx.channel}.\n` +
    `Try the /echo command to test me!`
  );
});

// Handle all text messages
bot.on('message', async (ctx: BotContext) => {
  // Skip if it's a command
  if (ctx.message.content.text?.startsWith('/')) {
    return;
  }
  
  // Different responses based on platform capabilities
  if (ctx.react && ctx.channel === 'discord') {
    // Discord supports reactions
    await ctx.react('👍');
  } else if (ctx.channel === 'telegram') {
    // Telegram has inline keyboards
    await ctx.reply('I received your message!', {
      keyboard: [[
        { text: '👍 Like', callback: 'like' },
        { text: '👎 Dislike', callback: 'dislike' }
      ]]
    });
  } else {
    // Simple text response for other platforms
    await ctx.reply(`You said: "${ctx.message.content.text}"`);
  }
});

// Pattern matching example
bot.hears(/hello|hi|hey/i, async (ctx: BotContext) => {
  const greetings = {
    telegram: 'Привет! 👋',
    whatsapp: 'Hello there! 👋',
    discord: 'Hey! What\'s up? 🎮',
    slack: 'Hello, colleague! 👔',
  };
  
  const greeting = greetings[ctx.channel] || 'Hello! 👋';
  await ctx.reply(greeting);
});

// Cross-platform broadcast example
bot.command('broadcast', async (ctx: BotContext, args: string[]) => {
  const message = args.join(' ');
  
  if (!message) {
    await ctx.reply('Please provide a message to broadcast');
    return;
  }
  
  // This would broadcast to all connected users across all platforms
  // In a real implementation, you'd need to track user IDs per platform
  await ctx.reply(
    `📢 Broadcasting "${message}" to all platforms:\n` +
    bot.getRouter().getActiveChannels().join(', ')
  );
});

// Platform-specific features demo
bot.command('features', async (ctx: BotContext) => {
  let response = `🚀 Platform-specific features on ${ctx.channel}:\n\n`;
  
  if (ctx.channel === 'telegram') {
    response += '✅ Inline keyboards\n';
    response += '✅ Markdown formatting\n';
    response += '✅ File uploads\n';
    response += '✅ Stickers\n';
  } else if (ctx.channel === 'whatsapp') {
    response += '✅ Interactive lists\n';
    response += '✅ Business features\n';
    response += '✅ Catalog support\n';
    response += '✅ Quick replies\n';
  } else if (ctx.channel === 'discord') {
    response += '✅ Embeds\n';
    response += '✅ Reactions\n';
    response += '✅ Threads\n';
    response += '✅ Slash commands\n';
  }
  
  await ctx.reply(response);
});

// Error handling
bot.on('message', async (ctx: BotContext) => {
  try {
    // Your message handling logic
  } catch (error) {
    console.error(`Error in ${ctx.channel}:`, error);
    await ctx.reply('Sorry, something went wrong. Please try again.');
  }
});

// Start the bot
async function main() {
  try {
    await bot.start();
    console.log('🤖 Omnichannel bot started!');
    console.log('Active channels:', bot.getRouter().getActiveChannels());
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Run the bot
main();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await bot.stop();
  process.exit(0);
});