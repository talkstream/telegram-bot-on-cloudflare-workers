/**
 * Mock Telegram Connector for deployment without real secrets
 *
 * This connector simulates Telegram bot behavior for testing and demo purposes.
 * It allows the framework to run without a real Telegram bot token.
 */

import { IMessagingConnector } from '../../../core/interfaces/messaging-connector';
import { BotContext } from '../../../core/bot-context';
import {
  MessageHandler,
  CommandHandler,
  CallbackHandler,
  ErrorHandler,
} from '../../../types/handlers';

export class MockTelegramConnector implements IMessagingConnector {
  public platform = 'telegram' as const;

  private handlers = {
    message: [] as MessageHandler[],
    command: new Map<string, CommandHandler>(),
    callback: new Map<string, CallbackHandler>(),
    error: [] as ErrorHandler[],
  };

  constructor(_config?: { token?: string; webhookSecret?: string }) {
    console.info('[MockTelegramConnector] Initialized in DEMO mode - no real Telegram connection');
  }

  async initialize(): Promise<void> {
    console.info('[MockTelegramConnector] Mock initialization complete');
  }

  async handleWebhook(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle health check
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          mode: 'demo',
          connector: 'MockTelegramConnector',
          timestamp: new Date().toISOString(),
          message: 'Wireframe v1.2 running in demo mode',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Simulate webhook response
    if (url.pathname.includes('/webhook')) {
      console.info('[MockTelegramConnector] Webhook request received (demo mode)');

      // Create a mock context for demo
      const mockCtx = this.createMockContext();

      // Simulate /start command
      if (this.handlers.command.has('start')) {
        const handler = this.handlers.command.get('start');
        if (handler) {
          await handler(mockCtx);
        }
      }

      return new Response('OK', { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  }

  async sendMessage(chatId: string | number, text: string, _options?: unknown): Promise<void> {
    console.info(`[MockTelegramConnector] Send message to ${chatId}: ${text}`);
  }

  async editMessage(
    chatId: string | number,
    messageId: number,
    text: string,
    _options?: unknown,
  ): Promise<void> {
    console.info(`[MockTelegramConnector] Edit message ${messageId} in ${chatId}: ${text}`);
  }

  async deleteMessage(chatId: string | number, messageId: number): Promise<void> {
    console.info(`[MockTelegramConnector] Delete message ${messageId} in ${chatId}`);
  }

  async setWebhook(url: string, _options?: unknown): Promise<void> {
    console.info(`[MockTelegramConnector] Set webhook to: ${url} (demo mode)`);
  }

  async deleteWebhook(): Promise<void> {
    console.info('[MockTelegramConnector] Delete webhook (demo mode)');
  }

  // Handler registration methods
  onMessage(handler: MessageHandler): void {
    this.handlers.message.push(handler);
  }

  onCommand(command: string, handler: CommandHandler): void {
    this.handlers.command.set(command, handler);
  }

  onCallback(pattern: string, handler: CallbackHandler): void {
    this.handlers.callback.set(pattern, handler);
  }

  onError(handler: ErrorHandler): void {
    this.handlers.error.push(handler);
  }

  // Create a mock context for testing
  private createMockContext(): BotContext {
    return {
      platform: 'telegram',
      update: {
        update_id: Date.now(),
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          chat: {
            id: 123456789,
            type: 'private',
            first_name: 'Demo',
            last_name: 'User',
            username: 'demo_user',
          },
          from: {
            id: 123456789,
            is_bot: false,
            first_name: 'Demo',
            last_name: 'User',
            username: 'demo_user',
            language_code: 'en',
          },
          text: '/start',
        },
      },
      chat: {
        id: 123456789,
        type: 'private',
      },
      from: {
        id: 123456789,
        is_bot: false,
        first_name: 'Demo',
        last_name: 'User',
        username: 'demo_user',
      },
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: 123456789,
          type: 'private',
        },
        from: {
          id: 123456789,
          is_bot: false,
          first_name: 'Demo',
          last_name: 'User',
        },
        text: '/start',
      },
      reply: async (text: string, _options?: unknown) => {
        console.info(`[MockContext] Reply: ${text}`);
      },
      replyWithMarkdown: async (text: string, _options?: unknown) => {
        console.info(`[MockContext] Reply with markdown: ${text}`);
      },
      editMessage: async (text: string, _options?: unknown) => {
        console.info(`[MockContext] Edit message: ${text}`);
      },
      deleteMessage: async () => {
        console.info('[MockContext] Delete message');
      },
      answerCallbackQuery: async (_options?: unknown) => {
        console.info('[MockContext] Answer callback query');
      },
    } as BotContext;
  }
}
