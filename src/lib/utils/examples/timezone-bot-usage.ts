/**
 * Timezone Utilities - Bot Usage Examples
 *
 * Shows how to handle timezones correctly in global bot applications
 */

import type { Context } from 'grammy'
import { TimezoneFactory, TimezoneUtils } from '../timezone'

/**
 * Example 1: Display auction end times in user's timezone
 */
export async function showAuctionEndTime(ctx: Context, userId: string) {
  // Get user from database
  const user = await getUserFromDB(userId)

  // Create timezone utils for user
  const tz = TimezoneFactory.forUser(user)

  // Auction ends at 6 AM local time
  const auctionEnd = tz.getNextOccurrence(6, 0)

  await ctx.reply(
    `⏰ Auction ends at:\n` +
      `${tz.formatBotDateTime(auctionEnd)} (${tz.getAbbreviation()})\n\n` +
      `Time remaining: ${getTimeRemaining(auctionEnd)}`
  )
}

/**
 * Example 2: Schedule notifications at user's local time
 */
export async function scheduleUserNotifications(users: any[]) {
  const notifications = []

  for (const user of users) {
    const tz = TimezoneFactory.forUser(user)

    // Schedule for 9 AM local time
    const notificationTime = tz.getNextOccurrence(9, 0)

    notifications.push({
      userId: user.id,
      sendAt: notificationTime,
      message: `Good morning! Here are today's top services in your area.`,
      timezone: tz.getAbbreviation()
    })
  }

  return notifications
}

/**
 * Example 3: Display payment history with timezone
 */
export async function showPaymentHistory(ctx: Context, userId: string) {
  const user = await getUserFromDB(userId)
  const tz = TimezoneFactory.forUser(user)

  const payments = await getPaymentHistory(userId)

  let message = `💳 Payment History (${tz.getAbbreviation()}):\n\n`

  for (const payment of payments) {
    message += `${tz.formatBotDateTime(payment.timestamp)} - ${payment.amount} stars\n`
    message += `${payment.description}\n\n`
  }

  await ctx.reply(message)
}

/**
 * Example 4: Business hours check
 */
export async function handleSupportRequest(ctx: Context) {
  // Support is available in Bangkok business hours
  const supportTz = TimezoneFactory.get('Asia/Bangkok')

  if (supportTz.isBusinessHours()) {
    await ctx.reply('✅ Support is online!\n' + "We'll respond within 5 minutes.")
  } else {
    const nextBusinessHour = supportTz.getNextOccurrence(9, 0)

    await ctx.reply(
      '😴 Support is offline.\n' +
        `Business hours: 9 AM - 6 PM ${supportTz.getAbbreviation()}\n` +
        `We'll be back at ${supportTz.formatBotDateTime(nextBusinessHour)}`
    )
  }
}

/**
 * Example 5: Multi-timezone event announcement
 */
export async function announceGlobalEvent(ctx: Context) {
  const eventTime = new Date('2025-08-10T14:00:00Z')

  // Show event time in multiple timezones
  const timezones = [
    { name: 'Bangkok', tz: TimezoneFactory.get('Asia/Bangkok') },
    { name: 'Moscow', tz: TimezoneFactory.get('Europe/Moscow') },
    { name: 'London', tz: TimezoneFactory.get('Europe/London') },
    { name: 'New York', tz: TimezoneFactory.get('America/New_York') }
  ]

  let message = '🎉 Global Event Starting Times:\n\n'

  for (const { name, tz } of timezones) {
    message += `${name}: ${tz.formatBotDateTime(eventTime)} (${tz.getAbbreviation()})\n`
  }

  await ctx.reply(message)
}

/**
 * Example 6: User timezone preference setting
 */
export async function setUserTimezone(ctx: Context, timezone: string) {
  const userId = ctx.from?.id
  if (!userId) return

  try {
    // Validate timezone by trying to create utils
    const tz = new TimezoneUtils(timezone)

    // Save to database
    await updateUserTimezone(userId, timezone)

    // Show confirmation with current time
    const now = new Date()
    await ctx.reply(
      `✅ Timezone updated to ${timezone}\n` +
        `Current time: ${tz.formatBotDateTime(now)} (${tz.getAbbreviation()})`
    )
  } catch (error) {
    await ctx.reply('❌ Invalid timezone. Please use format like "Asia/Bangkok" or "Europe/London"')
  }
}

/**
 * Example 7: Smart location-based timezone detection
 */
export async function detectUserTimezone(ctx: Context) {
  const location = ctx.message?.location

  if (!location) {
    await ctx.reply('Please share your location to detect timezone')
    return
  }

  // In real app, you'd use a geocoding API
  // This is a simplified example
  const timezone = await getTimezoneFromCoordinates(location.latitude, location.longitude)

  const tz = TimezoneFactory.get(timezone)

  await ctx.reply(
    `📍 Detected timezone: ${timezone}\n` +
      `Current time: ${tz.formatBotDateTime(new Date())} (${tz.getAbbreviation()})\n\n` +
      `Is this correct?`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Yes', callback_data: `tz_confirm:${timezone}` },
            { text: '❌ No', callback_data: 'tz_manual' }
          ]
        ]
      }
    }
  )
}

/**
 * Example 8: Telegram bot with full timezone support
 */
export class TimezoneAwareBot {
  async handleUpdate(ctx: Context) {
    const userId = ctx.from?.id
    if (!userId) return

    // Get user with timezone preference
    const user = await this.getUser(userId)
    const tz = TimezoneFactory.forUser(user)

    // Add timezone to context for all handlers
    ;(ctx as any).tz = tz

    // Now all handlers can use ctx.tz
    await this.processUpdate(ctx)
  }

  async handleStartCommand(ctx: Context & { tz: TimezoneUtils }) {
    const greeting = this.getTimeBasedGreeting(ctx.tz)

    await ctx.reply(
      `${greeting}! Welcome to our bot.\n` +
        `Your timezone: ${ctx.tz.getAbbreviation()}\n` +
        `Current time: ${ctx.tz.formatBotTime(new Date())}`
    )
  }

  private getTimeBasedGreeting(tz: TimezoneUtils): string {
    const hour = parseInt(tz.format(new Date(), 'HH'))

    if (hour < 12) return '🌅 Good morning'
    if (hour < 18) return '☀️ Good afternoon'
    if (hour < 22) return '🌆 Good evening'
    return '🌙 Good night'
  }

  private async getUser(userId: number) {
    // Mock implementation
    return { id: userId, timezone: 'Asia/Bangkok' }
  }

  private async processUpdate(_ctx: Context) {
    // Handle update...
  }
}

// Helper functions (mock implementations)
async function getUserFromDB(_userId: string): Promise<any> {
  return { id: _userId, timezone: 'Asia/Bangkok' }
}

async function getPaymentHistory(_userId: string): Promise<any[]> {
  return [{ timestamp: new Date(), amount: 100, description: 'Service payment' }]
}

async function updateUserTimezone(_userId: number, _timezone: string): Promise<void> {
  // Update in database
}

async function getTimezoneFromCoordinates(_lat: number, _lng: number): Promise<string> {
  // In real app, use Google Timezone API or similar
  return 'Asia/Bangkok'
}

function getTimeRemaining(target: Date): string {
  const now = new Date()
  const diff = target.getTime() - now.getTime()
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  return `${hours}h ${minutes}m`
}

/**
 * Production Results from Kogotochki Bot:
 *
 * Before timezone support:
 * - Users confused about auction end times
 * - Support requests at wrong hours
 * - Notifications sent at inappropriate times
 *
 * After timezone support:
 * - Clear local time display (GMT+7 for Thailand)
 * - Correct business hours handling
 * - Personalized notification scheduling
 * - Better user experience for global users
 *
 * Key features used:
 * - formatBotDateTime() for all time displays
 * - getNextOccurrence() for scheduling
 * - isBusinessHours() for support availability
 * - getAbbreviation() for clear timezone indication
 */
