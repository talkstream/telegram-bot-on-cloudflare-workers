/**
 * Tests for Message Transformer
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { MessageTransformer } from '../../../src/core/omnichannel/message-transformer.js';
import type { UnifiedMessage } from '../../../src/core/interfaces/messaging.js';
import { MessageType, ChatType, Platform } from '../../../src/core/interfaces/messaging.js';

describe('MessageTransformer', () => {
  let transformer: MessageTransformer;

  beforeEach(() => {
    transformer = new MessageTransformer();
  });

  describe('Telegram to WhatsApp', () => {
    it('should transform text message', () => {
      const telegramMessage: UnifiedMessage = {
        id: '123',
        platform: Platform.TELEGRAM,
        sender: { id: '456', username: 'testuser' },
        chat: { id: '789', type: ChatType.PRIVATE },
        content: {
          type: MessageType.TEXT,
          text: 'Hello from Telegram!',
        },
        timestamp: Date.now(),
      };

      const result = transformer.toPlatform(telegramMessage, Platform.WHATSAPP);

      expect(result.platform).toBe(Platform.WHATSAPP);
      expect(result.data.type).toBe('text');
      expect((result.data as { text: { body: string } }).text.body).toBe('Hello from Telegram!');
    });

    it('should transform inline keyboard to WhatsApp buttons', () => {
      const telegramMessage: UnifiedMessage = {
        id: '123',
        platform: Platform.TELEGRAM,
        sender: { id: '456' },
        content: {
          type: MessageType.TEXT,
          text: 'Choose an option',
          markup: {
            type: 'inline',
            inline_keyboard: [[
              { text: 'Option 1', callback_data: 'opt1' },
              { text: 'Option 2', callback_data: 'opt2' },
              { text: 'Option 3', callback_data: 'opt3' },
              { text: 'Option 4', callback_data: 'opt4' }, // Should be ignored (max 3)
            ]],
          },
        },
        timestamp: Date.now(),
      };

      const result = transformer.toPlatform(telegramMessage, Platform.WHATSAPP);

      expect(result.data.type).toBe('interactive');
      const interactive = (result.data as { interactive: { type: string; action: { buttons: Array<unknown> } } }).interactive;
      expect(interactive.type).toBe('button');
      expect(interactive.action.buttons).toHaveLength(3); // Max 3 buttons
      expect(interactive.action.buttons[0].reply.title).toBe('Option 1');
    });
  });

  describe('WhatsApp to Telegram', () => {
    it('should transform interactive buttons to inline keyboard', () => {
      const whatsappMessage: UnifiedMessage = {
        id: '123',
        platform: Platform.WHATSAPP,
        sender: { id: '456' },
        content: {
          type: MessageType.TEXT,
          text: 'Choose an option',
        },
        metadata: {
          interactive: {
            type: 'button',
            action: {
              buttons: [
                { reply: { id: 'btn1', title: 'Button 1' } },
                { reply: { id: 'btn2', title: 'Button 2' } },
              ],
            },
          },
        },
        timestamp: Date.now(),
      };

      const result = transformer.toPlatform(whatsappMessage, Platform.TELEGRAM);

      expect(result.platform).toBe(Platform.TELEGRAM);
      const replyMarkup = (result.data as { reply_markup: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } }).reply_markup;
      expect(replyMarkup.inline_keyboard).toBeDefined();
      expect(replyMarkup.inline_keyboard[0][0].text).toBe('Button 1');
      expect(replyMarkup.inline_keyboard[0][0].callback_data).toBe('btn1');
    });
  });

  describe('Telegram to Discord', () => {
    it('should transform inline keyboard to Discord components', () => {
      const telegramMessage: UnifiedMessage = {
        id: '123',
        platform: Platform.TELEGRAM,
        sender: { id: '456' },
        content: {
          type: MessageType.TEXT,
          text: 'Click a button',
          markup: {
            type: 'inline',
            inline_keyboard: [[
              { text: 'Click me', callback_data: 'click' },
              { text: 'Visit', url: 'https://example.com' },
            ]],
          },
        },
        timestamp: Date.now(),
      };

      const result = transformer.toPlatform(telegramMessage, Platform.DISCORD);

      expect(result.platform).toBe(Platform.DISCORD);
      const components = (result.data as { components: Array<{ type: number; components: Array<{ label: string; style: number }> }> }).components;
      expect(components).toHaveLength(1);
      expect(components[0].type).toBe(1); // Action row
      expect(components[0].components[0].label).toBe('Click me');
      expect(components[0].components[1].style).toBe(5); // Link style
    });
  });

  describe('fromPlatform conversions', () => {
    it('should convert Telegram format to unified', () => {
      const telegramData = {
        message_id: 123,
        from: {
          id: 456,
          username: 'testuser',
          first_name: 'Test',
          last_name: 'User',
        },
        chat: {
          id: 789,
          type: 'private',
        },
        text: 'Hello world',
        date: Math.floor(Date.now() / 1000),
      };

      const result = transformer.fromPlatform({
        platform: Platform.TELEGRAM,
        data: telegramData,
      });

      expect(result.platform).toBe(Platform.TELEGRAM);
      expect(result.id).toBe('123');
      expect(result.sender?.username).toBe('testuser');
      expect(result.content.text).toBe('Hello world');
    });

    it('should convert WhatsApp format to unified', () => {
      const whatsappData = {
        id: 'wa123',
        from: '1234567890',
        type: 'text',
        text: { body: 'Hello from WhatsApp' },
        timestamp: Math.floor(Date.now() / 1000).toString(),
      };

      const result = transformer.fromPlatform({
        platform: Platform.WHATSAPP,
        data: whatsappData,
      });

      expect(result.platform).toBe(Platform.WHATSAPP);
      expect(result.sender?.id).toBe('1234567890');
      expect(result.content.text).toBe('Hello from WhatsApp');
    });

    it('should convert Discord format to unified', () => {
      const discordData = {
        id: 'disc123',
        content: 'Discord message',
        author: {
          id: '987654321',
          username: 'discorduser',
          global_name: 'Discord User',
        },
        channel_id: 'channel123',
        timestamp: new Date().toISOString(),
      };

      const result = transformer.fromPlatform({
        platform: Platform.DISCORD,
        data: discordData,
      });

      expect(result.platform).toBe(Platform.DISCORD);
      expect(result.sender?.username).toBe('discorduser');
      expect(result.content.text).toBe('Discord message');
    });
  });

  describe('Custom transformation rules', () => {
    it('should use custom rule when provided', () => {
      const customTransformer = new MessageTransformer({
        customRules: [{
          from: 'telegram',
          to: 'slack',
          transform: (message) => ({
            platform: Platform.SLACK,
            data: {
              text: `Custom: ${message.content.text}`,
              custom: true,
            },
          }),
        }],
      });

      const message: UnifiedMessage = {
        id: '123',
        platform: Platform.TELEGRAM,
        content: { type: MessageType.TEXT, text: 'Test' },
        timestamp: Date.now(),
      };

      const result = customTransformer.toPlatform(message, Platform.SLACK);
      expect(result.platform).toBe(Platform.SLACK);
      const data = result.data as { text: string; custom: boolean };
      expect(data.text).toBe('Custom: Test');
      expect(data.custom).toBe(true);
    });
  });

  describe('Generic transformations', () => {
    it('should handle unsupported platform pairs gracefully', () => {
      const message: UnifiedMessage = {
        id: '123',
        platform: Platform.LINE, // Using LINE platform
        sender: { id: '456' },
        chat: { id: '789', type: ChatType.PRIVATE },
        content: { type: MessageType.TEXT, text: 'Generic message' },
        timestamp: Date.now(),
      };

      const result = transformer.toPlatform(message, Platform.VIBER);
      expect(result.platform).toBe(Platform.VIBER);
      expect((result.data as { text: string }).text).toBe('Generic message');
    });
  });
});