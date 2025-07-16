import type { Context as GrammyContext, SessionFlavor } from 'grammy';

import type { Env } from './env';

// Session data structure
export interface SessionData {
  userId?: number;
  username?: string;
  languageCode?: string;
  lastCommand?: string;
  lastActivity?: number;
  customData?: Record<string, unknown>;
}

// Extended context with session and environment
export type BotContext = GrammyContext &
  SessionFlavor<SessionData> & {
    env: Env;
  };

// Command handler type
export type CommandHandler = (ctx: BotContext) => Promise<void>;

// Callback query handler type
export type CallbackHandler = (ctx: BotContext) => Promise<void>;

// Telegram Stars payment types
export interface PaymentInvoice {
  title: string;
  description: string;
  payload: string;
  currency: 'XTR';
  prices: Array<{
    label: string;
    amount: number;
  }>;
  maxTipAmount?: number;
  suggestedTipAmounts?: number[];
  providerData?: string;
  photoUrl?: string;
  photoSize?: number;
  photoWidth?: number;
  photoHeight?: number;
  needName?: boolean;
  needPhoneNumber?: boolean;
  needEmail?: boolean;
  needShippingAddress?: boolean;
  sendPhoneNumberToProvider?: boolean;
  sendEmailToProvider?: boolean;
  isFlexible?: boolean;
}
