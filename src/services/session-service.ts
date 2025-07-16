import type { KVNamespace } from '@cloudflare/workers-types';

export interface UserSession {
  userId: number;
  step: string;
  data: Record<string, unknown>;
}

export class SessionService {
  private sessionsKv: KVNamespace;

  constructor(sessionsKv: KVNamespace) {
    this.sessionsKv = sessionsKv;
  }

  async getSession(userId: number): Promise<UserSession | null> {
    const sessionStr = await this.sessionsKv.get(String(userId));
    return sessionStr ? JSON.parse(sessionStr) : null;
  }

  async saveSession(session: UserSession): Promise<void> {
    await this.sessionsKv.put(String(session.userId), JSON.stringify(session));
  }

  async deleteSession(userId: number): Promise<void> {
    await this.sessionsKv.delete(String(userId));
  }
}
