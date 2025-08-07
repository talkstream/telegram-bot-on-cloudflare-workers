import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EventBus } from '../../../../core/events/event-bus.js'
import { ConnectorType } from '../../../../core/interfaces/connector.js'
import {
  MessageType,
  Platform,
  type UnifiedMessage
} from '../../../../core/interfaces/messaging.js'
import { DiscordConnector } from '../discord-connector.js'

describe('Discord Connector', () => {
  let connector: DiscordConnector
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = new EventBus()
    connector = new DiscordConnector()
  })

  describe('Initialization', () => {
    it('should initialize with valid config', async () => {
      const config = {
        applicationId: 'test-app-id',
        publicKey: 'test-public-key',
        botToken: 'test-bot-token',
        webhookUrl: 'https://example.com/webhook',
        eventBus
      }

      await connector.initialize(config)

      expect(connector.isReady()).toBe(true)
      expect(connector.id).toBe('discord-connector')
      expect(connector.type).toBe(ConnectorType.MESSAGING)
    })

    it('should fail initialization without required fields', async () => {
      const config = {
        eventBus
      }

      await expect(connector.initialize(config)).rejects.toThrow('Invalid configuration')
    })

    it('should validate config correctly', () => {
      const invalidConfig = {
        eventBus
      }

      const result = connector.validateConfig(invalidConfig)
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(2)
      expect(result.errors?.[0].field).toBe('applicationId')
      expect(result.errors?.[1].field).toBe('publicKey')
    })
  })

  describe('Messaging Capabilities', () => {
    it('should return correct capabilities', () => {
      const capabilities = connector.getMessagingCapabilities()

      expect(capabilities.maxMessageLength).toBe(2000)
      expect(capabilities.supportsEditing).toBe(true)
      expect(capabilities.supportsDeleting).toBe(true)
      expect(capabilities.supportsReactions).toBe(true)
      expect(capabilities.supportsThreads).toBe(true)
      expect(capabilities.custom?.supportsSlashCommands).toBe(true)
      expect(capabilities.custom?.supportsButtons).toBe(true)
    })
  })

  describe('Webhook Handling', () => {
    beforeEach(async () => {
      await connector.initialize({
        applicationId: 'test-app-id',
        publicKey: 'test-public-key',
        eventBus
      })
    })

    it('should handle ping interaction', async () => {
      const request = new Request('https://example.com/webhook', {
        method: 'POST',
        headers: {
          'X-Signature-Ed25519': 'test-signature',
          'X-Signature-Timestamp': '123456'
        },
        body: JSON.stringify({ type: 1 })
      })

      const response = await connector.handleWebhook(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({ type: 1 })
    })

    it('should reject invalid webhook signature', async () => {
      const validateSpy = vi.spyOn(connector, 'validateWebhook').mockResolvedValue(false)

      const request = new Request('https://example.com/webhook', {
        method: 'POST',
        body: JSON.stringify({ type: 2 })
      })

      const response = await connector.handleWebhook(request)

      expect(response.status).toBe(401)
      expect(response.statusText).toBe('Unauthorized')
      validateSpy.mockRestore()
    })

    it('should convert Discord interaction to unified message', async () => {
      const validateSpy = vi.spyOn(connector, 'validateWebhook').mockResolvedValue(true)
      let emittedMessage: UnifiedMessage | undefined

      eventBus.on('message.received', data => {
        emittedMessage = data.payload.message
      })

      const interaction = {
        id: '123',
        type: 3, // MESSAGE_COMPONENT type for content
        channel_id: 'channel-123',
        data: { content: 'Hello Discord!' },
        member: {
          user: {
            id: 'user-123',
            username: 'TestUser'
          }
        }
      }

      const request = new Request('https://example.com/webhook', {
        method: 'POST',
        headers: {
          'X-Signature-Ed25519': 'test-signature',
          'X-Signature-Timestamp': '123456'
        },
        body: JSON.stringify(interaction)
      })

      const response = await connector.handleWebhook(request)

      expect(response.status).toBe(200)
      expect(emittedMessage).toBeDefined()
      expect(emittedMessage.platform).toBe(Platform.DISCORD)
      expect(emittedMessage.sender.id).toBe('user-123')
      expect(emittedMessage.content.text).toBe('Hello Discord!')

      validateSpy.mockRestore()
    })
  })

  describe('Message Operations', () => {
    beforeEach(async () => {
      await connector.initialize({
        applicationId: 'test-app-id',
        publicKey: 'test-public-key',
        botToken: 'test-bot-token',
        eventBus
      })
    })

    it('should handle send message (mock)', async () => {
      // Since actual Discord API calls are not implemented,
      // we test the message conversion logic
      const message = {
        content: {
          text: 'Test message',
          type: MessageType.TEXT
        }
      }

      // This will throw 'Not implemented' in the current stub
      await expect(connector.sendMessage('channel-123', message)).resolves.toEqual({
        success: false,
        error: expect.any(Error)
      })
    })

    it('should handle bulk messages', async () => {
      const message = {
        content: {
          text: 'Bulk message',
          type: MessageType.TEXT
        }
      }

      const result = await connector.sendBulk(['channel-1', 'channel-2'], message)

      expect(result.total).toBe(2)
      expect(result.failed).toBe(2) // All fail due to not implemented
      expect(result.results).toHaveLength(2)
    })
  })

  describe('Health Check', () => {
    it('should report healthy status', async () => {
      await connector.initialize({
        applicationId: 'test-app-id',
        publicKey: 'test-public-key',
        botToken: 'test-bot-token',
        webhookUrl: 'https://example.com/webhook',
        eventBus
      })

      const health = await connector.getHealthStatus()

      expect(health.status).toBe('healthy')
      expect(health.details?.hasWebhook).toBe(true)
      expect(health.details?.hasBot).toBe(true)
    })
  })

  describe('Command Registration', () => {
    it('should validate bot token requirement', async () => {
      await connector.initialize({
        applicationId: 'test-app-id',
        publicKey: 'test-public-key',
        eventBus
      })

      const commands = [{ command: 'help', description: 'Show help' }]

      await expect(connector.setCommands(commands)).rejects.toThrow(
        'Bot token required to set commands'
      )
    })
  })

  describe('Webhook Management', () => {
    it('should set webhook URL', async () => {
      await connector.initialize({
        applicationId: 'test-app-id',
        publicKey: 'test-public-key',
        eventBus
      })

      let webhookEvent: { connector: string; url: string } | undefined
      eventBus.on('webhook.set', data => {
        webhookEvent = data.payload
      })

      await connector.setWebhook('https://new-webhook.com/discord')

      expect(webhookEvent).toBeDefined()
      expect(webhookEvent.connector).toBe('discord-connector')
      expect(webhookEvent.url).toBe('https://new-webhook.com/discord')
    })
  })
})
