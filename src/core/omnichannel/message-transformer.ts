/**
 * Message Transformer for Wireframe v2.0
 * 
 * Transforms messages between different platform formats
 * Enables seamless message conversion across channels
 */

import type { 
  UnifiedMessage, 
  MessageContent, 
  Platform
} from '../interfaces/messaging.js';
import { Platform as PlatformEnum, MessageType as MessageTypeEnum, ChatType as ChatTypeEnum, AttachmentType } from '../interfaces/messaging.js';
import type { ILogger } from '../interfaces/logger.js';

// Platform-specific message types
type TelegramMessage = {
  message_id?: number;
  from?: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  chat?: {
    id: number;
    type: string;
    title?: string;
  };
  text?: string;
  date?: number;
  [key: string]: unknown;
}

type WhatsAppMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body: string };
  timestamp?: string;
  [key: string]: unknown;
}

type DiscordMessage = {
  id?: string;
  content?: string;
  author?: {
    id: string;
    username: string;
    global_name?: string;
  };
  channel_id?: string;
  timestamp?: string;
  [key: string]: unknown;
}

type SlackMessage = {
  type?: string;
  ts?: string;
  user?: string;
  text?: string;
  channel?: string;
  [key: string]: unknown;
}

/**
 * Platform-specific message format
 */
export interface PlatformMessage {
  platform: Platform;
  data: Record<string, unknown>;
}

/**
 * Transformation rule for converting between platforms
 */
export interface TransformationRule {
  from: Platform;
  to: Platform;
  transform: (message: UnifiedMessage) => PlatformMessage;
}

/**
 * Message transformer configuration
 */
export interface MessageTransformerConfig {
  logger?: ILogger;
  customRules?: TransformationRule[];
}

/**
 * Transforms messages between different platform formats
 */
export class MessageTransformer {
  private logger?: ILogger;
  private rules = new Map<string, TransformationRule>();

  constructor(config: MessageTransformerConfig = {}) {
    this.logger = config.logger;
    
    // Register default transformation rules
    this.registerDefaultRules();
    
    // Register custom rules if provided
    if (config.customRules) {
      config.customRules.forEach(rule => this.addRule(rule));
    }
  }

  /**
   * Transform a unified message to platform-specific format
   */
  toPlatform(message: UnifiedMessage, targetPlatform: Platform): PlatformMessage {
    if (!message.platform) {
      throw new Error('Source platform is required for transformation');
    }
    const ruleKey = this.getRuleKey(message.platform, targetPlatform);
    const rule = this.rules.get(ruleKey);
    
    if (rule) {
      return rule.transform(message);
    }
    
    // If no specific rule, try generic transformation
    return this.genericTransform(message, targetPlatform);
  }

  /**
   * Transform platform-specific message to unified format
   */
  fromPlatform(platformMessage: PlatformMessage): UnifiedMessage {
    switch (platformMessage.platform) {
      case PlatformEnum.TELEGRAM:
        return this.fromTelegram(platformMessage.data);
      case PlatformEnum.WHATSAPP:
        return this.fromWhatsApp(platformMessage.data);
      case PlatformEnum.DISCORD:
        return this.fromDiscord(platformMessage.data);
      case PlatformEnum.SLACK:
        return this.fromSlack(platformMessage.data);
      default:
        return this.genericFromPlatform(platformMessage);
    }
  }

  /**
   * Add a custom transformation rule
   */
  addRule(rule: TransformationRule): void {
    const key = this.getRuleKey(rule.from, rule.to);
    this.rules.set(key, rule);
    this.logger?.debug('Transformation rule added', { from: rule.from, to: rule.to });
  }

  /**
   * Register default transformation rules
   */
  private registerDefaultRules(): void {
    // Telegram to WhatsApp
    this.addRule({
      from: PlatformEnum.TELEGRAM,
      to: PlatformEnum.WHATSAPP,
      transform: (message) => this.telegramToWhatsApp(message),
    });

    // WhatsApp to Telegram
    this.addRule({
      from: PlatformEnum.WHATSAPP,
      to: PlatformEnum.TELEGRAM,
      transform: (message) => this.whatsAppToTelegram(message),
    });

    // Telegram to Discord
    this.addRule({
      from: PlatformEnum.TELEGRAM,
      to: PlatformEnum.DISCORD,
      transform: (message) => this.telegramToDiscord(message),
    });

    // Discord to Telegram
    this.addRule({
      from: PlatformEnum.DISCORD,
      to: PlatformEnum.TELEGRAM,
      transform: (message) => this.discordToTelegram(message),
    });

    // More rules would be added as platforms are implemented
  }

  /**
   * Telegram to WhatsApp transformation
   */
  private telegramToWhatsApp(message: UnifiedMessage): PlatformMessage {
    const data: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.chat?.id || message.sender?.id,
    };

    // Transform content
    if (message.content.type === 'text' && message.content.text) {
      data.type = 'text';
      data.text = { body: message.content.text };
    } else if (message.content.type === MessageTypeEnum.IMAGE && message.attachments && message.attachments.length > 0) {
      const attachment = message.attachments[0];
      if (attachment) {
        data.type = 'image';
        data.image = {
          link: attachment.url || '',
          caption: message.content.text,
        };
      }
    }

    // Transform inline keyboard to WhatsApp interactive buttons
    if (message.content.markup?.type === 'inline' && message.content.markup.inline_keyboard) {
      const buttons = message.content.markup.inline_keyboard[0]?.slice(0, 3); // WhatsApp max 3 buttons
      if (buttons && buttons.length > 0) {
        data.type = 'interactive';
        data.interactive = {
          type: 'button',
          body: { text: message.content.text || 'Choose an option' },
          action: {
            buttons: buttons.map((btn, idx) => ({
              type: 'reply',
              reply: {
                id: btn.callback_data || `btn_${idx}`,
                title: btn.text.substring(0, 20), // WhatsApp max 20 chars
              },
            })),
          },
        };
      }
    }

    return { platform: PlatformEnum.WHATSAPP, data };
  }

  /**
   * WhatsApp to Telegram transformation
   */
  private whatsAppToTelegram(message: UnifiedMessage): PlatformMessage {
    const data: Record<string, unknown> = {
      chat_id: message.chat?.id || message.sender?.id,
    };

    // Transform content
    if (message.content.type === 'text') {
      data.text = message.content.text;
    } else if (message.content.type === MessageTypeEnum.IMAGE && message.attachments && message.attachments.length > 0) {
      const attachment = message.attachments[0];
      if (attachment) {
        data.photo = attachment.url || attachment.file_id || '';
        data.caption = message.content.text;
      }
    }

    // Transform WhatsApp interactive elements to Telegram inline keyboard
    interface WhatsAppInteractiveData {
      interactive?: {
        type: string;
        action: {
          buttons: Array<{
            reply: {
              title: string;
              id: string;
            };
          }>;
        };
      };
    }
    const whatsappData = message.metadata as WhatsAppInteractiveData;
    if (whatsappData?.interactive?.type === 'button') {
      const buttons = whatsappData.interactive.action.buttons.map(btn => [{
        text: btn.reply.title,
        callback_data: btn.reply.id,
      }]);
      data.reply_markup = {
        inline_keyboard: buttons,
      };
    }

    return { platform: PlatformEnum.TELEGRAM, data };
  }

  /**
   * Telegram to Discord transformation
   */
  private telegramToDiscord(message: UnifiedMessage): PlatformMessage {
    const data: Record<string, unknown> = {
      content: message.content.text || '',
    };

    // Transform inline keyboard to Discord components
    if (message.content.markup?.type === 'inline' && message.content.markup.inline_keyboard) {
      const components = [{
        type: 1, // Action row
        components: message.content.markup.inline_keyboard[0]?.slice(0, 5).map(btn => ({
          type: 2, // Button
          style: btn.url ? 5 : 1, // Link or primary
          label: btn.text,
          custom_id: btn.callback_data,
          url: btn.url,
        })),
      }];
      data.components = components;
    }

    // Transform media
    if (message.attachments && message.attachments.length > 0) {
      const attachment = message.attachments[0];
      if (attachment) {
        data.embeds = [{
          image: { url: attachment.url || '' },
          description: message.content.text,
        }];
      }
    }

    return { platform: PlatformEnum.DISCORD, data };
  }

  /**
   * Discord to Telegram transformation
   */
  private discordToTelegram(message: UnifiedMessage): PlatformMessage {
    const data: Record<string, unknown> = {
      chat_id: message.chat?.id || message.sender?.id,
      text: message.content.text || '',
    };

    // Transform Discord components to Telegram inline keyboard
    interface DiscordComponents {
      components?: Array<{
        components: Array<{
          label: string;
          custom_id: string;
          url?: string;
        }>;
      }>;
    }
    const discordData = message.metadata as DiscordComponents;
    if (discordData?.components) {
      const keyboard = discordData.components[0]?.components.map(btn => [{
        text: btn.label,
        callback_data: btn.custom_id,
        url: btn.url,
      }]);
      data.reply_markup = {
        inline_keyboard: keyboard,
      };
    }

    return { platform: PlatformEnum.TELEGRAM, data };
  }

  /**
   * Convert from Telegram format to unified
   */
  private fromTelegram(data: Record<string, unknown>): UnifiedMessage {
    const msg = data as TelegramMessage;
    const content: MessageContent = {
      type: MessageTypeEnum.TEXT,
      text: msg.text || msg.caption || '',
    };

    // Will handle media through attachments
    let attachments: UnifiedMessage['attachments'];
    if (msg.photo) {
      content.type = MessageTypeEnum.IMAGE;
      attachments = [{
        type: AttachmentType.PHOTO,
        file_id: msg.photo[msg.photo.length - 1].file_id,
        mime_type: 'image/jpeg',
      }];
    }

    // Handle markup
    if (msg.reply_markup?.inline_keyboard) {
      content.markup = {
        type: 'inline',
        inline_keyboard: msg.reply_markup.inline_keyboard,
      };
    }

    return {
      id: msg.message_id?.toString() || Date.now().toString(),
      platform: PlatformEnum.TELEGRAM,
      sender: {
        id: msg.from?.id?.toString() || '',
        username: msg.from?.username,
        first_name: msg.from?.first_name,
        last_name: msg.from?.last_name,
      },
      chat: msg.chat ? {
        id: msg.chat.id.toString(),
        type: msg.chat.type as ChatTypeEnum,
        title: msg.chat.title,
      } : undefined,
      content,
      attachments,
      timestamp: msg.date ? msg.date * 1000 : Date.now(),
      metadata: msg,
    };
  }

  /**
   * Convert from WhatsApp format to unified
   */
  private fromWhatsApp(data: Record<string, unknown>): UnifiedMessage {
    const msg = data as WhatsAppMessage;
    const content: MessageContent = {
      type: MessageTypeEnum.TEXT,
      text: '',
    };

    // Handle different message types
    if (msg.type === 'text' && msg.text) {
      content.text = msg.text.body;
    } else if (msg.type === 'image') {
      content.type = MessageTypeEnum.IMAGE;
      const image = (msg as { image?: { caption?: string } }).image;
      content.text = image?.caption || '';
      // WhatsApp media handled differently - would need media download
    } else if (msg.type === 'interactive') {
      interface InteractiveMessage {
        interactive?: {
          body?: { text?: string };
          type?: string;
          action?: {
            buttons?: Array<{
              reply: {
                title: string;
                id: string;
              };
            }>;
          };
        };
      }
      const interactive = (msg as InteractiveMessage).interactive;
      content.text = interactive?.body?.text || '';
      // Convert interactive elements to markup
      if (interactive?.type === 'button' && interactive.action?.buttons) {
        content.markup = {
          type: 'inline',
          inline_keyboard: [interactive.action.buttons.map(btn => ({
            text: btn.reply.title,
            callback_data: btn.reply.id,
          }))],
        };
      }
    }

    return {
      id: msg.id || Date.now().toString(),
      platform: PlatformEnum.WHATSAPP,
      sender: {
        id: msg.from || '',
        username: (msg as { profile?: { name?: string } }).profile?.name,
      },
      content,
      timestamp: msg.timestamp ? parseInt(msg.timestamp) * 1000 : Date.now(),
      metadata: msg,
    };
  }

  /**
   * Convert from Discord format to unified
   */
  private fromDiscord(data: Record<string, unknown>): UnifiedMessage {
    const msg = data as DiscordMessage;
    const content: MessageContent = {
      type: MessageTypeEnum.TEXT,
      text: msg.content || '',
    };

    // Handle embeds as media
    if (msg.embeds && msg.embeds.length > 0) {
      const embed = msg.embeds[0];
      if (embed.image) {
        content.type = MessageTypeEnum.IMAGE;
        content.text = embed.description || '';
        // Embeds handled separately in Discord
      }
    }

    // Handle components as markup
    interface DiscordComponent {
      components?: Array<{
        components?: Array<{
          label?: string;
          custom_id?: string;
          url?: string;
        }>;
      }>;
    }
    const msgWithComponents = msg as DiscordComponent;
    if (msgWithComponents.components && msgWithComponents.components.length > 0) {
      const firstRow = msgWithComponents.components[0];
      if (firstRow?.components) {
        const buttons = firstRow.components.map(btn => ({
          text: btn.label || '',
          callback_data: btn.custom_id,
          url: btn.url,
        }));
        content.markup = {
          type: 'inline',
          inline_keyboard: [buttons],
        };
      }
    }

    return {
      id: msg.id || Date.now().toString(),
      platform: PlatformEnum.DISCORD,
      sender: {
        id: msg.author?.id || '',
        username: msg.author?.username,
        first_name: msg.author?.global_name,
      },
      chat: {
        id: msg.channel_id || '',
        type: msg.guild_id ? ChatTypeEnum.GROUP : ChatTypeEnum.PRIVATE,
      },
      content,
      timestamp: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
      metadata: msg,
    };
  }

  /**
   * Convert from Slack format to unified
   */
  private fromSlack(data: Record<string, unknown>): UnifiedMessage {
    const msg = data as SlackMessage;
    const content: MessageContent = {
      type: MessageTypeEnum.TEXT,
      text: msg.text || '',
    };

    // Handle blocks
    interface SlackBlock {
      type: string;
      text?: {
        text: string;
      };
    }
    if (msg.blocks) {
      // Extract text from blocks
      const blocks = msg.blocks as SlackBlock[];
      const textBlocks = blocks
        .filter((block) => block.type === 'section' && block.text)
        .map((block) => block.text?.text || '');
      if (textBlocks.length > 0) {
        content.text = textBlocks.join('\n');
      }
    }

    return {
      id: msg.ts || Date.now().toString(),
      platform: PlatformEnum.SLACK,
      sender: {
        id: msg.user || '',
      },
      chat: {
        id: msg.channel || '',
        type: msg.channel_type === 'im' ? ChatTypeEnum.PRIVATE : ChatTypeEnum.GROUP,
      },
      content,
      timestamp: msg.ts ? parseFloat(msg.ts) * 1000 : Date.now(),
      metadata: msg,
    };
  }

  /**
   * Generic transformation for unsupported platform pairs
   */
  private genericTransform(message: UnifiedMessage, targetPlatform: Platform): PlatformMessage {
    this.logger?.warn('No specific transformation rule found, using generic transform', {
      from: message.platform,
      to: targetPlatform,
    });

    // Basic transformation that preserves text content
    const data: Record<string, unknown> = {
      text: message.content.text || '',
      sender: message.sender?.id,
      chat: message.chat?.id,
    };

    return { platform: targetPlatform, data };
  }

  /**
   * Generic platform to unified conversion
   */
  private genericFromPlatform(platformMessage: PlatformMessage): UnifiedMessage {
    const data = platformMessage.data as Record<string, unknown>;
    return {
      id: (data.id as string) || Date.now().toString(),
      platform: platformMessage.platform,
      sender: {
        id: (data.sender as string) || (data.user as string) || (data.from as string) || '',
      },
      content: {
        type: MessageTypeEnum.TEXT,
        text: (data.text as string) || (data.message as string) || (data.content as string) || '',
      },
      timestamp: (data.timestamp as number) || Date.now(),
      metadata: data,
    };
  }

  /**
   * Get rule key for lookup
   */
  private getRuleKey(from: Platform, to: Platform): string {
    return `${from}:${to}`;
  }
}

/**
 * Factory function for creating message transformer
 */
export function createMessageTransformer(config?: MessageTransformerConfig): MessageTransformer {
  return new MessageTransformer(config);
}