import type { Env } from '@/types';
import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/lib/logger';

export interface User {
  id: number;
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  languageCode?: string;
  isPremium?: boolean;
  starsBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  languageCode?: string;
  isPremium?: boolean;
}

export class UserService {
  constructor(private db: D1Database) {}

  async createOrUpdateUser(data: CreateUserData): Promise<User> {
    const existingUser = await this.getByTelegramId(data.telegramId);
    
    if (existingUser) {
      // Update existing user
      await this.db.prepare(`
        UPDATE users 
        SET username = ?, first_name = ?, last_name = ?, 
            language_code = ?, is_premium = ?, updated_at = CURRENT_TIMESTAMP
        WHERE telegram_id = ?
      `).bind(
        data.username || null,
        data.firstName,
        data.lastName || null,
        data.languageCode || null,
        data.isPremium ? 1 : 0,
        data.telegramId
      ).run();
      
      logger.info('Updated existing user', { telegramId: data.telegramId });
      return this.getByTelegramId(data.telegramId) as Promise<User>;
    } else {
      // Create new user
      const result = await this.db.prepare(`
        INSERT INTO users (telegram_id, username, first_name, last_name, 
                          language_code, is_premium, stars_balance, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        data.telegramId,
        data.username || null,
        data.firstName,
        data.lastName || null,
        data.languageCode || null,
        data.isPremium ? 1 : 0
      ).run();
      
      logger.info('Created new user', { telegramId: data.telegramId });
      
      // Return the created user
      return {
        id: result.meta.last_row_id as number,
        telegramId: data.telegramId,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        languageCode: data.languageCode,
        isPremium: data.isPremium,
        starsBalance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  async getByTelegramId(telegramId: number): Promise<User | null> {
    const result = await this.db.prepare(`
      SELECT id, telegram_id as telegramId, username, first_name as firstName, 
             last_name as lastName, language_code as languageCode, 
             is_premium as isPremium, stars_balance as starsBalance,
             created_at as createdAt, updated_at as updatedAt
      FROM users 
      WHERE telegram_id = ?
    `).bind(telegramId).first<User>();
    
    return result;
  }

  async getById(id: number): Promise<User | null> {
    const result = await this.db.prepare(`
      SELECT id, telegram_id as telegramId, username, first_name as firstName, 
             last_name as lastName, language_code as languageCode, 
             is_premium as isPremium, stars_balance as starsBalance,
             created_at as createdAt, updated_at as updatedAt
      FROM users 
      WHERE id = ?
    `).bind(id).first<User>();
    
    return result;
  }

  async updateStarsBalance(userId: number, amount: number): Promise<void> {
    await this.db.prepare(`
      UPDATE users 
      SET stars_balance = stars_balance + ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(amount, userId).run();
    
    logger.info('Updated stars balance', { userId, amount });
  }
}

// Factory function to create UserService instance
export function getUserService(env: Env): UserService {
  return new UserService(env.DB);
}
