/**
 * Tests for WhatsApp Business API Connector
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { WhatsAppConnector } from '../../../../src/connectors/messaging/whatsapp/whatsapp-connector.js';
import {
  Platform,
  MessageType,
  AttachmentType,
} from '../../../../src/core/interfaces/messaging.js';
import type { UnifiedMessage } from '../../../../src/core/interfaces/messaging.js';
import { createEventBus } from '../../../../src/core/events/event-bus.js';
import { ConsoleLogger } from '../../../../src/core/logging/console-logger.js';

// Mock fetch
global.fetch = vi.fn();

describe('WhatsAppConnector', () => {
  let connector: WhatsAppConnector;
  let config: {
    accessToken: string;
    phoneNumberId: string;
    businessAccountId: string;
    verifyToken: string;
    eventBus: ReturnType<typeof createEventBus>;
    logger: ConsoleLogger;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      accessToken: 'test-token',
      phoneNumberId: 'test-phone-id',
      businessAccountId: 'test-business-id',
      verifyToken: 'test-verify-token',
      eventBus: createEventBus(),
      logger: new ConsoleLogger('error'),
    };

    connector = new WhatsAppConnector();
  });

  describe('initialization', () => {
    it('should initialize with valid config', async () => {
      await connector.initialize(config);
      expect(connector.isReady()).toBe(true);
    });

    it('should fail without access token', async () => {
      const invalidConfig = { ...config, accessToken: undefined } as unknown as typeof config;
      await expect(connector.initialize(invalidConfig)).rejects.toThrow(
        'WhatsApp access token is required',
      );
    });

    it('should fail without phone number ID', async () => {
      const invalidConfig = { ...config, phoneNumberId: undefined } as unknown as typeof config;
      await expect(connector.initialize(invalidConfig)).rejects.toThrow(
        'WhatsApp phone number ID is required',
      );
    });
  });

  describe('sendMessage', () => {
    beforeEach(async () => {
      await connector.initialize(config);
    });

    it('should send text message', async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            messages: [{ id: 'msg-123' }],
          }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const message: UnifiedMessage = {
        id: '1',
        platform: Platform.WHATSAPP,
        content: {
          type: MessageType.TEXT,
          text: 'Hello WhatsApp!',
        },
        timestamp: Date.now(),
      };

      const result = await connector.sendMessage('1234567890', message);

      expect(result.success).toBe(true);
      expect(result.message_id).toBe('msg-123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      );
    });

    it('should send interactive button message', async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            messages: [{ id: 'msg-124' }],
          }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const message: UnifiedMessage = {
        id: '2',
        platform: Platform.WHATSAPP,
        content: {
          type: MessageType.TEXT,
          text: 'Choose an option',
          markup: {
            type: 'inline',
            inline_keyboard: [
              [
                { text: 'Option 1', callback_data: 'opt1' },
                { text: 'Option 2', callback_data: 'opt2' },
              ],
            ],
          },
        },
        timestamp: Date.now(),
      };

      const result = await connector.sendMessage('1234567890', message);

      expect(result.success).toBe(true);
      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs?.[1]?.body || '{}');
      expect(body.type).toBe('interactive');
      expect(body.interactive.type).toBe('button');
    });

    it('should send image message', async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            messages: [{ id: 'msg-125' }],
          }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const message: UnifiedMessage = {
        id: '3',
        platform: Platform.WHATSAPP,
        content: {
          type: MessageType.IMAGE,
          text: 'Check this out!',
        },
        attachments: [
          {
            type: AttachmentType.PHOTO,
            url: 'https://example.com/image.jpg',
            mime_type: 'image/jpeg',
          },
        ],
        timestamp: Date.now(),
      };

      const result = await connector.sendMessage('1234567890', message);

      expect(result.success).toBe(true);
      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs?.[1]?.body || '{}');
      expect(body.type).toBe('image');
      expect(body.image.link).toBe('https://example.com/image.jpg');
      expect(body.image.caption).toBe('Check this out!');
    });
  });

  describe('handleWebhook', () => {
    beforeEach(async () => {
      await connector.initialize(config);
    });

    it('should verify webhook', async () => {
      const request = new Request(
        'https://example.com/webhook?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=challenge123',
      );
      const response = await connector.handleWebhook(request);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('challenge123');
    });

    it('should reject invalid verification', async () => {
      const request = new Request(
        'https://example.com/webhook?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=challenge123',
      );
      const response = await connector.handleWebhook(request);

      expect(response.status).toBe(403);
    });

    it('should process incoming text message', async () => {
      const webhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry1',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: 'test-phone-id',
                  },
                  contacts: [
                    {
                      profile: { name: 'John Doe' },
                      wa_id: '9876543210',
                    },
                  ],
                  messages: [
                    {
                      from: '9876543210',
                      id: 'msg-in-1',
                      timestamp: '1234567890',
                      type: 'text',
                      text: { body: 'Hello bot!' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const request = new Request('https://example.com/webhook', {
        method: 'POST',
        body: JSON.stringify(webhookPayload),
      });

      let emittedEvent: { payload: { message: UnifiedMessage } } | undefined;
      config.eventBus.on('message:received', (event) => {
        emittedEvent = event as { payload: { message: UnifiedMessage } };
      });

      const response = await connector.handleWebhook(request);

      expect(response.status).toBe(200);
      expect(emittedEvent).toBeDefined();
      expect(emittedEvent?.payload.message.content.text).toBe('Hello bot!');
      expect(emittedEvent?.payload.message.sender?.first_name).toBe('John Doe');
    });
  });

  describe('WhatsApp-specific features', () => {
    beforeEach(async () => {
      await connector.initialize(config);
    });

    it('should send template message', async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            messages: [{ id: 'msg-template-1' }],
          }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await connector.sendTemplate('1234567890', 'order_confirmation', 'en', [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'John' },
            { type: 'text', text: '#12345' },
          ],
        },
      ]);

      expect(result.success).toBe(true);
      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs?.[1]?.body || '{}');
      expect(body.type).toBe('template');
      expect(body.template.name).toBe('order_confirmation');
    });

    it('should send catalog message', async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            messages: [{ id: 'msg-catalog-1' }],
          }),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await connector.sendCatalog(
        '1234567890',
        'Check out our products!',
        'catalog-123',
        ['prod-1', 'prod-2', 'prod-3'],
      );

      expect(result.success).toBe(true);
      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs?.[1]?.body || '{}');
      expect(body.type).toBe('interactive');
      expect(body.interactive.type).toBe('product_list');
      expect(body.interactive.action.sections[0].product_items).toHaveLength(3);
    });
  });

  describe('capabilities', () => {
    it('should return correct messaging capabilities', () => {
      const capabilities = connector.getMessagingCapabilities();

      expect(capabilities.supportsEditing).toBe(false);
      expect(capabilities.supportsDeleting).toBe(false);
      expect(capabilities.supportsReactions).toBe(true);
      expect(capabilities.maxAttachments).toBe(1);
      expect(capabilities.custom?.supportsInteractiveLists).toBe(true);
      expect(capabilities.custom?.supportsCatalog).toBe(true);
    });

    it('should return correct platform capabilities v2', () => {
      const capabilities = connector.getPlatformCapabilitiesV2();

      expect(capabilities.supportsCatalogs).toBe(true);
      expect(capabilities.supportsTemplates).toBe(true);
      expect(capabilities.maxButtonsPerMessage).toBe(3);
      expect(capabilities.customCapabilities?.supportsReadReceipts).toBe(true);
    });
  });
});
