import { describe, it, expect, beforeEach } from 'vitest';
import type { BotCommand } from 'grammy/types';

import '../mocks/core-bot'; // Import the mock
import { createMockEnv } from '../utils/mock-env';

import { createBot } from '@/core/bot';

describe('Bot Commands Registration', () => {
  const mockEnv = createMockEnv();

  beforeEach(() => {
    // Don't clear mocks since we need the module mock
  });

  it('should register all required commands with proper descriptions', async () => {
    const bot = await createBot(mockEnv);

    // Get the registered commands
    const commands = await bot.api.getMyCommands();

    // Check that commands array exists and has the expected commands
    expect(commands).toBeDefined();
    expect(Array.isArray(commands)).toBe(true);
    expect(commands.length).toBeGreaterThan(0);

    // Check for specific commands
    const commandNames = commands.map((c: BotCommand) => c.command);
    expect(commandNames).toContain('start');
    expect(commandNames).toContain('help');
    expect(commandNames).toContain('balance');
    expect(commandNames).toContain('settings');
    expect(commandNames).toContain('pay');
    expect(commandNames).toContain('stats');

    // Check descriptions
    const helpCommand = commands.find((c: BotCommand) => c.command === 'help');
    expect(helpCommand).toBeDefined();
    expect(helpCommand?.description).toBeTruthy();
    expect(helpCommand?.description).toContain('help');
  });
});
