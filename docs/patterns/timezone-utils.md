# Universal Timezone Utilities

## Overview

The Timezone Utilities provide comprehensive timezone handling for global bot applications. Production-tested with GMT+7 (Bangkok timezone) in the Kogotochki bot, serving users across different timezones with accurate local time display.

## Problem

Bots serving global users face timezone challenges:

- Displaying times in user's local timezone
- Scheduling notifications at appropriate local times
- Handling business hours across timezones
- Auction/event countdowns for different regions

## Solution

A universal timezone utility using date-fns v4 with @date-fns/tz:

```typescript
import { TimezoneFactory } from '@/lib/utils/timezone'

// Create timezone utils for user
const user = await getUserFromDB(userId)
const tz = TimezoneFactory.forUser(user)

// Display time in user's timezone
const eventTime = new Date('2025-08-06T14:00:00Z')
await ctx.reply(`Event starts at ${tz.formatBotDateTime(eventTime)} (${tz.getAbbreviation()})`)
// Output: "Event starts at 21:00 06.08.2025 (GMT+7)"
```

## Installation

```bash
npm install date-fns @date-fns/tz
```

## Features

### Basic Formatting

```typescript
const bangkok = TimezoneFactory.get('Asia/Bangkok')
const now = new Date()

bangkok.formatBotTime(now) // "14:30"
bangkok.formatBotDate(now) // "06.08.2025"
bangkok.formatBotDateTime(now) // "14:30 06.08.2025"
bangkok.format(now, 'EEEE') // "Wednesday"
```

### Timezone Information

```typescript
const tz = TimezoneFactory.get('Asia/Bangkok')

tz.getOffset() // 7 (hours from UTC)
tz.getAbbreviation() // "GMT+7"
```

### Business Hours

```typescript
const supportTz = TimezoneFactory.get('Asia/Bangkok')

if (supportTz.isBusinessHours()) {
  await ctx.reply('✅ Support is online!')
} else {
  const nextOpen = supportTz.getNextOccurrence(9, 0)
  await ctx.reply(`Support opens at ${supportTz.formatBotDateTime(nextOpen)}`)
}
```

### Scheduling

```typescript
// Schedule notification for 9 AM local time
const tz = TimezoneFactory.forUser(user)
const notificationTime = tz.getNextOccurrence(9, 0)

await scheduleNotification({
  userId: user.id,
  sendAt: notificationTime,
  message: 'Good morning!'
})
```

## Usage Patterns

### Pattern 1: User Timezone Preference

```typescript
interface User {
  id: string
  timezone?: string // 'Asia/Bangkok'
  location?: string // 'bangkok'
}

// Automatically select best timezone
const tz = TimezoneFactory.forUser(user)
// Uses timezone if set, otherwise maps location, fallback to UTC
```

### Pattern 2: Auction End Times

```typescript
async function showAuctionEnd(ctx: Context) {
  const user = await getUser(ctx.from.id)
  const tz = TimezoneFactory.forUser(user)

  // Auction ends at 6 AM local time
  const auctionEnd = tz.getNextOccurrence(6, 0)

  await ctx.reply(
    `⏰ Auction ends:\n` + `${tz.formatBotDateTime(auctionEnd)} (${tz.getAbbreviation()})`
  )
}
```

### Pattern 3: Global Event Announcement

```typescript
const eventTime = new Date('2025-08-10T14:00:00Z')

const timezones = [
  { name: 'Bangkok', tz: TimezoneFactory.get('Asia/Bangkok') },
  { name: 'Moscow', tz: TimezoneFactory.get('Europe/Moscow') },
  { name: 'New York', tz: TimezoneFactory.get('America/New_York') }
]

let message = '🎉 Event Starting Times:\n\n'
for (const { name, tz } of timezones) {
  message += `${name}: ${tz.formatBotDateTime(eventTime)} (${tz.getAbbreviation()})\n`
}
```

### Pattern 4: Time-Based Greetings

```typescript
function getGreeting(tz: TimezoneUtils): string {
  const hour = parseInt(tz.format(new Date(), 'HH'))

  if (hour < 12) return '🌅 Good morning'
  if (hour < 18) return '☀️ Good afternoon'
  if (hour < 22) return '🌆 Good evening'
  return '🌙 Good night'
}
```

### Pattern 5: Payment History

```typescript
async function showPayments(ctx: Context) {
  const user = await getUser(ctx.from.id)
  const tz = TimezoneFactory.forUser(user)
  const payments = await getPaymentHistory(user.id)

  let message = `💳 Payment History (${tz.getAbbreviation()}):\n\n`

  for (const payment of payments) {
    message += `${tz.formatBotDateTime(payment.timestamp)} - ${payment.amount} stars\n`
  }

  await ctx.reply(message)
}
```

## Location Mapping

Built-in mapping for common locations:

```typescript
const locationMap = {
  bangkok: 'Asia/Bangkok',
  thailand: 'Asia/Bangkok',
  phuket: 'Asia/Bangkok',
  moscow: 'Europe/Moscow',
  london: 'Europe/London',
  new_york: 'America/New_York',
  tokyo: 'Asia/Tokyo',
  dubai: 'Asia/Dubai',
  singapore: 'Asia/Singapore',
  sydney: 'Australia/Sydney'
  // ... more locations
}
```

## Convenience Exports

Pre-configured timezone utilities:

```typescript
import { UTC, Bangkok, Moscow, NewYork, London, Tokyo } from '@/lib/utils/timezone'

// Use directly
Bangkok.formatBotDateTime(new Date()) // "14:30 06.08.2025"
Moscow.getAbbreviation() // "GMT+3"
```

## Testing

```typescript
import { describe, it, expect } from 'vitest'
import { TimezoneFactory } from '@/lib/utils/timezone'

describe('Timezone handling', () => {
  it('should format times correctly', () => {
    const bangkok = TimezoneFactory.get('Asia/Bangkok')
    const utcDate = new Date('2025-08-06T00:00:00Z')

    // Bangkok is UTC+7
    expect(bangkok.format(utcDate, 'HH:mm')).toBe('07:00')
  })

  it('should cache instances', () => {
    const tz1 = TimezoneFactory.get('Asia/Bangkok')
    const tz2 = TimezoneFactory.get('Asia/Bangkok')

    expect(tz1).toBe(tz2) // Same instance
  })
})
```

## Production Results

From Kogotochki bot (Thailand market):

### Before Timezone Support

- Users confused about "6 AM" auction end (which 6 AM?)
- Support requests at 3 AM Bangkok time
- Notifications sent at inappropriate hours

### After Timezone Support

- Clear display: "Auction ends at 06:00 (GMT+7)"
- Support hours properly indicated
- Notifications sent at user's 9 AM local time
- Payment history shows local timestamps

## Best Practices

### 1. Always Show Timezone

```typescript
// ❌ Ambiguous
'Auction ends at 06:00'

// ✅ Clear
'Auction ends at 06:00 (GMT+7)'
```

### 2. Store UTC, Display Local

```typescript
// Store in database as UTC
const timestamp = new Date().toISOString()

// Display in user's timezone
const tz = TimezoneFactory.forUser(user)
const display = tz.formatBotDateTime(timestamp)
```

### 3. Cache Timezone Utils

```typescript
// TimezoneFactory automatically caches instances
const tz1 = TimezoneFactory.get('Asia/Bangkok')
const tz2 = TimezoneFactory.get('Asia/Bangkok')
// tz1 === tz2 (same instance)
```

### 4. User Preference Over Detection

```typescript
const tz = TimezoneFactory.forUser({
  timezone: user.timezone, // First priority
  location: user.location // Second priority
}) // Fallback: UTC
```

### 5. Business Hours Check

```typescript
if (!supportTz.isBusinessHours()) {
  const nextOpen = supportTz.getNextOccurrence(9, 0)
  await ctx.reply(`Support opens at ${supportTz.formatBotDateTime(nextOpen)}`)
}
```

## Migration Guide

### From Manual Formatting

```typescript
// Before
const date = new Date()
const formatted = `${date.getHours()}:${date.getMinutes()} ${date.toDateString()}`

// After
const tz = TimezoneFactory.forUser(user)
const formatted = tz.formatBotDateTime(date)
```

### From Moment.js

```typescript
// Before (moment-timezone)
moment.tz(date, 'Asia/Bangkok').format('HH:mm DD.MM.YYYY')

// After (timezone utils)
Bangkok.formatBotDateTime(date)
```

## Performance

- **Lightweight**: Uses native date-fns (smaller than moment.js)
- **Cached**: Timezone instances are reused
- **Fast**: < 1ms per format operation
- **No API calls**: Works offline

## Common Issues

### Issue: Daylight Saving Time

**Solution**: date-fns handles DST automatically

### Issue: Invalid Timezone

**Solution**: Validate and fallback to UTC

```typescript
try {
  const tz = new TimezoneUtils(userInput)
} catch {
  const tz = new TimezoneUtils('UTC')
}
```

### Issue: Relative Time

**Solution**: Use date-fns formatDistance

```typescript
import { formatDistance } from 'date-fns'

const timeUntil = formatDistance(auctionEnd, new Date())
// "in 2 hours"
```

## Summary

The Timezone Utilities are essential for any bot serving users across different timezones. With automatic caching, location mapping, and convenient formatting methods, they make timezone handling simple and reliable.

Key benefits:

- **Clear time display** with timezone abbreviations
- **Accurate scheduling** for notifications
- **Business hours** handling
- **User-friendly** formatting
- **Production tested** with real users

This utility has been running in production for 30+ days, handling auction times, payment history, and notifications for users primarily in GMT+7 (Thailand) timezone.
