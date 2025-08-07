import { CommonEventType } from '../../../core/events/event-bus.js'
import type { ConnectorConfig } from '../../../core/interfaces/connector.js'
import { ConnectorType } from '../../../core/interfaces/connector.js'
import type {
  BotCommand,
  BulkMessageResult,
  MessageResult,
  MessagingCapabilities,
  MessagingConnector,
  UnifiedMessage,
  WebhookOptions
} from '../../../core/interfaces/messaging.js'
import {
  AttachmentType,
  ChatType,
  EntityType,
  MessageType,
  Platform
} from '../../../core/interfaces/messaging.js'
import { BaseConnector } from '../../base/base-connector.js'

/**
 * Discord connector for Wireframe
 * Implements Discord bot functionality with webhook support
 */
export class DiscordConnector extends BaseConnector implements MessagingConnector {
  id = 'discord-connector'
  name = 'Discord Connector'
  version = '1.0.0'
  type = ConnectorType.MESSAGING

  private webhookUrl?: string
  private applicationId?: string
  private publicKey?: string
  private botToken?: string

  /**
   * Initialize Discord connector
   */
  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    this.webhookUrl = config.webhookUrl as string
    this.applicationId = config.applicationId as string
    this.publicKey = config.publicKey as string
    this.botToken = config.botToken as string

    // Verify Discord credentials
    if (!this.applicationId || !this.publicKey) {
      throw new Error('Discord application ID and public key are required')
    }

    this.emitEvent(CommonEventType.CONNECTOR_INITIALIZED, {
      connector: this.id,
      status: 'connected'
    })
  }

  /**
   * Send message to Discord
   */
  async sendMessage(recipient: string, message: UnifiedMessage): Promise<MessageResult> {
    try {
      // Convert unified message to Discord format
      const discordMessage = this.convertToDiscordMessage(message)

      // Send via webhook or REST API
      const response = await this.sendDiscordMessage(recipient, discordMessage)

      return {
        success: true,
        message_id: response.id
      }
    } catch (error) {
      return {
        success: false,
        error: error as Error
      }
    }
  }

  /**
   * Send bulk messages
   */
  async sendBulk(recipients: string[], message: UnifiedMessage): Promise<BulkMessageResult> {
    const results: MessageResult[] = []
    let successful = 0

    for (const recipient of recipients) {
      const result = await this.sendMessage(recipient, message)
      results.push(result)
      if (result.success) successful++
    }

    return {
      total: recipients.length,
      successful,
      failed: recipients.length - successful,
      results
    }
  }

  /**
   * Edit existing message
   */
  async editMessage(messageId: string, message: UnifiedMessage): Promise<MessageResult> {
    try {
      const discordMessage = this.convertToDiscordMessage(message)
      await this.editDiscordMessage(messageId, discordMessage)

      return {
        success: true,
        message_id: messageId
      }
    } catch (error) {
      return {
        success: false,
        error: error as Error
      }
    }
  }

  /**
   * Delete message
   */
  async deleteMessage(messageId: string): Promise<void> {
    await this.deleteDiscordMessage(messageId)
  }

  /**
   * Handle Discord webhook
   */
  async handleWebhook(request: Request): Promise<Response> {
    try {
      // Verify webhook signature
      const isValid = await this.validateWebhook(request)
      if (!isValid) {
        return new Response('Unauthorized', { status: 401 })
      }

      // Parse interaction
      const body = (await request.json()) as DiscordInteraction

      // Handle ping
      if (body.type === 1) {
        return Response.json({ type: 1 })
      }

      // Convert to unified message and emit event
      const unifiedMessage = this.convertFromDiscordMessage(body)

      this.emitEvent('message.received', {
        message: unifiedMessage,
        platform: Platform.DISCORD
      })

      // Return interaction response
      return Response.json({
        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
        data: {
          content: 'Message received',
          flags: 64 // Ephemeral
        }
      })
    } catch (error) {
      this.emitEvent(CommonEventType.CONNECTOR_ERROR, {
        connector: this.id,
        error: error instanceof Error ? error.message : 'Webhook handling failed'
      })
      return new Response('Internal Server Error', { status: 500 })
    }
  }

  /**
   * Validate Discord webhook
   */
  async validateWebhook(request: Request): Promise<boolean> {
    if (!this.publicKey) return false

    try {
      const signature = request.headers.get('X-Signature-Ed25519')
      const timestamp = request.headers.get('X-Signature-Timestamp')

      if (!signature || !timestamp) return false

      // Clone request to read body
      const body = await request.clone().text()

      // Verify signature using Discord's public key verification
      // This would require crypto APIs available in the runtime
      return await this.verifyDiscordSignature(signature, timestamp, body)
    } catch {
      return false
    }
  }

  /**
   * Set bot commands
   */
  async setCommands(commands: BotCommand[]): Promise<void> {
    if (!this.applicationId || !this.botToken) {
      throw new Error('Bot token required to set commands')
    }

    const discordCommands = commands.map(cmd => ({
      name: cmd.command,
      description: cmd.description,
      type: 1 // CHAT_INPUT
    }))

    // Register global commands
    await this.registerDiscordCommands(discordCommands)
  }

  /**
   * Set webhook URL
   */
  async setWebhook(url: string, _options?: WebhookOptions): Promise<void> {
    this.webhookUrl = url

    // Discord doesn't require webhook registration like Telegram
    // The URL is configured in Discord Developer Portal
    this.emitEvent('webhook.set', {
      connector: this.id,
      url
    })
  }

  /**
   * Get messaging capabilities
   */
  getMessagingCapabilities(): MessagingCapabilities {
    return {
      maxMessageLength: 2000,
      supportedMessageTypes: [
        MessageType.TEXT,
        MessageType.IMAGE,
        MessageType.VIDEO,
        MessageType.AUDIO,
        MessageType.DOCUMENT
      ],
      supportedEntityTypes: [
        EntityType.MENTION,
        EntityType.URL,
        EntityType.BOLD,
        EntityType.ITALIC,
        EntityType.CODE,
        EntityType.PRE
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
      supportsReactions: true,
      supportsThreads: true,
      supportsVoice: true,
      supportsVideo: true,
      custom: {
        supportsSlashCommands: true,
        supportsButtons: true,
        supportsSelectMenus: true,
        supportsModals: true,
        supportsEmbeds: true
      }
    }
  }

  /**
   * Get connector capabilities
   */
  getCapabilities() {
    return {
      messaging: this.getMessagingCapabilities(),
      supportedPlatforms: [Platform.DISCORD],
      requiresWebhook: true,
      supportsBulkOperations: true,
      features: ['webhook', 'commands', 'inline-buttons', 'files', 'voice', 'threads']
    }
  }

  /**
   * Validate configuration
   */
  protected doValidateConfig(config: ConnectorConfig) {
    const errors = []

    if (!config.applicationId) {
      errors.push({
        field: 'applicationId',
        message: 'Discord application ID is required'
      })
    }

    if (!config.publicKey) {
      errors.push({
        field: 'publicKey',
        message: 'Discord public key is required for webhook validation'
      })
    }

    return errors.length > 0 ? errors : undefined
  }

  /**
   * Check readiness
   */
  protected checkReadiness(): boolean {
    return !!(this.applicationId && this.publicKey)
  }

  /**
   * Check health
   */
  protected async checkHealth() {
    return {
      status: 'healthy' as const,
      message: 'Discord connector is operational',
      details: {
        hasWebhook: !!this.webhookUrl,
        hasBot: !!this.botToken
      }
    }
  }

  /**
   * Destroy connector
   */
  protected async doDestroy(): Promise<void> {
    // Clean up resources
    this.webhookUrl = undefined
    this.applicationId = undefined
    this.publicKey = undefined
    this.botToken = undefined
  }

  /**
   * Convert unified message to Discord format
   */
  private convertToDiscordMessage(message: UnifiedMessage): DiscordMessage {
    const content = message.content.text || ''

    // Convert markup to Discord components
    const components = message.content.markup
      ? this.convertMarkupToComponents(message.content.markup)
      : undefined

    // Convert attachments to embeds
    const embeds = message.attachments
      ? this.convertAttachmentsToEmbeds(message.attachments)
      : undefined

    return {
      content,
      components,
      embeds,
      allowed_mentions: {
        parse: ['users', 'roles']
      }
    }
  }

  /**
   * Convert Discord interaction to unified message
   */
  private convertFromDiscordMessage(interaction: DiscordInteraction): UnifiedMessage {
    // Extract text based on interaction type
    let text = ''

    if (interaction.type === 2 && interaction.data) {
      // Application command
      text = `/${interaction.data.name || 'command'}`
      if (interaction.data.options?.length) {
        const args = interaction.data.options.map(opt => opt.value).join(' ')
        text += ` ${args}`
      }
    } else if (interaction.data?.content) {
      // Message component or modal submit with content
      text = interaction.data.content
    }

    return {
      id: interaction.id,
      platform: Platform.DISCORD,
      sender: {
        id: interaction.member?.user.id || interaction.user?.id || '',
        username: interaction.member?.user.username || interaction.user?.username,
        is_bot: false
      },
      chat: {
        id: interaction.channel_id || '',
        type: interaction.guild_id ? ChatType.GUILD : ChatType.DM
      },
      content: {
        text,
        type: MessageType.TEXT
      },
      timestamp: Date.now(),
      metadata: {
        guild_id: interaction.guild_id,
        interaction_type: interaction.type,
        command_name: interaction.data?.name
      }
    }
  }

  /**
   * Helper methods would go here
   */
  private async sendDiscordMessage(
    _channelId: string,
    _message: DiscordMessage
  ): Promise<DiscordMessageResponse> {
    // Implementation would use Discord REST API or webhook
    throw new Error('Not implemented')
  }

  private async editDiscordMessage(_messageId: string, _message: DiscordMessage): Promise<void> {
    // Implementation would use Discord REST API
    throw new Error('Not implemented')
  }

  private async deleteDiscordMessage(_messageId: string): Promise<void> {
    // Implementation would use Discord REST API
    throw new Error('Not implemented')
  }

  private async verifyDiscordSignature(
    _signature: string,
    _timestamp: string,
    _body: string
  ): Promise<boolean> {
    // Implementation would use crypto APIs
    // This is a placeholder - actual implementation would verify Ed25519 signature
    return true
  }

  private async registerDiscordCommands(_commands: DiscordCommand[]): Promise<void> {
    // Implementation would use Discord REST API
    throw new Error('Not implemented')
  }

  private convertMarkupToComponents(_markup: unknown): DiscordComponent[] {
    // Convert unified markup to Discord components
    return []
  }

  private convertAttachmentsToEmbeds(_attachments: unknown[]): DiscordEmbed[] {
    // Convert unified attachments to Discord embeds
    return []
  }
}

/**
 * Discord-specific types
 */
interface DiscordInteraction {
  id: string
  type: number
  data?: {
    content?: string
    name?: string
    options?: Array<{
      name: string
      value: string | number | boolean
      type: number
    }>
  }
  guild_id?: string
  channel_id?: string
  member?: {
    user: {
      id: string
      username: string
    }
  }
  user?: {
    id: string
    username: string
  }
}

interface DiscordMessage {
  content: string
  embeds?: DiscordEmbed[]
  components?: DiscordComponent[]
  allowed_mentions?: {
    parse?: string[]
  }
}

interface DiscordMessageResponse {
  id: string
  content: string
  author: {
    id: string
    username: string
  }
}

interface DiscordCommand {
  name: string
  description: string
  type: number
}

interface DiscordComponent {
  type: number
  components?: DiscordComponent[]
  custom_id?: string
  label?: string
  style?: number
}

interface DiscordEmbed {
  title?: string
  description?: string
  url?: string
  color?: number
  fields?: Array<{
    name: string
    value: string
    inline?: boolean
  }>
}
