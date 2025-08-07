import { CommonEventType } from '../../core/events/event-bus.js'
import type { ConnectorCapabilities } from '../../core/interfaces/connector.js'
import { ConnectorType } from '../../core/interfaces/connector.js'
import type {
  BotCommand,
  BulkMessageResult,
  MessageResult,
  MessagingCapabilities,
  MessagingConnector,
  UnifiedMessage,
  WebhookOptions
} from '../../core/interfaces/messaging.js'
import { AttachmentType, Platform } from '../../core/interfaces/messaging.js'

import { BaseConnector } from './base-connector.js'

/**
 * Base implementation for messaging connectors
 */
export abstract class BaseMessagingConnector extends BaseConnector implements MessagingConnector {
  type = ConnectorType.MESSAGING

  protected abstract platform: Platform
  protected messageQueue: UnifiedMessage[] = []
  protected maxQueueSize = 100

  /**
   * Send a message
   */
  async sendMessage(recipient: string, message: UnifiedMessage): Promise<MessageResult> {
    try {
      // Add platform info
      message.platform = this.platform

      // Validate message
      const validation = this.validateMessage(message)
      if (!validation.valid) {
        throw new Error(`Invalid message: ${validation.error}`)
      }

      // Send via platform-specific implementation
      const result = await this.doSendMessage(recipient, message)

      // Emit event
      this.emitEvent(CommonEventType.MESSAGE_SENT, {
        recipient,
        message,
        result
      })

      return result
    } catch (error) {
      const errorResult: MessageResult = {
        success: false,
        error: error instanceof Error ? error : new Error('Send failed')
      }

      this.emitEvent(CommonEventType.CONNECTOR_ERROR, {
        connector: this.id,
        operation: 'sendMessage',
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      return errorResult
    }
  }

  /**
   * Send bulk messages
   */
  async sendBulk(recipients: string[], message: UnifiedMessage): Promise<BulkMessageResult> {
    const results: MessageResult[] = []
    let successful = 0
    let failed = 0

    // Add platform info
    message.platform = this.platform

    // Process in batches
    const batchSize = this.getBatchSize()
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(recipient => this.sendMessage(recipient, message))
      )

      results.push(...batchResults)
      successful += batchResults.filter(r => r.success).length
      failed += batchResults.filter(r => !r.success).length
    }

    return {
      total: recipients.length,
      successful,
      failed,
      results
    }
  }

  /**
   * Edit a message
   */
  async editMessage(messageId: string, message: UnifiedMessage): Promise<MessageResult> {
    const capabilities = this.getMessagingCapabilities()
    if (!capabilities.supportsEditing) {
      return {
        success: false,
        error: new Error('Message editing not supported')
      }
    }

    try {
      const result = await this.doEditMessage(messageId, message)

      this.emitEvent(CommonEventType.MESSAGE_EDITED, {
        messageId,
        message,
        result
      })

      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Edit failed')
      }
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    const capabilities = this.getMessagingCapabilities()
    if (!capabilities.supportsDeleting) {
      throw new Error('Message deletion not supported')
    }

    await this.doDeleteMessage(messageId)

    this.emitEvent(CommonEventType.MESSAGE_DELETED, {
      messageId
    })
  }

  /**
   * Get base capabilities
   */
  getCapabilities(): ConnectorCapabilities {
    const messagingCaps = this.getMessagingCapabilities()
    return {
      features: [
        'messaging',
        ...(messagingCaps.supportsEditing ? ['edit_message'] : []),
        ...(messagingCaps.supportsDeleting ? ['delete_message'] : []),
        ...(messagingCaps.supportsReactions ? ['reactions'] : []),
        ...(messagingCaps.supportsThreads ? ['threads'] : []),
        ...(messagingCaps.supportsVoice ? ['voice'] : []),
        ...(messagingCaps.supportsVideo ? ['video'] : [])
      ],
      maxFileSize: messagingCaps.maxAttachments * 50 * 1024 * 1024, // 50MB per file assumption
      supportedFileTypes: this.getSupportedFileTypes(messagingCaps)
    }
  }

  /**
   * Validate message
   */
  protected validateMessage(message: UnifiedMessage): { valid: boolean; error?: string } {
    const capabilities = this.getMessagingCapabilities()

    // Check message length
    if (message.content.text && message.content.text.length > capabilities.maxMessageLength) {
      return { valid: false, error: 'Message too long' }
    }

    // Check attachments
    if (message.attachments && message.attachments.length > capabilities.maxAttachments) {
      return { valid: false, error: 'Too many attachments' }
    }

    // Check message type
    if (
      message.content.type &&
      !capabilities.supportedMessageTypes.includes(message.content.type)
    ) {
      return { valid: false, error: `Message type ${message.content.type} not supported` }
    }

    return { valid: true }
  }

  /**
   * Get batch size for bulk operations
   */
  protected getBatchSize(): number {
    return this.getConfig<number>('batchSize', 10) ?? 10
  }

  /**
   * Get supported file types from capabilities
   */
  protected getSupportedFileTypes(caps: MessagingCapabilities): string[] {
    const types: string[] = []

    if (caps.supportedAttachmentTypes.includes(AttachmentType.PHOTO)) {
      types.push('image/jpeg', 'image/png', 'image/gif', 'image/webp')
    }
    if (caps.supportedAttachmentTypes.includes(AttachmentType.VIDEO)) {
      types.push('video/mp4', 'video/mpeg')
    }
    if (caps.supportedAttachmentTypes.includes(AttachmentType.AUDIO)) {
      types.push('audio/mpeg', 'audio/ogg', 'audio/wav')
    }
    if (caps.supportedAttachmentTypes.includes(AttachmentType.DOCUMENT)) {
      types.push('application/pdf', 'application/zip', 'text/plain')
    }

    return types
  }

  /**
   * Abstract methods for platform-specific implementations
   */
  protected abstract doSendMessage(
    recipient: string,
    message: UnifiedMessage
  ): Promise<MessageResult>
  protected abstract doEditMessage(
    messageId: string,
    message: UnifiedMessage
  ): Promise<MessageResult>
  protected abstract doDeleteMessage(messageId: string): Promise<void>
  abstract handleWebhook(request: Request): Promise<Response>
  abstract validateWebhook(request: Request): Promise<boolean>
  abstract setCommands(commands: BotCommand[]): Promise<void>
  abstract setWebhook(url: string, options?: WebhookOptions): Promise<void>
  abstract getMessagingCapabilities(): MessagingCapabilities
}
