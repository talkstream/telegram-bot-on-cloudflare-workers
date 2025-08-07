/**
 * Telegram connector implementation
 */

import { Bot, webhookCallback } from 'grammy'

import { setUserContext } from '../../../config/sentry.js'
import { CommonEventType } from '../../../core/events/event-bus.js'
import type {
  BotCommand,
  ConnectorConfig,
  HealthStatus,
  MessageResult,
  MessagingCapabilities,
  UnifiedMessage,
  ValidationResult,
  WebhookOptions
} from '../../../core/interfaces/index.js'
import {
  AttachmentType,
  EntityType,
  MessageType,
  Platform
} from '../../../core/interfaces/messaging.js'
import { BaseMessagingConnector } from '../../base/base-messaging-connector.js'

import { unifiedMarkupToTelegram } from './converters/markup-converter.js'
import {
  telegramUpdateToUnifiedMessage,
  telegramUserToUnified
} from './converters/message-converter.js'
import {
  TelegramCallbackHandler,
  TelegramCommandHandler,
  createDefaultCallbackHandlers,
  createDefaultCommands
} from './handlers/index.js'
import type { TelegramConfig, TelegramContext } from './types.js'

/**
 * Telegram connector for the Wireframe platform
 */
export class TelegramConnector extends BaseMessagingConnector {
  id = 'telegram'
  name = 'Telegram Messenger'
  version = '1.0.0'
  protected platform = Platform.TELEGRAM

  private bot?: Bot<TelegramContext>
  declare protected config?: TelegramConfig
  private webhookHandler?: ReturnType<typeof webhookCallback>
  private commandHandler?: TelegramCommandHandler
  private callbackHandler?: TelegramCallbackHandler

  // Duplicate message protection
  private processedUpdates = new Map<number, number>() // update_id -> timestamp
  private readonly UPDATE_MAX_AGE = 10 * 60 * 1000 // 10 minutes

  // Request batching
  private messageBatchQueue: Array<{
    recipient: string
    message: UnifiedMessage
    resolve: (value: MessageResult) => void
    reject: (reason?: unknown) => void
  }> = []
  private batchTimer?: NodeJS.Timeout
  private readonly DEFAULT_BATCH_SIZE = 30 // Telegram API limit
  private readonly DEFAULT_BATCH_DELAY = 50 // ms to wait before processing batch

  /**
   * Initialize the connector
   */
  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const telegramConfig = config as unknown as TelegramConfig
    if (!telegramConfig || typeof telegramConfig !== 'object') {
      throw new Error('Invalid configuration')
    }
    this.config = telegramConfig

    if (!this.config.token) {
      throw new Error('Telegram bot token is required')
    }

    // Create bot instance
    this.bot = new Bot<TelegramContext>(this.config.token, {
      client: {
        apiRoot: this.config.apiUrl
      }
    })

    // Set up webhook handler
    // @ts-expect-error - Type mismatch between Grammy's handler and our expected type
    this.webhookHandler = webhookCallback(this.bot, 'cloudflare-mod')

    // Set up handlers
    this.setupHandlers()
    this.setupUpdateHandlers()

    // Set bot commands if not in webhook mode
    try {
      await this.setDefaultCommands()
    } catch (error) {
      // Commands can be set later
      console.warn('Failed to set default commands:', error)
    }
  }

  /**
   * Validate configuration
   */
  protected doValidateConfig(config: ConnectorConfig): ValidationResult['errors'] {
    const errors: ValidationResult['errors'] = []
    const telegramConfig = config as unknown as TelegramConfig

    if (!telegramConfig.token) {
      errors?.push({
        field: 'token',
        message: 'Telegram bot token is required'
      })
    }

    if (
      telegramConfig.parseMode &&
      !['HTML', 'Markdown', 'MarkdownV2'].includes(telegramConfig.parseMode)
    ) {
      errors?.push({
        field: 'parseMode',
        message: 'Invalid parse mode'
      })
    }

    return errors
  }

  /**
   * Check if connector is ready
   */
  protected checkReadiness(): boolean {
    return !!this.bot && !!this.config?.token
  }

  /**
   * Check connector health
   */
  protected async checkHealth(): Promise<Partial<HealthStatus>> {
    if (!this.bot) {
      return {
        status: 'unhealthy',
        message: 'Bot not initialized'
      }
    }

    try {
      const me = await this.bot.api.getMe()
      return {
        status: 'healthy',
        message: `Bot @${me.username} is running`,
        details: {
          botId: me.id,
          username: me.username,
          firstName: me.first_name
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Health check failed'
      }
    }
  }

  /**
   * Destroy the connector
   */
  protected async doDestroy(): Promise<void> {
    // Process any remaining messages in the queue
    if (this.messageBatchQueue.length > 0) {
      await this.processBatch()
    }

    // Clear batch timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = undefined
    }

    if (this.bot) {
      await this.bot.stop()
      this.bot = undefined
    }
  }

  /**
   * Send a message
   */
  protected async doSendMessage(
    recipient: string,
    message: UnifiedMessage
  ): Promise<MessageResult> {
    if (!this.bot) {
      throw new Error('Bot not initialized')
    }

    // Add to batch queue if batching is enabled
    if (this.config?.batch?.enabled) {
      return this.addToBatch(recipient, message)
    }

    // Direct send if batching is disabled
    return this.sendMessageDirect(recipient, message)
  }

  /**
   * Send message directly without batching
   */
  private async sendMessageDirect(
    recipient: string,
    message: UnifiedMessage
  ): Promise<MessageResult> {
    if (!this.bot) {
      throw new Error('Bot not initialized')
    }

    try {
      interface SendMessageOptions {
        parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'
        disable_web_page_preview?: boolean
        reply_markup?: unknown
      }

      const options: SendMessageOptions = {}

      // Set parse mode
      if (this.config?.parseMode) {
        options.parse_mode = this.config.parseMode
      }

      // Disable link preview if configured
      if (this.config?.linkPreview === false) {
        options.disable_web_page_preview = true
      }

      // Convert markup
      if (message.content.markup) {
        options.reply_markup = unifiedMarkupToTelegram(message.content.markup)
      }

      // Send message based on type
      let result
      if (message.content.type === 'text' && message.content.text) {
        result = await this.bot.api.sendMessage(
          recipient,
          message.content.text,
          options as Parameters<typeof this.bot.api.sendMessage>[2]
        )
      } else {
        // Handle other message types
        throw new Error(`Message type ${message.content.type} not implemented yet`)
      }

      return {
        success: true,
        message_id: result.message_id.toString()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to send message')
      }
    }
  }

  /**
   * Add message to batch queue
   */
  private addToBatch(recipient: string, message: UnifiedMessage): Promise<MessageResult> {
    return new Promise((resolve, reject) => {
      this.messageBatchQueue.push({ recipient, message, resolve, reject })

      // Process batch if size limit reached
      const batchSize = this.config?.batch?.maxSize || this.DEFAULT_BATCH_SIZE
      if (this.messageBatchQueue.length >= batchSize) {
        this.processBatch()
      } else {
        // Schedule batch processing
        this.scheduleBatch()
      }
    })
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatch(): void {
    if (this.batchTimer) return

    const batchDelay = this.config?.batch?.delay || this.DEFAULT_BATCH_DELAY
    this.batchTimer = setTimeout(() => {
      this.processBatch()
    }, batchDelay)
  }

  /**
   * Process message batch
   */
  private async processBatch(): Promise<void> {
    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = undefined
    }

    // Get messages to process
    const batchSize = this.config?.batch?.maxSize || this.DEFAULT_BATCH_SIZE
    const batch = this.messageBatchQueue.splice(0, batchSize)
    if (batch.length === 0) return

    // Process messages in parallel
    const promises = batch.map(async ({ recipient, message, resolve, reject }) => {
      try {
        const result = await this.sendMessageDirect(recipient, message)
        resolve(result)
      } catch (error) {
        reject(error)
      }
    })

    await Promise.allSettled(promises)

    // Process remaining messages if any
    if (this.messageBatchQueue.length > 0) {
      this.scheduleBatch()
    }
  }

  /**
   * Edit a message
   */
  protected async doEditMessage(
    messageId: string,
    message: UnifiedMessage
  ): Promise<MessageResult> {
    if (!this.bot) {
      throw new Error('Bot not initialized')
    }

    try {
      if (!message.chat?.id || !message.content.text) {
        throw new Error('Chat ID and message text are required for editing')
      }

      interface EditMessageOptions {
        parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'
        reply_markup?: unknown
      }

      const options: EditMessageOptions = {}

      // Set parse mode
      if (this.config?.parseMode) {
        options.parse_mode = this.config.parseMode
      }

      // Convert markup
      if (message.content.markup) {
        options.reply_markup = unifiedMarkupToTelegram(message.content.markup)
      }

      await this.bot.api.editMessageText(
        message.chat.id,
        parseInt(messageId),
        message.content.text,
        options as Parameters<typeof this.bot.api.editMessageText>[3]
      )

      return {
        success: true,
        message_id: messageId
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to edit message')
      }
    }
  }

  /**
   * Delete a message
   */
  protected async doDeleteMessage(_messageId: string): Promise<void> {
    if (!this.bot) {
      throw new Error('Bot not initialized')
    }

    // Note: Telegram requires chat_id to delete messages
    // This would need to be stored or passed differently
    throw new Error('Delete message not implemented - requires chat_id')
  }

  /**
   * Handle webhook request
   */
  async handleWebhook(request: Request): Promise<Response> {
    if (!this.webhookHandler) {
      return new Response('Webhook handler not initialized', { status: 500 })
    }

    try {
      return await this.webhookHandler(request)
    } catch (error) {
      this.emitEvent(CommonEventType.CONNECTOR_ERROR, {
        connector: this.id,
        operation: 'handleWebhook',
        error: error instanceof Error ? error.message : 'Webhook handling failed'
      })
      return new Response('Internal server error', { status: 500 })
    }
  }

  /**
   * Validate webhook request
   */
  async validateWebhook(request: Request): Promise<boolean> {
    if (!this.config?.webhookSecret) {
      return true // No validation if secret not configured
    }

    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
    return secret === this.config.webhookSecret
  }

  /**
   * Set bot commands
   */
  async setCommands(commands: BotCommand[]): Promise<void> {
    if (!this.bot) {
      throw new Error('Bot not initialized')
    }

    const telegramCommands = commands.map(cmd => ({
      command: cmd.command,
      description: cmd.description
    }))

    await this.bot.api.setMyCommands(telegramCommands)
  }

  /**
   * Set webhook URL
   */
  async setWebhook(url: string, options?: WebhookOptions): Promise<void> {
    if (!this.bot) {
      throw new Error('Bot not initialized')
    }

    interface WebhookConfigOptions {
      url: string
      secret_token?: string
      max_connections?: number
      allowed_updates?: Array<
        | 'message'
        | 'poll'
        | 'edited_message'
        | 'channel_post'
        | 'edited_channel_post'
        | 'business_message'
        | 'edited_business_message'
        | 'business_connection'
        | 'deleted_business_messages'
        | 'message_reaction'
        | 'message_reaction_count'
        | 'inline_query'
        | 'chosen_inline_result'
        | 'callback_query'
        | 'shipping_query'
        | 'pre_checkout_query'
        | 'poll_answer'
        | 'my_chat_member'
        | 'chat_member'
        | 'chat_join_request'
        | 'chat_boost'
        | 'removed_chat_boost'
        | 'purchased_paid_media'
      >
      drop_pending_updates?: boolean
    }

    const webhookOptions: WebhookConfigOptions = {
      url
    }

    if (options?.secret_token) {
      webhookOptions.secret_token = options.secret_token
    }
    if (options?.max_connections) {
      webhookOptions.max_connections = options.max_connections
    }
    if (options?.allowed_updates) {
      webhookOptions.allowed_updates = options.allowed_updates as Array<
        | 'message'
        | 'poll'
        | 'edited_message'
        | 'channel_post'
        | 'edited_channel_post'
        | 'business_message'
        | 'edited_business_message'
        | 'business_connection'
        | 'deleted_business_messages'
        | 'message_reaction'
        | 'message_reaction_count'
        | 'inline_query'
        | 'chosen_inline_result'
        | 'callback_query'
        | 'shipping_query'
        | 'pre_checkout_query'
        | 'poll_answer'
        | 'my_chat_member'
        | 'chat_member'
        | 'chat_join_request'
        | 'chat_boost'
        | 'removed_chat_boost'
        | 'purchased_paid_media'
      >
    }
    if (options?.drop_pending_updates) {
      webhookOptions.drop_pending_updates = options.drop_pending_updates
    }

    await this.bot.api.setWebhook(webhookOptions.url, webhookOptions)
  }

  /**
   * Get messaging capabilities
   */
  getMessagingCapabilities(): MessagingCapabilities {
    return {
      maxMessageLength: 4096,
      supportedMessageTypes: [
        MessageType.TEXT,
        MessageType.IMAGE,
        MessageType.VIDEO,
        MessageType.AUDIO,
        MessageType.DOCUMENT,
        MessageType.STICKER,
        MessageType.LOCATION,
        MessageType.CONTACT,
        MessageType.POLL
      ],
      supportedEntityTypes: [
        EntityType.MENTION,
        EntityType.HASHTAG,
        EntityType.URL,
        EntityType.EMAIL,
        EntityType.PHONE,
        EntityType.BOLD,
        EntityType.ITALIC,
        EntityType.CODE,
        EntityType.PRE,
        EntityType.LINK
      ],
      supportedAttachmentTypes: [
        AttachmentType.PHOTO,
        AttachmentType.VIDEO,
        AttachmentType.AUDIO,
        AttachmentType.DOCUMENT,
        AttachmentType.STICKER,
        AttachmentType.ANIMATION,
        AttachmentType.VOICE,
        AttachmentType.VIDEO_NOTE
      ],
      maxAttachments: 10,
      supportsEditing: true,
      supportsDeleting: true,
      supportsReactions: false, // Telegram doesn't support reactions via bot API
      supportsThreads: false,
      supportsVoice: true,
      supportsVideo: true,
      custom: {
        supportsInlineQueries: true,
        supportsCallbackQueries: true,
        supportsInlineKeyboards: true,
        supportsReplyKeyboards: true
      }
    }
  }

  /**
   * Get bot instance (for legacy compatibility)
   */
  getBot(): Bot<TelegramContext> | undefined {
    return this.bot
  }

  /**
   * Check if update was already processed (duplicate protection)
   */
  private isDuplicateUpdate(updateId: number): boolean {
    // Clean old updates periodically
    this.cleanupOldUpdates()

    // Check if we've already processed this update
    if (this.processedUpdates.has(updateId)) {
      return true
    }

    // Mark as processed
    this.processedUpdates.set(updateId, Date.now())
    return false
  }

  /**
   * Clean up old processed updates to prevent memory leak
   */
  private cleanupOldUpdates(): void {
    const now = Date.now()
    const entriesToDelete: number[] = []

    for (const [updateId, timestamp] of this.processedUpdates) {
      if (now - timestamp > this.UPDATE_MAX_AGE) {
        entriesToDelete.push(updateId)
      }
    }

    entriesToDelete.forEach(id => this.processedUpdates.delete(id))
  }

  /**
   * Set up update handlers
   */
  private setupUpdateHandlers(): void {
    if (!this.bot) return

    // Handle all updates
    this.bot.on('message', async ctx => {
      // Check for duplicate
      if (ctx.update.update_id && this.isDuplicateUpdate(ctx.update.update_id)) {
        return
      }

      // Set Sentry user context
      if (ctx.from) {
        setUserContext(ctx.from.id, {
          username: ctx.from.username,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
          isPremium: ctx.from.is_premium
        })
      }

      const unifiedMessage = telegramUpdateToUnifiedMessage(ctx.update)
      if (unifiedMessage) {
        this.emitEvent(CommonEventType.MESSAGE_RECEIVED, {
          message: unifiedMessage,
          context: ctx
        })
      }
    })

    // Handle callback queries
    this.bot.on('callback_query', async ctx => {
      // Check for duplicate
      if (ctx.update.update_id && this.isDuplicateUpdate(ctx.update.update_id)) {
        return
      }

      // Set Sentry user context
      if (ctx.from) {
        setUserContext(ctx.from.id, {
          username: ctx.from.username,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
          isPremium: ctx.from.is_premium
        })
      }

      this.emitEvent('telegram:callback_query', {
        query: ctx.callbackQuery,
        from: telegramUserToUnified(ctx.callbackQuery.from),
        context: ctx
      })
    })

    // Handle inline queries
    this.bot.on('inline_query', async ctx => {
      this.emitEvent('telegram:inline_query', {
        query: ctx.inlineQuery,
        from: telegramUserToUnified(ctx.inlineQuery.from),
        context: ctx
      })
    })
  }

  /**
   * Set up command and callback handlers
   */
  private setupHandlers(): void {
    if (!this.bot || !this.eventBus) return

    // Create command handler with default commands
    const defaultCommands = createDefaultCommands()
    const commandMap = new Map(defaultCommands.map(cmd => [cmd.name, cmd]))
    this.commandHandler = new TelegramCommandHandler(this.eventBus, commandMap)
    this.commandHandler.registerCommands(this.bot)

    // Create callback handler with default handlers
    this.callbackHandler = new TelegramCallbackHandler(this.eventBus)
    const defaultCallbacks = createDefaultCallbackHandlers()
    defaultCallbacks.forEach((handler, action) => {
      this.callbackHandler?.register(action, handler)
    })

    // Register callback query handler
    this.bot.on('callback_query', ctx => this.callbackHandler?.handleCallback(ctx))
  }

  /**
   * Set default bot commands
   */
  private async setDefaultCommands(): Promise<void> {
    const defaultCommands = createDefaultCommands()
    const botCommands: BotCommand[] = defaultCommands.map(cmd => ({
      command: cmd.name,
      description: cmd.description
    }))

    await this.setCommands(botCommands)
  }
}
