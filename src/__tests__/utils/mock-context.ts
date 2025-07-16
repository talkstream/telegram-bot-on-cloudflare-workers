import { vi } from 'vitest';
import type { BotContext } from '@/types';
import { createMockEnv } from './mock-env';

export interface MockContextOptions {
  from?: any;
  chat?: any;
  message?: any;
  callbackQuery?: any;
  me?: any;
  env?: any;
}

export function createMockContext(options: MockContextOptions = {}): BotContext {
  const mockSession = {
    userId: undefined,
    username: undefined,
    languageCode: undefined,
    lastCommand: undefined,
    lastActivity: undefined,
    customData: {},
  };

  const mockContext = {
    // Basic context properties
    from: 'from' in options ? options.from : {
      id: 123456,
      is_bot: false,
      first_name: 'Test',
      username: 'testuser',
    },
    
    chat: options.chat || {
      id: 123456,
      type: 'private',
    },
    
    message: options.message || {
      message_id: 1,
      date: Date.now(),
      chat: options.chat || { id: 123456, type: 'private' },
      from: 'from' in options ? options.from : { id: 123456, is_bot: false },
      text: '/start',
    },
    
    callbackQuery: options.callbackQuery,
    
    me: options.me || {
      id: 987654,
      is_bot: true,
      first_name: 'Test Bot',
      username: 'testbot',
    },
    
    // Session
    session: mockSession,
    
    // Methods
    reply: vi.fn().mockResolvedValue({ ok: true }),
    replyWithInvoice: vi.fn().mockResolvedValue({ ok: true }),
    editMessageText: vi.fn().mockResolvedValue({ ok: true }),
    answerCallbackQuery: vi.fn().mockResolvedValue({ ok: true }),
    
    // Request object
    req: {
      param: vi.fn(),
      header: vi.fn(),
      query: vi.fn(),
      json: vi.fn(),
    },
    
    // Response helpers
    text: vi.fn(),
    json: vi.fn(),
    header: vi.fn(),
    
    // Environment
    env: options.env || createMockEnv(),
    
    // API
    api: {
      setMyCommands: vi.fn().mockResolvedValue({ ok: true }),
      getMyCommands: vi.fn().mockResolvedValue([
        { command: 'start', description: 'Start the bot' },
        { command: 'help', description: 'Show help' },
        { command: 'profile', description: 'View profile' },
        { command: 'settings', description: 'Bot settings' },
        { command: 'balance', description: 'Check balance' },
      ]),
      sendMessage: vi.fn().mockResolvedValue({ ok: true }),
      sendInvoice: vi.fn().mockResolvedValue({ ok: true }),
    },
    
    // Response
    res: {
      status: 200,
    },
  } as unknown as BotContext;
  
  return mockContext;
}

export function createMockCallbackContext(data: string, options: MockContextOptions = {}): BotContext {
  return createMockContext({
    ...options,
    callbackQuery: {
      id: '123456789',
      from: options.from || {
        id: 123456,
        is_bot: false,
        first_name: 'Test',
        username: 'testuser',
      },
      data,
      message: options.message || {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123456, type: 'private' },
      },
    },
  });
}