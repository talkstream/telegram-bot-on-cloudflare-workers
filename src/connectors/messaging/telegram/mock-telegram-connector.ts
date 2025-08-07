/**
 * Mock Telegram Connector for deployment without real secrets
 *
 * This connector simulates Telegram bot behavior for testing and demo purposes.
 * It allows the framework to run without a real Telegram bot token.
 */

import type {
  ConnectorCapabilities,
  ConnectorConfig,
  HealthStatus,
  ValidationResult
} from '../../../core/interfaces/connector'
import { ConnectorType } from '../../../core/interfaces/connector'
import type {
  BotCommand,
  BulkMessageResult,
  MessageResult,
  MessagingCapabilities,
  MessagingConnector,
  UnifiedMessage,
  WebhookOptions
} from '../../../core/interfaces/messaging'
import {
  AttachmentType,
  ChatType,
  EntityType,
  MessageType,
  Platform
} from '../../../core/interfaces/messaging'

export class MockTelegramConnector implements MessagingConnector {
  id = 'messaging-telegram-mock'
  name = 'Mock Telegram Connector'
  version = '1.0.0'
  type = ConnectorType.MESSAGING
  private _isReady = true
  platform = Platform.TELEGRAM

  private mockMessages: UnifiedMessage[] = []

  constructor(_config?: ConnectorConfig) {
    console.info('[MockTelegramConnector] Initialized in DEMO mode - no real Telegram connection')
  }

  async initialize(config: ConnectorConfig): Promise<void> {
    console.info('[MockTelegramConnector] Mock initialization complete', config)
  }

  async connect(): Promise<void> {
    console.info('[MockTelegramConnector] Connected (mock)')
  }

  async disconnect(): Promise<void> {
    console.info('[MockTelegramConnector] Disconnected (mock)')
  }

  async healthCheck(): Promise<boolean> {
    return true
  }

  isReady(): boolean {
    return this._isReady
  }

  validateConfig(_config: ConnectorConfig): ValidationResult {
    return { valid: true }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      message: 'Mock Telegram connector is running',
      details: { mode: 'mock', platform: 'telegram' },
      timestamp: Date.now()
    }
  }

  async destroy(): Promise<void> {
    console.info('[MockTelegramConnector] Destroyed')
  }

  getCapabilities(): ConnectorCapabilities {
    const msgCaps = this.getMessagingCapabilities()
    return {
      features: [
        'messaging',
        'bulkSend',
        msgCaps.supportsEditing ? 'editing' : '',
        msgCaps.supportsDeleting ? 'deletion' : '',
        msgCaps.supportsReactions ? 'reactions' : '',
        msgCaps.supportsThreads ? 'threads' : '',
        msgCaps.supportsVoice ? 'voice' : '',
        msgCaps.supportsVideo ? 'video' : ''
      ].filter(Boolean) as string[],
      limits: {
        maxMessageLength: msgCaps.maxMessageLength,
        maxAttachments: msgCaps.maxAttachments
      },
      metadata: {
        supportedMessageTypes: msgCaps.supportedMessageTypes,
        supportedEntityTypes: msgCaps.supportedEntityTypes,
        supportedAttachmentTypes: msgCaps.supportedAttachmentTypes
      }
    }
  }

  async handleWebhook(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // Handle health check
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          mode: 'demo',
          connector: 'MockTelegramConnector',
          timestamp: new Date().toISOString(),
          message: 'Wireframe v1.2 running in demo mode'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Simulate webhook response
    if (url.pathname.includes('/webhook')) {
      console.info('[MockTelegramConnector] Webhook request received (demo mode)')

      // Create a mock message
      const mockMessage: UnifiedMessage = {
        id: `mock-${Date.now()}`,
        platform: Platform.TELEGRAM,
        sender: {
          id: '123456789',
          username: 'demo_user',
          first_name: 'Demo',
          last_name: 'User',
          is_bot: false
        },
        chat: {
          id: '123456789',
          type: ChatType.PRIVATE
        },
        content: {
          text: '/start',
          type: MessageType.TEXT
        },
        timestamp: Date.now()
      }

      this.mockMessages.push(mockMessage)

      return new Response('OK', { status: 200 })
    }

    return new Response('Not Found', { status: 404 })
  }

  async validateWebhook(_request: Request): Promise<boolean> {
    // Mock validation - always return true in demo mode
    console.info('[MockTelegramConnector] Validating webhook (mock)')
    return true
  }

  async sendMessage(recipient: string, message: UnifiedMessage): Promise<MessageResult> {
    console.info(`[MockTelegramConnector] Send message to ${recipient}:`, message.content.text)
    const messageId = `mock-sent-${Date.now()}`
    this.mockMessages.push({ ...message, id: messageId })
    return {
      success: true,
      message_id: messageId
    }
  }

  async sendBulk(recipients: string[], message: UnifiedMessage): Promise<BulkMessageResult> {
    console.info(`[MockTelegramConnector] Send bulk message to ${recipients.length} recipients`)
    const results: MessageResult[] = []

    for (const recipient of recipients) {
      const result = await this.sendMessage(recipient, message)
      results.push(result)
    }

    return {
      total: recipients.length,
      successful: recipients.length,
      failed: 0,
      results
    }
  }

  async editMessage(messageId: string, message: UnifiedMessage): Promise<MessageResult> {
    console.info(`[MockTelegramConnector] Edit message ${messageId}:`, message.content.text)
    const existingIndex = this.mockMessages.findIndex(m => m.id === messageId)
    if (existingIndex >= 0) {
      this.mockMessages[existingIndex] = { ...message, id: messageId }
    }
    return {
      success: true,
      message_id: messageId
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    console.info(`[MockTelegramConnector] Delete message ${messageId}`)
    this.mockMessages = this.mockMessages.filter(m => m.id !== messageId)
  }

  async setCommands(commands: BotCommand[]): Promise<void> {
    console.info(`[MockTelegramConnector] Set ${commands.length} commands (demo mode)`)
  }

  async setWebhook(url: string, options?: WebhookOptions): Promise<void> {
    console.info(`[MockTelegramConnector] Set webhook to: ${url} (demo mode)`, options)
  }

  getMessagingCapabilities(): MessagingCapabilities {
    return {
      maxMessageLength: 4096,
      supportedMessageTypes: [
        MessageType.TEXT,
        MessageType.IMAGE,
        MessageType.VIDEO,
        MessageType.AUDIO,
        MessageType.DOCUMENT,
        MessageType.STICKER
      ],
      supportedEntityTypes: [
        EntityType.MENTION,
        EntityType.HASHTAG,
        EntityType.URL,
        EntityType.BOLD,
        EntityType.ITALIC,
        EntityType.CODE
      ],
      supportedAttachmentTypes: [
        AttachmentType.PHOTO,
        AttachmentType.VIDEO,
        AttachmentType.AUDIO,
        AttachmentType.DOCUMENT
      ],
      maxAttachments: 10,
      supportsEditing: true,
      supportsDeleting: true,
      supportsReactions: false,
      supportsThreads: false,
      supportsVoice: true,
      supportsVideo: true
    }
  }
}
