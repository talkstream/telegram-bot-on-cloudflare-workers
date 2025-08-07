import { D1Database } from '@cloudflare/workers-types'

import { logger } from '../lib/logger'

export class StarsService {
  private db: D1Database

  constructor(db: D1Database) {
    this.db = db
  }

  async awardStars(playerId: number, amount: number, reason: string): Promise<void> {
    try {
      await this.db
        .prepare('UPDATE users SET stars_balance = stars_balance + ? WHERE telegram_id = ?')
        .bind(amount, playerId)
        .run()
      logger.info(`Awarded ${amount} stars to player ${playerId} for reason: ${reason}`)
    } catch (error) {
      logger.error(`Failed to award stars to player ${playerId}:`, error)
      throw new Error('Failed to award stars')
    }
  }

  async deductStars(playerId: number, amount: number, reason: string): Promise<void> {
    try {
      await this.db
        .prepare('UPDATE users SET stars_balance = stars_balance - ? WHERE telegram_id = ?')
        .bind(amount, playerId)
        .run()
      logger.info(`Deducted ${amount} stars from player ${playerId} for reason: ${reason}`)
    } catch (error) {
      logger.error(`Failed to deduct stars from player ${playerId}:`, error)
      throw new Error('Failed to deduct stars')
    }
  }

  async getStarsBalance(playerId: number): Promise<number> {
    try {
      const result = await this.db
        .prepare('SELECT stars_balance FROM users WHERE telegram_id = ?')
        .bind(playerId)
        .first<{ stars_balance: number }>()
      return result?.stars_balance || 0
    } catch (error) {
      logger.error(`Failed to get stars balance for player ${playerId}:`, error)
      throw new Error('Failed to get stars balance')
    }
  }
}
