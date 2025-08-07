import type { MockedFunction } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Bangkok, Moscow, NewYork, TimezoneFactory, TimezoneUtils, UTC } from '../timezone'

// Helper function for mocking Date with proper typing
function mockDate(dateStr: string): MockedFunction<typeof Date> {
  const OriginalDate = Date
  const mockNow = new OriginalDate(dateStr)

  return vi.spyOn(global, 'Date').mockImplementation((arg?: string | number | Date) => {
    if (arg !== undefined) {
      return new OriginalDate(arg as string | number | Date)
    }
    return mockNow
  }) as MockedFunction<typeof Date>
}

describe('TimezoneUtils', () => {
  let utils: TimezoneUtils

  beforeEach(() => {
    utils = new TimezoneUtils('Asia/Bangkok')
  })

  describe('formatting', () => {
    it('should format dates in correct timezone', () => {
      const date = new Date('2025-08-06T00:00:00Z')

      // Bangkok is UTC+7
      expect(utils.format(date, 'HH:mm')).toBe('07:00')
      expect(utils.formatBotTime(date)).toBe('07:00')
    })

    it('should format date and time for bot messages', () => {
      const date = new Date('2025-08-06T10:30:00Z')

      expect(utils.formatBotDateTime(date)).toBe('17:30 06.08.2025')
      expect(utils.formatBotDate(date)).toBe('06.08.2025')
    })

    it('should handle invalid dates gracefully', () => {
      const result = utils.format('invalid', 'HH:mm')
      expect(result).toBe('Invalid date')
    })

    it('should handle string dates', () => {
      const date = '2025-08-06T00:00:00Z'
      expect(utils.format(date, 'HH:mm')).toBe('07:00')
    })

    it('should handle timestamp dates', () => {
      const timestamp = new Date('2025-08-06T00:00:00Z').getTime()
      expect(utils.format(timestamp, 'HH:mm')).toBe('07:00')
    })
  })

  describe('timezone information', () => {
    it('should get correct timezone offset', () => {
      const bangkok = new TimezoneUtils('Asia/Bangkok')
      // Bangkok is UTC+7
      expect(bangkok.getOffset()).toBe(7)
    })

    it('should get correct abbreviation', () => {
      const bangkok = new TimezoneUtils('Asia/Bangkok')
      expect(bangkok.getAbbreviation()).toBe('GMT+7')

      const utc = new TimezoneUtils('UTC')
      expect(utc.getAbbreviation()).toBe('UTC')
    })
  })

  describe('business hours', () => {
    it('should detect business hours correctly', () => {
      const tz = new TimezoneUtils('Asia/Bangkok')

      // 9 AM Bangkok time (2 AM UTC)
      const businessHour = new Date('2025-08-06T02:00:00Z')
      // 7 PM Bangkok time (12 PM UTC)
      const afterHours = new Date('2025-08-06T12:00:00Z')

      expect(tz.isBusinessHours(businessHour)).toBe(true)
      expect(tz.isBusinessHours(afterHours)).toBe(false)
    })
  })

  describe('next occurrence', () => {
    it('should calculate next occurrence correctly', () => {
      const tz = new TimezoneUtils('UTC')

      // Mock current time to 10 AM UTC on August 6
      mockDate('2025-08-06T10:00:00Z')

      // Next 6 AM should be tomorrow since it's 10 AM now
      const next6am = tz.getNextOccurrence(6, 0)

      // Format to check the result properly
      expect(tz.format(next6am, 'YYYY-MM-DD HH:mm')).toBe('2025-08-07 06:00')

      vi.restoreAllMocks()
    })
  })

  describe('parsing', () => {
    it('should parse date strings in timezone context', () => {
      const tz = new TimezoneUtils('Asia/Bangkok')
      const parsed = tz.parse('06.08.2025 14:30', 'DD.MM.YYYY HH:mm')

      expect(parsed).toBeInstanceOf(Date)
      expect(parsed.toString()).not.toBe('Invalid Date')
    })
  })
})

describe('TimezoneFactory', () => {
  afterEach(() => {
    TimezoneFactory.clear()
  })

  it('should cache timezone instances', () => {
    const tz1 = TimezoneFactory.get('Asia/Bangkok')
    const tz2 = TimezoneFactory.get('Asia/Bangkok')

    expect(tz1).toBe(tz2) // Same instance
  })

  it('should create different instances for different timezones', () => {
    const bangkok = TimezoneFactory.get('Asia/Bangkok')
    const moscow = TimezoneFactory.get('Europe/Moscow')

    expect(bangkok).not.toBe(moscow)
  })

  it('should create utils from user preferences', () => {
    const user1 = { timezone: 'Asia/Bangkok' }
    const tz1 = TimezoneFactory.forUser(user1)

    expect(tz1.getAbbreviation()).toBe('GMT+7')
  })

  it('should map locations to timezones', () => {
    const user1 = { location: 'bangkok' }
    const tz1 = TimezoneFactory.forUser(user1)

    expect(tz1.getAbbreviation()).toBe('GMT+7')

    const user2 = { location: 'moscow' }
    const tz2 = TimezoneFactory.forUser(user2)

    expect(tz2.getOffset()).toBe(3) // Moscow is UTC+3
  })

  it('should fallback to UTC for unknown locations', () => {
    const user = { location: 'unknown_city' }
    const tz = TimezoneFactory.forUser(user)

    expect(tz.getAbbreviation()).toBe('UTC')
  })

  it('should prioritize timezone over location', () => {
    const user = {
      timezone: 'America/New_York',
      location: 'bangkok' // Should be ignored
    }
    const tz = TimezoneFactory.forUser(user)

    // Should use timezone, not location
    expect(tz.getOffset()).toBeLessThan(0) // NY is negative offset
  })
})

describe('Convenience exports', () => {
  it('should provide pre-configured timezone utils', () => {
    expect(UTC).toBeInstanceOf(TimezoneUtils)
    expect(Bangkok).toBeInstanceOf(TimezoneUtils)
    expect(Moscow).toBeInstanceOf(TimezoneUtils)
    expect(NewYork).toBeInstanceOf(TimezoneUtils)

    expect(UTC.getAbbreviation()).toBe('UTC')
    expect(Bangkok.getOffset()).toBe(7)
  })
})

describe('Production scenarios', () => {
  it('should handle auction end times across timezones', () => {
    // Mock current time for consistent testing
    mockDate('2025-08-06T10:00:00Z')

    // Auction ends at 6 AM local time
    const bangkokUser = TimezoneFactory.get('Asia/Bangkok')
    const moscowUser = TimezoneFactory.get('Europe/Moscow')

    const auctionEndBangkok = bangkokUser.getNextOccurrence(6, 0)
    const auctionEndMoscow = moscowUser.getNextOccurrence(6, 0)

    // Both should show 6 AM in their local time
    expect(bangkokUser.format(auctionEndBangkok, 'HH:mm')).toBe('06:00')
    expect(moscowUser.format(auctionEndMoscow, 'HH:mm')).toBe('06:00')

    vi.restoreAllMocks()
  })

  it('should format payment history with timezone info', () => {
    const bangkok = TimezoneFactory.get('Asia/Bangkok')
    const payment = {
      timestamp: new Date('2025-08-06T10:30:00Z'),
      amount: 100
    }

    const formatted = `Payment: ${payment.amount} stars at ${bangkok.formatBotDateTime(payment.timestamp)} (${bangkok.getAbbreviation()})`

    expect(formatted).toBe('Payment: 100 stars at 17:30 06.08.2025 (GMT+7)')
  })

  it('should handle daily notifications at local time', () => {
    // Mock current time for consistent testing
    mockDate('2025-08-06T07:00:00Z')

    const users = [
      { id: 1, timezone: 'Asia/Bangkok' },
      { id: 2, timezone: 'Europe/Moscow' },
      { id: 3, timezone: 'America/New_York' }
    ]

    const notifications = users.map(user => {
      const tz = TimezoneFactory.forUser(user)
      const notificationTime = tz.getNextOccurrence(9, 0) // 9 AM local

      return {
        userId: user.id,
        sendAt: notificationTime,
        localTime: tz.format(notificationTime, 'HH:mm'),
        timezone: tz.getAbbreviation()
      }
    })

    // All should be scheduled for 9 AM local time
    notifications.forEach(n => {
      expect(n.localTime).toBe('09:00')
    })

    vi.restoreAllMocks()
  })

  it('should display event countdown correctly', () => {
    const eventTime = new Date('2025-08-06T14:00:00Z')

    const bangkok = TimezoneFactory.get('Asia/Bangkok')
    const moscow = TimezoneFactory.get('Europe/Moscow')

    const bangkokDisplay = `Event at ${bangkok.formatBotDateTime(eventTime)} (${bangkok.getAbbreviation()})`
    const moscowDisplay = `Event at ${moscow.formatBotDateTime(eventTime)} (${moscow.getAbbreviation()})`

    expect(bangkokDisplay).toBe('Event at 21:00 06.08.2025 (GMT+7)')
    expect(moscowDisplay).toBe('Event at 17:00 06.08.2025 (GMT+3)')
  })
})
