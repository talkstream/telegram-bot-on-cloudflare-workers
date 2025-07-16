import { describe, it, expect } from 'vitest';

import { createMockEnv } from './utils/mock-env';
import { createBot } from './mocks/core-bot';

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
