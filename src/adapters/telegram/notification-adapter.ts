/**
 * Telegram notification adapter
 * Implements notification delivery via Telegram Bot API
 */

import { Bot } from 'grammy';
import type { InlineKeyboardButton } from 'grammy/types';

import type {
  INotificationAdapter,
  UserInfo,
  NotificationTemplate,
  FormattedMessage,
} from '../../core/interfaces/notification';

export interface TelegramNotificationAdapterDeps {
  bot: Bot;
  defaultLocale?: string;
}

export class TelegramNotificationAdapter implements INotificationAdapter {
  private bot: Bot;
  private defaultLocale: string;

  constructor(deps: TelegramNotificationAdapterDeps) {
    this.bot = deps.bot;
    this.defaultLocale = deps.defaultLocale || 'en';
  }

  async deliver(recipientId: string, message: FormattedMessage): Promise<void> {
    const telegramId = parseInt(recipientId);
    if (isNaN(telegramId)) {
      throw new Error(`Invalid Telegram ID: ${recipientId}`);
    }

    try {
      const options: any = {
        parse_mode: message.parseMode || 'HTML',
      };

      // Add inline keyboard if provided
      if (message.inlineKeyboard) {
        options.reply_markup = {
          inline_keyboard: this.convertToTelegramKeyboard(message.inlineKeyboard),
        };
      }

      await this.bot.api.sendMessage(telegramId, message.text, options);
    } catch (error: any) {
      // Check for specific Telegram errors
      if (error.error_code === 403) {
        throw new Error('USER_BLOCKED');
      }
      throw error;
    }
  }

  async checkReachability(recipientId: string): Promise<boolean> {
    const telegramId = parseInt(recipientId);
    if (isNaN(telegramId)) {
      return false;
    }

    try {
      // Try to get chat info
      await this.bot.api.getChat(telegramId);
      return true;
    } catch (error: any) {
      // 400 Bad Request: chat not found
      // 403 Forbidden: bot was blocked by user
      if (error.error_code === 400 || error.error_code === 403) {
        return false;
      }
      // For other errors, assume user might be reachable
      return true;
    }
  }

  async getUserInfo(recipientId: string): Promise<UserInfo> {
    const telegramId = parseInt(recipientId);
    if (isNaN(telegramId)) {
      throw new Error(`Invalid Telegram ID: ${recipientId}`);
    }

    try {
      const chat = await this.bot.api.getChat(telegramId);
      
      return {
        id: recipientId,
        locale: chat.type === 'private' && 'language_code' in chat 
          ? (chat as any).language_code || this.defaultLocale
          : this.defaultLocale,
        firstName: 'first_name' in chat ? chat.first_name : undefined,
        lastName: 'last_name' in chat ? (chat as any).last_name : undefined,
        username: 'username' in chat ? (chat as any).username : undefined,
      };
    } catch (error) {
      // Return minimal info if we can't get chat details
      return {
        id: recipientId,
        locale: this.defaultLocale,
      };
    }
  }

  async formatMessage(
    template: NotificationTemplate,
    params: Record<string, any>,
    locale: string,
  ): Promise<FormattedMessage> {
    // Get localized content
    const content = template.content[locale] || template.content[this.defaultLocale];
    if (!content) {
      throw new Error(`No content found for template ${template.id} in locale ${locale}`);
    }

    // Simple template replacement
    let text = content.body;
    for (const [key, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    const formatted: FormattedMessage = {
      text,
      parseMode: content.parseMode || 'HTML',
    };

    // Add buttons if provided
    if (content.buttons) {
      formatted.inlineKeyboard = content.buttons.map((row) =>
        row.map((button) => ({
          text: this.replaceParams(button.text, params),
          callbackData: button.callbackData 
            ? this.replaceParams(button.callbackData, params)
            : undefined,
          url: button.url 
            ? this.replaceParams(button.url, params)
            : undefined,
        })),
      );
    }

    return formatted;
  }

  isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error) || !(error as any).error_code) {
      return true; // Retry on unknown errors
    }

    const errorCode = (error as any).error_code;
    
    // Don't retry on these errors
    const nonRetryableErrors = [
      400, // Bad Request
      403, // Forbidden (user blocked bot)
      404, // Not Found
    ];

    return !nonRetryableErrors.includes(errorCode);
  }

  private convertToTelegramKeyboard(
    keyboard: FormattedMessage['inlineKeyboard'],
  ): InlineKeyboardButton[][] {
    if (!keyboard) return [];

    return keyboard.map((row) =>
      row.map((button) => {
        const telegramButton: InlineKeyboardButton = {
          text: button.text,
        };

        if (button.callbackData) {
          telegramButton.callback_data = button.callbackData;
        } else if (button.url) {
          telegramButton.url = button.url;
        }

        return telegramButton;
      }),
    );
  }

  private replaceParams(text: string, params: Record<string, any>): string {
    let result = text;
    for (const [key, value] of Object.entries(params)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return result;
  }
}