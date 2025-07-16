import { describe, it, expect, vi } from 'vitest';
import { createBot } from '../core/bot';
import { Env } from '../config/env';

describe('Bot', () => {
  it('should reply to /start command', async () => {
    const env: Env = {
      TELEGRAM_BOT_TOKEN: 'test-token',
    };
    const bot = createBot(env);

    const ctx = {
      reply: vi.fn(),
    };

    await bot.handleUpdate({ message: { text: '/start', chat: { id: 123 } } } as any, ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith('Welcome! Up and running.');
  });
});
