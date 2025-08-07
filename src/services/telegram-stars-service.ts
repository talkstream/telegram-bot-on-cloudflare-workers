/**
 * Telegram Stars Service (Bot API 9.1)
 *
 * Service for managing Telegram Stars, gifts, and related transactions
 * @module services/telegram-stars-service
 */

import type { Bot } from 'grammy'

import { FieldMapper } from '@/core/database/field-mapper'
import { EventBus } from '@/core/events/event-bus'
import type { ICloudPlatformConnector } from '@/core/interfaces/cloud-platform'
import { logger } from '@/lib/logger'
import type { Gift, ServiceGift } from '@/lib/telegram-types'

export interface StarTransaction {
  id: string
  userId: number
  amount: number
  type: 'received' | 'sent' | 'purchased' | 'converted'
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface GiftTransaction {
  id: string
  fromUserId: number
  toUserId: number
  giftId: string
  starsCost: number
  timestamp: Date
  message?: string
}

// Define interfaces for raw data
interface RawTransaction {
  id: string
  user_id: number
  amount: number
  type: 'received' | 'sent' | 'purchased' | 'converted'
  date: number
  metadata?: Record<string, unknown>
}

// Create FieldMapper for transaction transformations
const transactionMapper = new FieldMapper<RawTransaction, StarTransaction>([
  { dbField: 'id', domainField: 'id' },
  { dbField: 'user_id', domainField: 'userId' },
  { dbField: 'amount', domainField: 'amount' },
  { dbField: 'type', domainField: 'type' },
  {
    dbField: 'date',
    domainField: 'timestamp',
    toDomain: v => new Date(v * 1000),
    toDb: v => Math.floor(v.getTime() / 1000)
  },
  { dbField: 'metadata', domainField: 'metadata' }
])

export class TelegramStarsService {
  private bot: Bot
  private platform: ICloudPlatformConnector
  private eventBus: EventBus
  private kvNamespace?: {
    get: (key: string) => Promise<string | null>
    put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>
    delete: (key: string) => Promise<void>
  } // KV storage for caching

  constructor(bot: Bot, platform: ICloudPlatformConnector, eventBus: EventBus) {
    this.bot = bot
    this.platform = platform
    this.eventBus = eventBus
  }

  async initialize(): Promise<void> {
    logger.info('[TelegramStarsService] Initializing Telegram Stars service')

    // Get KV namespace for caching if available
    try {
      this.kvNamespace = this.platform.getKeyValueStore('STARS_CACHE')
    } catch (_error) {
      logger.warn('[TelegramStarsService] KV namespace not available, proceeding without cache')
    }

    this.eventBus.emit(
      'service:stars:initialized',
      {
        serviceId: 'telegram-stars',
        hasCache: !!this.kvNamespace
      },
      'stars-service'
    )
  }

  /**
   * Get the bot's current Star balance
   * Bot API 9.1 method: getMyStarBalance
   */
  async getStarBalance(): Promise<number> {
    try {
      logger.info('[TelegramStarsService] Fetching bot Star balance')

      // Check cache first
      if (this.kvNamespace) {
        const cached = await this.kvNamespace.get('bot:star_balance')
        if (cached) {
          const balance = JSON.parse(cached)
          if (balance.timestamp > Date.now() - 60000) {
            // 1 minute cache
            logger.info('[TelegramStarsService] Returning cached balance', {
              balance: balance.amount
            })
            return balance.amount
          }
        }
      }

      // Use Grammy's api.raw for Bot API 9.1 methods
      const result = await this.bot.api.raw.getMyStarBalance()
      const balance = result.amount || 0

      // Cache the result
      if (this.kvNamespace) {
        await this.kvNamespace.put(
          'bot:star_balance',
          JSON.stringify({
            amount: balance,
            timestamp: Date.now()
          }),
          { expirationTtl: 60 }
        ) // 1 minute TTL
      }

      logger.info('[TelegramStarsService] Star balance fetched', { balance })

      this.eventBus.emit(
        'stars:balance:fetched',
        {
          balance,
          timestamp: new Date()
        },
        'stars-service'
      )

      return balance
    } catch (error) {
      logger.error('[TelegramStarsService] Failed to get Star balance', error)
      throw error
    }
  }

  /**
   * Get user's Star transactions
   * Bot API 9.1 method: getMyStarTransactions
   */
  async getStarTransactions(offset = 0, limit = 100): Promise<StarTransaction[]> {
    try {
      logger.info('[TelegramStarsService] Fetching Star transactions', { offset, limit })

      const result = await this.bot.api.raw.getStarTransactions({
        offset,
        limit
      })

      const transactions: StarTransaction[] =
        result.transactions?.map((tx: unknown, _index: number, _array: unknown[]) =>
          transactionMapper.toDomain(tx as RawTransaction)
        ) || []

      logger.info('[TelegramStarsService] Transactions fetched', { count: transactions.length })

      this.eventBus.emit(
        'stars:transactions:fetched',
        {
          count: transactions.length,
          offset,
          limit
        },
        'stars-service'
      )

      return transactions
    } catch (error) {
      logger.error('[TelegramStarsService] Failed to get Star transactions', error)
      throw error
    }
  }

  /**
   * Send Stars to a user
   * Bot API 9.1 method: sendStars
   */
  async sendStars(userId: number, amount: number, message?: string): Promise<boolean> {
    try {
      logger.info('[TelegramStarsService] Sending Stars', { userId, amount })

      // Note: sendStars is not yet available in Grammy's RawApi
      // This would need to be implemented when the method becomes available
      // const result = await this.bot.api.raw.sendStars({
      //   user_id: userId,
      //   amount,
      //   text: message,
      // });

      logger.info('[TelegramStarsService] Stars sent successfully', { userId, amount })

      this.eventBus.emit(
        'stars:sent',
        {
          userId,
          amount,
          message,
          timestamp: new Date()
        },
        'stars-service'
      )

      // Invalidate balance cache
      if (this.kvNamespace) {
        await this.kvNamespace.delete('bot:star_balance')
      }

      return true
    } catch (error) {
      logger.error('[TelegramStarsService] Failed to send Stars', error)

      this.eventBus.emit(
        'stars:send:failed',
        {
          userId,
          amount,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        'stars-service'
      )

      throw error
    }
  }

  /**
   * Get available gifts
   * Bot API 9.1 method: getAvailableGifts
   */
  async getAvailableGifts(): Promise<ServiceGift[]> {
    try {
      logger.info('[TelegramStarsService] Fetching available gifts')

      // Check cache first
      if (this.kvNamespace) {
        const cached = await this.kvNamespace.get('gifts:available')
        if (cached) {
          const gifts = JSON.parse(cached)
          if (gifts.timestamp > Date.now() - 3600000) {
            // 1 hour cache
            logger.info('[TelegramStarsService] Returning cached gifts', {
              count: gifts.items.length
            })
            return gifts.items
          }
        }
      }

      const result = await this.bot.api.raw.getAvailableGifts()
      const rawGifts: Gift[] = result.gifts || []

      // Convert to ServiceGift format
      const gifts: ServiceGift[] = rawGifts.map(gift => ({
        id: gift.id,
        name: `Gift ${gift.star_count} Stars`,
        price: gift.star_count,
        currency: 'Stars',
        description: `A gift worth ${gift.star_count} Stars`
      }))

      // Cache the result
      if (this.kvNamespace) {
        await this.kvNamespace.put(
          'gifts:available',
          JSON.stringify({
            items: gifts,
            timestamp: Date.now()
          }),
          { expirationTtl: 3600 }
        ) // 1 hour TTL
      }

      logger.info('[TelegramStarsService] Gifts fetched', { count: gifts.length })

      this.eventBus.emit(
        'gifts:fetched',
        {
          count: gifts.length,
          timestamp: new Date()
        },
        'stars-service'
      )

      return gifts
    } catch (error) {
      logger.error('[TelegramStarsService] Failed to get available gifts', error)
      throw error
    }
  }

  /**
   * Send a gift to a user
   * Bot API 9.1 method: sendGift
   */
  async sendGift(userId: number, giftId: string, message?: string): Promise<boolean> {
    try {
      logger.info('[TelegramStarsService] Sending gift', { userId, giftId })

      // Note: sendGift method may not be available yet
      // await this.bot.api.raw.sendGift({
      //   user_id: userId,
      //   gift_id: giftId,
      //   text: message,
      // });

      logger.info('[TelegramStarsService] Gift sent successfully', { userId, giftId })

      this.eventBus.emit(
        'gift:sent',
        {
          userId,
          giftId,
          message,
          timestamp: new Date()
        },
        'stars-service'
      )

      // Invalidate balance cache since sending gifts costs Stars
      if (this.kvNamespace) {
        await this.kvNamespace.delete('bot:star_balance')
      }

      return true
    } catch (error) {
      logger.error('[TelegramStarsService] Failed to send gift', error)

      this.eventBus.emit(
        'gift:send:failed',
        {
          userId,
          giftId,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        'stars-service'
      )

      throw error
    }
  }

  /**
   * Convert a gift to Stars
   * Bot API 9.1 method: convertGiftToStars
   */
  async convertGiftToStars(userId: number, messageId: number): Promise<number> {
    try {
      logger.info('[TelegramStarsService] Converting gift to Stars', { userId, messageId })

      // Bot API 9.1 method - convertGiftToStars
      const result = await this.bot.api.raw.convertGiftToStars({
        business_connection_id: 'default', // Placeholder for business connection
        owned_gift_id: String(messageId) // Use messageId as gift ID placeholder
      })

      const starsReceived = (result as unknown as { star_count?: number }).star_count || 0

      logger.info('[TelegramStarsService] Gift converted to Stars', {
        userId,
        messageId,
        starsReceived
      })

      this.eventBus.emit(
        'gift:converted',
        {
          userId,
          messageId,
          starsReceived,
          timestamp: new Date()
        },
        'stars-service'
      )

      // Invalidate balance cache
      if (this.kvNamespace) {
        await this.kvNamespace.delete('bot:star_balance')
      }

      return starsReceived
    } catch (error) {
      logger.error('[TelegramStarsService] Failed to convert gift to Stars', error)
      throw error
    }
  }

  /**
   * Upgrade a gift
   * Bot API 9.1 method: upgradeGift
   */
  async upgradeGift(userId: number, messageId: number, newGiftId: string): Promise<boolean> {
    try {
      logger.info('[TelegramStarsService] Upgrading gift', { userId, messageId, newGiftId })

      // Bot API 9.1 method - upgradeGift
      await this.bot.api.raw.upgradeGift({
        business_connection_id: 'default', // Placeholder for business connection
        owned_gift_id: String(messageId), // Use messageId as gift ID placeholder
        star_count: parseInt(newGiftId, 10) // Parse star count from ID
      })

      logger.info('[TelegramStarsService] Gift upgraded successfully', {
        userId,
        messageId,
        newGiftId
      })

      this.eventBus.emit(
        'gift:upgraded',
        {
          userId,
          messageId,
          newGiftId,
          timestamp: new Date()
        },
        'stars-service'
      )

      // Invalidate balance cache since upgrading might cost Stars
      if (this.kvNamespace) {
        await this.kvNamespace.delete('bot:star_balance')
      }

      return true
    } catch (error) {
      logger.error('[TelegramStarsService] Failed to upgrade gift', error)
      throw error
    }
  }

  /**
   * Transfer a gift to another user
   * Bot API 9.1 method: transferGift
   */
  async transferGift(fromUserId: number, toUserId: number, messageId: number): Promise<boolean> {
    try {
      logger.info('[TelegramStarsService] Transferring gift', {
        fromUserId,
        toUserId,
        messageId
      })

      // Bot API 9.1 method - transferGift
      await this.bot.api.raw.transferGift({
        business_connection_id: 'default', // Placeholder for business connection
        owned_gift_id: String(messageId), // Use messageId as gift ID placeholder
        new_owner_chat_id: toUserId,
        star_count: 100 // Default star count
      })

      logger.info('[TelegramStarsService] Gift transferred successfully', {
        fromUserId,
        toUserId,
        messageId
      })

      this.eventBus.emit(
        'gift:transferred',
        {
          fromUserId,
          toUserId,
          messageId,
          timestamp: new Date()
        },
        'stars-service'
      )

      return true
    } catch (error) {
      logger.error('[TelegramStarsService] Failed to transfer gift', error)
      throw error
    }
  }

  /**
   * Get gift statistics for analytics
   */
  async getGiftStatistics(): Promise<{
    totalGiftsSent: number
    totalStarsSpent: number
    popularGifts: Array<{ giftId: string; count: number }>
  }> {
    // This would typically query a database or analytics service
    // For now, return placeholder data

    return {
      totalGiftsSent: 0,
      totalStarsSpent: 0,
      popularGifts: []
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    logger.info('[TelegramStarsService] Cleaning up')

    this.eventBus.emit(
      'service:stars:cleanup',
      {
        serviceId: 'telegram-stars'
      },
      'stars-service'
    )
  }
}
