/**
 * Universal timezone utilities for bot applications
 *
 * Production tested with GMT+7 (Bangkok timezone)
 * @module lib/utils/timezone
 */

import { format as dateFnsFormat, parse, isValid } from 'date-fns';
import { tz } from '@date-fns/tz';

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
  private timezoneName: string;

  constructor(timezoneName: string = 'UTC') {
    this.timezoneName = timezoneName;
  }

  /**
   * Format date in specified timezone
   */
  format(date: Date | string | number, formatStr: string): string {
    const dateObj = this.normalizeDate(date);

    if (!isValid(dateObj)) {
      console.error('Invalid date provided to format:', date);
      return 'Invalid date';
    }

    return dateFnsFormat(dateObj, formatStr, { in: tz(this.timezoneName) });
  }

  /**
   * Get current date in timezone
   */
  now(): Date {
    return new Date();
  }

  /**
   * Parse date string in timezone context
   */
  parse(dateString: string, formatStr: string): Date {
    // Parse the date string with the format in UTC first
    const parsed = parse(dateString, formatStr, new Date());

    if (!isValid(parsed)) {
      return new Date('Invalid Date');
    }

    // The parsed date is already a valid Date object
    // When used with formatting, the timezone context will be applied
    return parsed;
  }

  /**
   * Format date for bot messages (localized)
   */
  formatBotDate(date: Date | string | number): string {
    return this.format(date, 'dd.MM.yyyy');
  }

  /**
   * Format time for bot messages (localized)
   */
  formatBotTime(date: Date | string | number): string {
    return this.format(date, 'HH:mm');
  }

  /**
   * Format date and time for bot messages (localized)
   */
  formatBotDateTime(date: Date | string | number): string {
    return this.format(date, 'HH:mm dd.MM.yyyy');
  }

  /**
   * Get timezone offset in hours
   */
  getOffset(): number {
    const date = new Date();
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: this.timezoneName }));
    return Math.round((tzDate.getTime() - utcDate.getTime()) / 3600000);
  }

  /**
   * Get timezone abbreviation (e.g., 'PST', 'GMT+7')
   */
  getAbbreviation(): string {
    const offset = this.getOffset();
    if (offset === 0) return 'UTC';
    const sign = offset > 0 ? '+' : '';
    return `GMT${sign}${offset}`;
  }

  /**
   * Check if date is in business hours (9 AM - 6 PM local time)
   */
  isBusinessHours(date?: Date): boolean {
    const checkDate = date || new Date();
    const localHour = parseInt(this.format(checkDate, 'HH'));
    return localHour >= 9 && localHour < 18;
  }

  /**
   * Get next occurrence of a local time
   */
  getNextOccurrence(hour: number, minute: number = 0): Date {
    const now = new Date();

    // Create a date for today at the target time in local timezone
    const todayStr = this.format(now, 'yyyy-MM-dd');
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

    // Parse the target datetime string
    const todayTarget = parse(`${todayStr} ${timeStr}`, 'yyyy-MM-dd HH:mm', new Date());

    // Adjust for timezone offset to get the UTC time
    const offset = this.getOffset();
    const todayTargetUTC = new Date(todayTarget.getTime() - offset * 3600000);

    // If this time has already passed, move to tomorrow
    if (todayTargetUTC <= now) {
      return new Date(todayTargetUTC.getTime() + 24 * 3600000);
    }

    return todayTargetUTC;
  }

  private normalizeDate(date: Date | string | number): Date {
    if (typeof date === 'string' || typeof date === 'number') {
      return new Date(date);
    }
    return date;
  }
}

/**
 * Factory for creating timezone utils
 */
export class TimezoneFactory {
  private static instances: Map<string, TimezoneUtils> = new Map();

  /**
   * Get or create timezone utils for specific timezone
   */
  static get(timezone: string): TimezoneUtils {
    if (!this.instances.has(timezone)) {
      this.instances.set(timezone, new TimezoneUtils(timezone));
    }
    const instance = this.instances.get(timezone);
    if (!instance) {
      throw new Error(`Failed to create timezone instance for ${timezone}`);
    }
    return instance;
  }

  /**
   * Create utils from user's location or preference
   */
  static forUser(user: { timezone?: string; location?: string }): TimezoneUtils {
    const timezone = user.timezone || this.getTimezoneFromLocation(user.location) || 'UTC';
    return this.get(timezone);
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
      france: 'Europe/Paris',
    };

    if (!location) return null;
    return locationMap[location.toLowerCase()] || null;
  }

  /**
   * Clear cached instances (useful for tests)
   */
  static clear(): void {
    this.instances.clear();
  }
}

// Convenience exports for common timezones
export const UTC = TimezoneFactory.get('UTC');
export const Bangkok = TimezoneFactory.get('Asia/Bangkok');
export const Moscow = TimezoneFactory.get('Europe/Moscow');
export const NewYork = TimezoneFactory.get('America/New_York');
export const London = TimezoneFactory.get('Europe/London');
export const Tokyo = TimezoneFactory.get('Asia/Tokyo');
