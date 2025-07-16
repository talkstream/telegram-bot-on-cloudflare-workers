import { D1Database } from '@cloudflare/workers-types';

export interface User {
  id: number;
  telegram_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  stars_balance: number;
}

export class UserService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getUser(telegramId: number): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE telegram_id = ?');
    const result = await stmt.bind(telegramId).first<User>();
    return result;
  }

  async createUser(user: Omit<User, 'id' | 'stars_balance'>): Promise<void> {
    const stmt = this.db.prepare(
      'INSERT INTO users (telegram_id, first_name, last_name, username, stars_balance) VALUES (?, ?, ?, ?, ?)'
    );
    await stmt.bind(user.telegram_id, user.first_name, user.last_name, user.username, 0).run();
  }
}
