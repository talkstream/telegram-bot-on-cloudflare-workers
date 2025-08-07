import type { ConnectorConfig } from '../../../core/interfaces/connector.js'

/**
 * Discord connector configuration
 */
export interface DiscordConnectorConfig extends ConnectorConfig {
  /**
   * Discord application ID
   */
  applicationId: string

  /**
   * Discord public key for webhook verification
   */
  publicKey: string

  /**
   * Bot token (optional, required for REST API operations)
   */
  botToken?: string

  /**
   * Webhook URL for receiving interactions
   */
  webhookUrl?: string

  /**
   * Guild ID for guild-specific commands (optional)
   */
  guildId?: string

  /**
   * Enable debug logging
   */
  debug?: boolean
}

/**
 * Discord interaction types
 */
export enum InteractionType {
  PING = 1,
  APPLICATION_COMMAND = 2,
  MESSAGE_COMPONENT = 3,
  APPLICATION_COMMAND_AUTOCOMPLETE = 4,
  MODAL_SUBMIT = 5
}

/**
 * Discord interaction response types
 */
export enum InteractionResponseType {
  PONG = 1,
  CHANNEL_MESSAGE_WITH_SOURCE = 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5,
  DEFERRED_UPDATE_MESSAGE = 6,
  UPDATE_MESSAGE = 7,
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT = 8,
  MODAL = 9
}

/**
 * Discord message flags
 */
export enum MessageFlags {
  EPHEMERAL = 1 << 6,
  SUPPRESS_EMBEDS = 1 << 2
}

/**
 * Discord component types
 */
export enum ComponentType {
  ACTION_ROW = 1,
  BUTTON = 2,
  STRING_SELECT = 3,
  TEXT_INPUT = 4,
  USER_SELECT = 5,
  ROLE_SELECT = 6,
  MENTIONABLE_SELECT = 7,
  CHANNEL_SELECT = 8
}

/**
 * Discord button styles
 */
export enum ButtonStyle {
  PRIMARY = 1,
  SECONDARY = 2,
  SUCCESS = 3,
  DANGER = 4,
  LINK = 5
}

/**
 * Discord embed structure
 */
export interface DiscordEmbed {
  title?: string
  description?: string
  url?: string
  timestamp?: string
  color?: number
  footer?: {
    text: string
    icon_url?: string
  }
  image?: {
    url: string
  }
  thumbnail?: {
    url: string
  }
  author?: {
    name: string
    url?: string
    icon_url?: string
  }
  fields?: {
    name: string
    value: string
    inline?: boolean
  }[]
}

/**
 * Discord component structures
 */
export interface DiscordButton {
  type: ComponentType.BUTTON
  style: ButtonStyle
  label?: string
  emoji?: {
    id?: string
    name?: string
  }
  custom_id?: string
  url?: string
  disabled?: boolean
}

export interface DiscordSelectMenu {
  type: ComponentType
  custom_id: string
  placeholder?: string
  min_values?: number
  max_values?: number
  disabled?: boolean
  options?: DiscordSelectOption[]
}

export interface DiscordSelectOption {
  label: string
  value: string
  description?: string
  emoji?: {
    id?: string
    name?: string
  }
  default?: boolean
}

export interface DiscordActionRow {
  type: ComponentType.ACTION_ROW
  components: (DiscordButton | DiscordSelectMenu)[]
}

/**
 * Discord API error
 */
export class DiscordAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message)
    this.name = 'DiscordAPIError'
  }
}
