/**
 * Universal timezone utilities for bot applications
 *
 * Production tested with GMT+7 (Bangkok timezone)
 * @module lib/utils/timezone
 */

import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

// Extend dayjs with required plugins
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)

/**
 * Create timezone-aware date utilities for any timezone
 *
 * @example
 * ```typescript
 * const bangkok = new TimezoneUtils('Asia/Bangkok');
 * const now = new Date();
 * console.log(bangkok.formatBotDateTime(now)); // "14:30 06.08.2025"
 * ```
 */
export class TimezoneUtils {
  private timezoneName: string

  constructor(timezoneName: string = 'UTC') {
    this.timezoneName = timezoneName
  }

  /**
   * Format date in specified timezone
   */
  format(date: Date | string | number, formatStr: string): string {
    const dateObj = this.normalizeDate(date)

    if (!dayjs(dateObj).isValid()) {
      console.error('Invalid date provided to format:', date)
      return 'Invalid date'
    }

    return dayjs(dateObj).tz(this.timezoneName).format(formatStr)
  }

  /**
   * Get current date in timezone
   */
  now(): Date {
    return dayjs().tz(this.timezoneName).toDate()
  }

  /**
   * Parse date string in timezone context
   */
  parse(dateString: string, formatStr: string): Date {
    // Parse the date string with the format in the timezone context
    const parsed = dayjs.tz(dateString, formatStr, this.timezoneName)

    if (!parsed.isValid()) {
      return new Date('Invalid Date')
    }

    return parsed.toDate()
  }

  /**
   * Format date for bot messages (localized)
   */
  formatBotDate(date: Date | string | number): string {
    return this.format(date, 'DD.MM.YYYY')
  }

  /**
   * Format time for bot messages (localized)
   */
  formatBotTime(date: Date | string | number): string {
    return this.format(date, 'HH:mm')
  }

  /**
   * Format date and time for bot messages (localized)
   */
  formatBotDateTime(date: Date | string | number): string {
    return this.format(date, 'HH:mm DD.MM.YYYY')
  }

  /**
   * Get timezone offset in hours
   */
  getOffset(): number {
    const date = dayjs().tz(this.timezoneName)
    // Get offset in minutes and convert to hours
    return Math.round(date.utcOffset() / 60)
  }

  /**
   * Get timezone abbreviation (e.g., 'PST', 'GMT+7')
   */
  getAbbreviation(): string {
    const offset = this.getOffset()
    if (offset === 0) return 'UTC'
    const sign = offset > 0 ? '+' : ''
    return `GMT${sign}${offset}`
  }

  /**
   * Check if date is in business hours (9 AM - 6 PM local time)
   */
  isBusinessHours(date?: Date): boolean {
    const checkDate = date || new Date()
    const localHour = parseInt(this.format(checkDate, 'HH'))
    return localHour >= 9 && localHour < 18
  }

  /**
   * Get next occurrence of a local time
   */
  getNextOccurrence(hour: number, minute: number = 0): Date {
    const now = dayjs()

    // Create a date for today at the target time in the timezone
    const todayTarget = dayjs()
      .tz(this.timezoneName)
      .hour(hour)
      .minute(minute)
      .second(0)
      .millisecond(0)

    // If this time has already passed, move to tomorrow
    if (todayTarget.isBefore(now) || todayTarget.isSame(now)) {
      return todayTarget.add(1, 'day').toDate()
    }

    return todayTarget.toDate()
  }

  private normalizeDate(date: Date | string | number): Date {
    if (typeof date === 'string' || typeof date === 'number') {
      return new Date(date)
    }
    return date
  }
}

/**
 * Factory for creating timezone utils
 */
export class TimezoneFactory {
  private static instances: Map<string, TimezoneUtils> = new Map()

  /**
   * Get or create timezone utils for specific timezone
   */
  static get(timezone: string): TimezoneUtils {
    if (!this.instances.has(timezone)) {
      this.instances.set(timezone, new TimezoneUtils(timezone))
    }
    const instance = this.instances.get(timezone)
    if (!instance) {
      throw new Error(`Failed to create timezone instance for ${timezone}`)
    }
    return instance
  }

  /**
   * Clear all cached instances (useful for testing)
   */
  static clear(): void {
    this.instances.clear()
  }

  /**
   * Create utils from user's location or preference
   */
  static forUser(user: { timezone?: string; location?: string }): TimezoneUtils {
    const timezone = user.timezone || this.getTimezoneFromLocation(user.location) || 'UTC'
    return this.get(timezone)
  }

  /**
   * Map location to timezone
   */
  private static getTimezoneFromLocation(location?: string): string | null {
    const locationMap: Record<string, string> = {
      bangkok: 'Asia/Bangkok',
      thailand: 'Asia/Bangkok',
      phuket: 'Asia/Bangkok',
      moscow: 'Europe/Moscow',
      russia: 'Europe/Moscow',
      london: 'Europe/London',
      uk: 'Europe/London',
      new_york: 'America/New_York',
      nyc: 'America/New_York',
      los_angeles: 'America/Los_Angeles',
      la: 'America/Los_Angeles',
      tokyo: 'Asia/Tokyo',
      japan: 'Asia/Tokyo',
      dubai: 'Asia/Dubai',
      uae: 'Asia/Dubai',
      singapore: 'Asia/Singapore',
      sydney: 'Australia/Sydney',
      australia: 'Australia/Sydney',
      berlin: 'Europe/Berlin',
      germany: 'Europe/Berlin',
      paris: 'Europe/Paris',
      france: 'Europe/Paris'
    }

    if (!location) return null

    const normalized = location.toLowerCase().replace(/[\s-]/g, '_')
    return locationMap[normalized] || null
  }
}

/**
 * Convenience exports for common timezones
 */
export const UTC = TimezoneFactory.get('UTC')
export const Bangkok = TimezoneFactory.get('Asia/Bangkok')
export const Moscow = TimezoneFactory.get('Europe/Moscow')
export const NewYork = TimezoneFactory.get('America/New_York')
export const London = TimezoneFactory.get('Europe/London')
export const Tokyo = TimezoneFactory.get('Asia/Tokyo')
export const Dubai = TimezoneFactory.get('Asia/Dubai')
export const Singapore = TimezoneFactory.get('Asia/Singapore')
export const Sydney = TimezoneFactory.get('Australia/Sydney')
