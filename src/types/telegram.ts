import type { Context as GrammyContext, SessionFlavor } from 'grammy'

import type { Env } from './env'

import type { ICloudPlatformConnector } from '@/core/interfaces/cloud-platform'
import type { I18nConnector } from '@/core/interfaces/i18n'
import type { IMonitoringConnector } from '@/core/interfaces/monitoring'
import type { RoleService } from '@/core/interfaces/role-system'
import type { PaymentRepository } from '@/domain/payments/repository'
import type { TelegramStarsService } from '@/domain/services/telegram-stars.service'
import type { TelegramRequestBatcher } from '@/lib/telegram-batcher'
import type { AIService } from '@/services/ai-service'
import type { SessionService, UserSession } from '@/services/session-service'

// Session data structure
export interface SessionData {
  userId?: number
  username?: string
  languageCode?: string
  lastCommand?: string
  lastActivity?: number
  customData?: Record<string, unknown>
}

// Extended context with session and environment
export type BotContext = GrammyContext &
  SessionFlavor<SessionData> & {
    env: Env
    cloudConnector: ICloudPlatformConnector
    monitoring: IMonitoringConnector | null
    session?: UserSession | undefined
    services: {
      session: SessionService
      ai: AIService | null
      telegramStars: TelegramStarsService
      paymentRepo: PaymentRepository
    }
    i18n: I18nConnector
    batcher?: TelegramRequestBatcher
    roleService: RoleService
  }

// Command handler type
export type CommandHandler = (ctx: BotContext) => Promise<void>

// Callback query handler type
export type CallbackHandler = (ctx: BotContext) => Promise<void>

// Telegram Stars payment types
export interface PaymentInvoice {
  title: string
  description: string
  payload: string
  currency: 'XTR'
  prices: Array<{
    label: string
    amount: number
  }>
  maxTipAmount?: number
  suggestedTipAmounts?: number[]
  providerData?: string
  photoUrl?: string
  photoSize?: number
  photoWidth?: number
  photoHeight?: number
  needName?: boolean
  needPhoneNumber?: boolean
  needEmail?: boolean
  needShippingAddress?: boolean
  sendPhoneNumberToProvider?: boolean
  sendEmailToProvider?: boolean
  isFlexible?: boolean
}
