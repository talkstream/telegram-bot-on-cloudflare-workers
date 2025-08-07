import type { Connector } from './connector.js'

/**
 * Messaging connector interface for chat platforms
 */
export interface MessagingConnector extends Connector {
  /**
   * Send a message
   */
  sendMessage(recipient: string, message: UnifiedMessage): Promise<MessageResult>

  /**
   * Send bulk messages
   */
  sendBulk(recipients: string[], message: UnifiedMessage): Promise<BulkMessageResult>

  /**
   * Edit an existing message
   */
  editMessage(messageId: string, message: UnifiedMessage): Promise<MessageResult>

  /**
   * Delete a message
   */
  deleteMessage(messageId: string): Promise<void>

  /**
   * Handle incoming webhook
   */
  handleWebhook(request: Request): Promise<Response>

  /**
   * Validate webhook request
   */
  validateWebhook(request: Request): Promise<boolean>

  /**
   * Set bot commands
   */
  setCommands(commands: BotCommand[]): Promise<void>

  /**
   * Set webhook URL
   */
  setWebhook(url: string, options?: WebhookOptions): Promise<void>

  /**
   * Get messaging-specific capabilities
   */
  getMessagingCapabilities(): MessagingCapabilities
}

/**
 * Unified message format for all platforms
 */
export interface UnifiedMessage {
  /**
   * Unique message identifier
   */
  id?: string

  /**
   * Platform this message is from/for
   */
  platform?: Platform

  /**
   * Message sender
   */
  sender?: User

  /**
   * Chat/channel information
   */
  chat?: Chat

  /**
   * Message content
   */
  content: MessageContent

  /**
   * File attachments
   */
  attachments?: Attachment[]

  /**
   * Message being replied to
   */
  replyTo?: string

  /**
   * Platform-specific metadata
   */
  metadata?: Record<string, unknown>

  /**
   * Message timestamp
   */
  timestamp?: number
}

export interface MessageContent {
  /**
   * Plain text content
   */
  text?: string

  /**
   * Rich text entities (bold, italic, etc.)
   */
  entities?: MessageEntity[]

  /**
   * Reply markup (keyboards, buttons)
   */
  markup?: MessageMarkup

  /**
   * Interactive components
   */
  components?: InteractiveComponent[]

  /**
   * Message type
   */
  type?: MessageType
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  STICKER = 'sticker',
  LOCATION = 'location',
  CONTACT = 'contact',
  POLL = 'poll'
}

export interface MessageEntity {
  type: EntityType
  offset: number
  length: number
  url?: string
  user?: User
  language?: string
}

export enum EntityType {
  MENTION = 'mention',
  HASHTAG = 'hashtag',
  URL = 'url',
  EMAIL = 'email',
  PHONE = 'phone',
  BOLD = 'bold',
  ITALIC = 'italic',
  CODE = 'code',
  PRE = 'pre',
  LINK = 'link'
}

export interface MessageMarkup {
  type: 'inline' | 'keyboard' | 'remove'
  inline_keyboard?: InlineButton[][]
  keyboard?: KeyboardButton[][]
  resize_keyboard?: boolean
  one_time_keyboard?: boolean
  selective?: boolean
}

export interface InlineButton {
  text: string
  callback_data?: string
  url?: string
  switch_inline_query?: string
  switch_inline_query_current_chat?: string
}

export interface KeyboardButton {
  text: string
  request_contact?: boolean
  request_location?: boolean
  request_poll?: { type?: 'quiz' | 'regular' }
}

export interface InteractiveComponent {
  type: ComponentType
  id: string
  data: unknown
}

export enum ComponentType {
  BUTTON = 'button',
  SELECT_MENU = 'select_menu',
  TEXT_INPUT = 'text_input',
  MODAL = 'modal'
}

export interface User {
  id: string
  username?: string
  first_name?: string
  last_name?: string
  avatar?: string
  is_bot?: boolean
  metadata?: Record<string, unknown>
}

export interface Chat {
  id: string
  type: ChatType
  title?: string
  username?: string
  description?: string
  photo?: string
  metadata?: Record<string, unknown>
}

export enum ChatType {
  PRIVATE = 'private',
  GROUP = 'group',
  SUPERGROUP = 'supergroup',
  CHANNEL = 'channel',
  DM = 'dm',
  GUILD = 'guild'
}

export interface Attachment {
  type: AttachmentType
  url?: string
  file_id?: string
  file_size?: number
  mime_type?: string
  file_name?: string
  width?: number
  height?: number
  duration?: number
  thumbnail?: Attachment
}

export enum AttachmentType {
  PHOTO = 'photo',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  STICKER = 'sticker',
  ANIMATION = 'animation',
  VOICE = 'voice',
  VIDEO_NOTE = 'video_note'
}

export enum Platform {
  TELEGRAM = 'telegram',
  DISCORD = 'discord',
  SLACK = 'slack',
  WHATSAPP = 'whatsapp',
  FACEBOOK = 'facebook',
  INSTAGRAM = 'instagram',
  TWITTER = 'twitter',
  VIBER = 'viber',
  LINE = 'line',
  WECHAT = 'wechat'
}

export interface BotCommand {
  command: string
  description: string
  scope?: CommandScope
}

export interface CommandScope {
  type: 'default' | 'all_private_chats' | 'all_group_chats' | 'chat' | 'chat_member'
  chat_id?: string
  user_id?: string
}

export interface WebhookOptions {
  secret_token?: string
  certificate?: string
  max_connections?: number
  allowed_updates?: string[]
  drop_pending_updates?: boolean
}

export interface MessageResult {
  success: boolean
  message_id?: string
  error?: Error
}

export interface BulkMessageResult {
  total: number
  successful: number
  failed: number
  results: MessageResult[]
}

export interface MessagingCapabilities {
  /**
   * Maximum message length
   */
  maxMessageLength: number

  /**
   * Supported message types
   */
  supportedMessageTypes: MessageType[]

  /**
   * Supported entity types
   */
  supportedEntityTypes: EntityType[]

  /**
   * Supported attachment types
   */
  supportedAttachmentTypes: AttachmentType[]

  /**
   * Maximum attachments per message
   */
  maxAttachments: number

  /**
   * Supports editing messages
   */
  supportsEditing: boolean

  /**
   * Supports deleting messages
   */
  supportsDeleting: boolean

  /**
   * Supports reactions
   */
  supportsReactions: boolean

  /**
   * Supports threads
   */
  supportsThreads: boolean

  /**
   * Supports voice messages
   */
  supportsVoice: boolean

  /**
   * Supports video messages
   */
  supportsVideo: boolean

  /**
   * Platform-specific capabilities
   */
  custom?: Record<string, unknown>
}
