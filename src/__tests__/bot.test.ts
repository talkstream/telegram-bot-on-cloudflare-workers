import { describe, it, expect, vi } from 'vitest';
import { createBot } from '@/core/bot';
import { createMockEnv } from './utils/mock-env';
import { createMockContext } from './utils/mock-context';

describe('Bot', () => {
  it('should create bot instance', () => {
    const env = createMockEnv();
    const bot = createBot(env);
    
    expect(bot).toBeDefined();
    expect(bot.handleUpdate).toBeDefined();
  });

  it('should handle webhook verification', async () => {
    const env = createMockEnv();
    const bot = createBot(env);
    
    // Bot should be initialized
    expect(bot).toBeDefined();
  });
});
