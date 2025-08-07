/**
 * Universal interfaces for all Wireframe extensions
 */

export interface Config {
  connectors?: string[]
  plugins?: string[]
  config?: Record<string, unknown>
}

export interface Connector {
  name: string
  version: string
  type: ConnectorType
  initialize(config: unknown): Promise<void>
  dispose?(): Promise<void>
}

export enum ConnectorType {
  MESSAGING = 'messaging',
  AI = 'ai',
  CLOUD = 'cloud',
  MONITORING = 'monitoring',
  DATABASE = 'database'
}

export interface Plugin {
  name: string
  version: string
  initialize(bot: Bot): Promise<void>
  dispose?(): Promise<void>
}

export interface Bot {
  on(event: string, handler: MessageHandler): void
  off(event: string, handler: MessageHandler): void
  emit(event: string, data: unknown): void
  start(): Promise<void>
  stop(): Promise<void>
}

export type MessageHandler = (message: Message) => Promise<void> | void

export interface Message {
  id: string
  text?: string
  from: User
  chat: Chat
  date: Date
  reply(text: string, options?: ReplyOptions): Promise<void>
}

export interface User {
  id: string
  username?: string
  firstName?: string
  lastName?: string
  isBot: boolean
}

export interface Chat {
  id: string
  type: 'private' | 'group' | 'supergroup' | 'channel'
  title?: string
}

export interface ReplyOptions {
  parseMode?: 'Markdown' | 'HTML'
  replyToMessageId?: string
  keyboard?: Keyboard
}

export interface Keyboard {
  buttons: Button[][]
  inline?: boolean
  resize?: boolean
  oneTime?: boolean
}

export interface Button {
  text: string
  callbackData?: string
  url?: string
}
