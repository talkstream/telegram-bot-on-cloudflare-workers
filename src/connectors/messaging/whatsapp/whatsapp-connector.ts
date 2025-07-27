/**
 * WhatsApp Business API Connector for Wireframe v2.0
 * 
 * Supports WhatsApp Cloud API and Business API
 */

import { BaseMessagingConnector } from '../../base/base-messaging-connector.js';
import type {
  UnifiedMessage,
  MessageResult,
  BotCommand,
  WebhookOptions,
  MessagingCapabilities,
  ValidationResult,
  ConnectorConfig,
  HealthStatus,
} from '../../../core/interfaces/index.js';
import {
  Platform,
  MessageType,
  EntityType,
  AttachmentType,
  ChatType,
} from '../../../core/interfaces/messaging.js';
import { CommonEventType } from '../../../core/events/event-bus.js';
import type { PlatformCapabilitiesV2 } from '../../../core/interfaces/messaging-v2.js';
import type { User, Chat } from '../../../core/interfaces/messaging.js';

export interface WhatsAppConfig {
  /** WhatsApp Business API token */
  accessToken: string;
  /** Phone number ID */
  phoneNumberId: string;
  /** Business Account ID */
  businessAccountId?: string;
  /** Webhook verify token */
  verifyToken: string;
  /** API version */
  apiVersion?: string;
  /** API URL (for self-hosted) */
  apiUrl?: string;
  /** Enable catalog features */
  enableCatalog?: boolean;
  /** Enable business features */
  enableBusinessFeatures?: boolean;
  /** Allow additional properties */
  [key: string]: unknown;
}

/**
 * WhatsApp webhook payload types
 */
export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: { id: string; mime_type: string; sha256: string };
          document?: { id: string; mime_type: string; sha256: string; filename: string };
          audio?: { id: string; mime_type: string; sha256: string };
          video?: { id: string; mime_type: string; sha256: string };
          location?: { latitude: number; longitude: number; name?: string; address?: string };
          button?: { text: string; payload: string };
          interactive?: {
            type: string;
            list_reply?: { id: string; title: string; description?: string };
            button_reply?: { id: string; title: string };
          };
          order?: {
            catalog_id: string;
            text: string;
            product_items: Array<{
              product_retailer_id: string;
              quantity: number;
              item_price: string;
              currency: string;
            }>;
          };
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

/**
 * WhatsApp Business API Connector
 */
export class WhatsAppConnector extends BaseMessagingConnector {
  id = 'whatsapp';
  name = 'WhatsApp Business';
  version = '1.0.0';
  protected platform = Platform.WHATSAPP;

  declare protected config?: WhatsAppConfig;
  private apiUrl: string = 'https://graph.facebook.com';
  private apiVersion: string = 'v17.0';

  /**
   * Initialize the connector
   */
  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    const whatsappConfig = config as unknown as WhatsAppConfig;
    if (!whatsappConfig || typeof whatsappConfig !== 'object') {
      throw new Error('Invalid configuration');
    }
    this.config = whatsappConfig;

    if (!this.config.accessToken) {
      throw new Error('WhatsApp access token is required');
    }

    if (!this.config.phoneNumberId) {
      throw new Error('WhatsApp phone number ID is required');
    }

    if (!this.config.verifyToken) {
      throw new Error('WhatsApp verify token is required');
    }

    // Set API configuration
    if (this.config.apiUrl) {
      this.apiUrl = this.config.apiUrl;
    }
    if (this.config.apiVersion) {
      this.apiVersion = this.config.apiVersion;
    }
  }

  /**
   * Validate configuration
   */
  protected doValidateConfig(config: ConnectorConfig): ValidationResult['errors'] {
    const errors: ValidationResult['errors'] = [];
    const whatsappConfig = config as unknown as WhatsAppConfig;

    if (!whatsappConfig.accessToken) {
      errors?.push({
        field: 'accessToken',
        message: 'WhatsApp access token is required',
      });
    }

    if (!whatsappConfig.phoneNumberId) {
      errors?.push({
        field: 'phoneNumberId',
        message: 'WhatsApp phone number ID is required',
      });
    }

    if (!whatsappConfig.verifyToken) {
      errors?.push({
        field: 'verifyToken',
        message: 'WhatsApp verify token is required',
      });
    }

    return errors;
  }

  /**
   * Check if connector is ready
   */
  protected checkReadiness(): boolean {
    return !!(
      this.config?.accessToken &&
      this.config?.phoneNumberId &&
      this.config?.verifyToken
    );
  }

  /**
   * Check connector health
   */
  protected async checkHealth(): Promise<Partial<HealthStatus>> {
    if (!this.config) {
      return {
        status: 'unhealthy',
        message: 'Connector not initialized',
      };
    }

    try {
      // Call WhatsApp API to verify credentials
      const response = await fetch(
        `${this.apiUrl}/${this.apiVersion}/${this.config.phoneNumberId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json() as {
          display_phone_number: string;
          verified_name?: string;
          quality_rating?: string;
        };
        return {
          status: 'healthy',
          message: `WhatsApp Business connected: ${data.display_phone_number}`,
          details: {
            phoneNumber: data.display_phone_number,
            verifiedName: data.verified_name,
            qualityRating: data.quality_rating,
          },
        };
      } else {
        const error = await response.text();
        return {
          status: 'unhealthy',
          message: `WhatsApp API error: ${error}`,
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }

  /**
   * Destroy the connector
   */
  protected async doDestroy(): Promise<void> {
    // Clean up any resources
  }

  /**
   * Send a message
   */
  protected async doSendMessage(
    recipient: string,
    message: UnifiedMessage,
  ): Promise<MessageResult> {
    if (!this.config) {
      throw new Error('Connector not initialized');
    }

    try {
      const body = this.buildMessageBody(recipient, message);
      
      const response = await fetch(
        `${this.apiUrl}/${this.apiVersion}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (response.ok) {
        const data = await response.json() as {
          messages: Array<{ id: string }>;
        };
        return {
          success: true,
          message_id: data.messages[0]?.id || 'unknown',
        };
      } else {
        const error = await response.text();
        return {
          success: false,
          error: new Error(`WhatsApp API error: ${error}`),
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to send message'),
      };
    }
  }

  /**
   * Edit a message (not supported by WhatsApp)
   */
  protected async doEditMessage(
    _messageId: string,
    _message: UnifiedMessage,
  ): Promise<MessageResult> {
    return {
      success: false,
      error: new Error('WhatsApp does not support message editing'),
    };
  }

  /**
   * Delete a message (not supported by WhatsApp)
   */
  protected async doDeleteMessage(_messageId: string): Promise<void> {
    throw new Error('WhatsApp does not support message deletion');
  }

  /**
   * Handle webhook request
   */
  async handleWebhook(request: Request): Promise<Response> {
    const method = request.method;

    // Handle webhook verification (GET request)
    if (method === 'GET') {
      return this.handleWebhookVerification(request);
    }

    // Handle webhook notification (POST request)
    if (method === 'POST') {
      return this.handleWebhookNotification(request);
    }

    return new Response('Method not allowed', { status: 405 });
  }

  /**
   * Handle webhook verification from WhatsApp
   */
  private async handleWebhookVerification(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === this.config?.verifyToken && challenge) {
      return new Response(challenge, { status: 200 });
    }

    return new Response('Forbidden', { status: 403 });
  }

  /**
   * Handle webhook notification from WhatsApp
   */
  private async handleWebhookNotification(request: Request): Promise<Response> {
    try {
      const payload = await request.json() as WhatsAppWebhookPayload;

      // Process each entry
      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages' && change.value.messages) {
            for (const message of change.value.messages) {
              const unifiedMessage = this.convertToUnifiedMessage(message, change.value);
              if (unifiedMessage) {
                this.emitEvent(CommonEventType.MESSAGE_RECEIVED, {
                  message: unifiedMessage,
                });
              }
            }
          }

          // Handle status updates
          if (change.field === 'messages' && change.value.statuses) {
            for (const status of change.value.statuses) {
              this.emitEvent('whatsapp:status_update', {
                messageId: status.id,
                status: status.status,
                timestamp: parseInt(status.timestamp),
                recipientId: status.recipient_id,
              });
            }
          }
        }
      }

      return new Response('OK', { status: 200 });
    } catch (error) {
      this.emitEvent(CommonEventType.CONNECTOR_ERROR, {
        connector: this.id,
        operation: 'handleWebhook',
        error: error instanceof Error ? error.message : 'Webhook handling failed',
      });
      return new Response('Internal server error', { status: 500 });
    }
  }

  /**
   * Validate webhook request
   */
  async validateWebhook(_request: Request): Promise<boolean> {
    // WhatsApp uses signature validation
    // This would need to be implemented based on WhatsApp's security requirements
    return true;
  }

  /**
   * Set bot commands (not applicable for WhatsApp)
   */
  async setCommands(_commands: BotCommand[]): Promise<void> {
    // WhatsApp doesn't have a concept of bot commands like Telegram
    // Could potentially create a menu or quick replies instead
  }

  /**
   * Set webhook URL
   */
  async setWebhook(_url: string, _options?: WebhookOptions): Promise<void> {
    // WhatsApp webhooks are configured through the Facebook App dashboard
    // This could make an API call to update the webhook configuration
    throw new Error('WhatsApp webhooks must be configured through the Facebook App dashboard');
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
        MessageType.LOCATION,
        MessageType.CONTACT,
      ],
      supportedEntityTypes: [
        EntityType.URL,
        EntityType.PHONE,
        EntityType.EMAIL,
        EntityType.BOLD,
        EntityType.ITALIC,
      ],
      supportedAttachmentTypes: [
        AttachmentType.PHOTO,
        AttachmentType.VIDEO,
        AttachmentType.AUDIO,
        AttachmentType.DOCUMENT,
      ],
      maxAttachments: 1, // WhatsApp allows one media per message
      supportsEditing: false,
      supportsDeleting: false,
      supportsReactions: true,
      supportsThreads: false,
      supportsVoice: true,
      supportsVideo: true,
      custom: {
        supportsInteractiveLists: true,
        supportsInteractiveButtons: true,
        supportsCatalog: true,
        supportsTemplates: true,
        supportsBusinessFeatures: true,
        maxInteractiveButtons: 3,
        maxListSections: 10,
        maxListItems: 10,
      },
    };
  }

  /**
   * Get extended platform capabilities (v2)
   */
  getPlatformCapabilitiesV2(): PlatformCapabilitiesV2 {
    return {
      maxMessageLength: 4096,
      maxAttachments: 1,
      supportsEditing: false,
      supportsDeleting: false,
      supportsReactions: true,
      supportsThreads: false,
      supportsCards: true,
      supportsCarousels: true,
      supportsInteractiveComponents: true,
      supportsForms: true,
      supportsPayments: true,
      supportsCatalogs: true,
      supportsTemplates: true,
      supportsWorkflows: false,
      maxImageSize: 5 * 1024 * 1024, // 5MB
      maxVideoSize: 16 * 1024 * 1024, // 16MB
      maxFileSize: 100 * 1024 * 1024, // 100MB
      supportedImageFormats: ['jpeg', 'png'],
      supportedVideoFormats: ['mp4', '3gpp'],
      maxButtonsPerMessage: 3,
      maxSelectOptions: 10,
      supportsModalDialogs: false,
      supportsQuickReplies: true,
      customCapabilities: {
        maxCatalogProducts: 30,
        maxTemplateParameters: 10,
        supportsReadReceipts: true,
        supportsTypingIndicator: true,
        supportsLabels: true,
      },
    };
  }

  /**
   * Build WhatsApp message body
   */
  private buildMessageBody(recipient: string, message: UnifiedMessage): Record<string, unknown> {
    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
    };

    // Handle different message types
    switch (message.content.type) {
      case MessageType.TEXT:
        if (message.content.text) {
          // Check if we have interactive components
          if (message.content.markup?.type === 'inline' && message.content.markup.inline_keyboard) {
            body.type = 'interactive';
            body.interactive = this.buildInteractiveMessage(message);
          } else {
            body.type = 'text';
            body.text = { 
              body: message.content.text,
              preview_url: true
            };
          }
        }
        break;

      case MessageType.IMAGE:
        if (message.attachments && message.attachments.length > 0) {
          const attachment = message.attachments[0];
          if (attachment) {
            body.type = 'image';
            body.image = {
              link: attachment.url,
              caption: message.content.text || undefined,
            };
          }
        }
        break;

      case MessageType.VIDEO:
        if (message.attachments && message.attachments.length > 0) {
          const attachment = message.attachments[0];
          if (attachment) {
            body.type = 'video';
            body.video = {
              link: attachment.url,
              caption: message.content.text || undefined,
            };
          }
        }
        break;

      case MessageType.AUDIO:
        if (message.attachments && message.attachments.length > 0) {
          const attachment = message.attachments[0];
          if (attachment) {
            body.type = 'audio';
            body.audio = {
              link: attachment.url,
            };
          }
        }
        break;

      case MessageType.DOCUMENT:
        if (message.attachments && message.attachments.length > 0) {
          const attachment = message.attachments[0];
          if (attachment) {
            body.type = 'document';
            body.document = {
              link: attachment.url,
              filename: attachment.file_name || 'document',
              caption: message.content.text || undefined,
            };
          }
        }
        break;

      case MessageType.LOCATION:
        if (message.metadata?.location) {
          const loc = message.metadata.location as {
            longitude: number;
            latitude: number;
            name?: string;
            address?: string;
          };
          body.type = 'location';
          body.location = {
            longitude: loc.longitude,
            latitude: loc.latitude,
            name: loc.name,
            address: loc.address,
          };
        }
        break;

      case MessageType.CONTACT:
        if (message.metadata?.contact) {
          const contact = message.metadata.contact as {
            name: string;
            first_name?: string;
            phones?: Array<{ number: string; type?: string }>;
          };
          body.type = 'contacts';
          body.contacts = [{
            name: {
              formatted_name: contact.name,
              first_name: contact.first_name || contact.name,
            },
            phones: contact.phones || [],
          }];
        }
        break;

      default:
        throw new Error(`Message type ${message.content.type} not supported`);
    }

    // Add reply context if present
    if (message.replyTo) {
      body.context = {
        message_id: message.replyTo,
      };
    }

    return body;
  }

  /**
   * Build interactive message (buttons or list)
   */
  private buildInteractiveMessage(message: UnifiedMessage): Record<string, unknown> {
    if (!message.content.markup?.inline_keyboard) {
      throw new Error('No inline keyboard found');
    }

    const buttons = message.content.markup.inline_keyboard[0];
    if (!buttons || buttons.length === 0) {
      throw new Error('No buttons found in inline keyboard');
    }
    
    // If we have 3 or fewer buttons, use button type
    if (buttons.length <= 3) {
      return {
        type: 'button',
        body: {
          text: message.content.text || 'Please choose an option',
        },
        action: {
          buttons: buttons.map((btn, idx) => ({
            type: 'reply',
            reply: {
              id: btn.callback_data || `btn_${idx}`,
              title: btn.text.substring(0, 20), // WhatsApp limit
            },
          })),
        },
      };
    } else {
      // For more than 3 buttons, use list
      return {
        type: 'list',
        header: {
          type: 'text',
          text: 'Options',
        },
        body: {
          text: message.content.text || 'Please select from the list',
        },
        footer: {
          text: 'Powered by Wireframe',
        },
        action: {
          button: 'Select',
          sections: [{
            title: 'Available options',
            rows: buttons.map((btn, idx) => ({
              id: btn.callback_data || `opt_${idx}`,
              title: btn.text.substring(0, 24), // WhatsApp limit
              description: btn.url ? 'Link' : undefined,
            })),
          }],
        },
      };
    }
  }

  /**
   * Convert WhatsApp message to unified format
   */
  private convertToUnifiedMessage(
    message: NonNullable<WhatsAppWebhookPayload['entry'][0]['changes'][0]['value']['messages']>[0],
    metadata: WhatsAppWebhookPayload['entry'][0]['changes'][0]['value']
  ): UnifiedMessage | null {
    try {
      const sender: User = {
        id: message.from,
        first_name: metadata.contacts?.[0]?.profile?.name || message.from,
        username: message.from,
      };

      const chat: Chat = {
        id: message.from,
        type: ChatType.PRIVATE,
        metadata: {
          isBusinessChat: true,
        },
      };

      let messageType: MessageType = MessageType.TEXT;
      let text = '';
      let attachments: UnifiedMessage['attachments'] = undefined;
      let messageMetadata: Record<string, unknown> = {
        timestamp: parseInt(message.timestamp),
      };

      // Handle different message types
      if (message.text) {
        messageType = MessageType.TEXT;
        text = message.text.body;
      } else if (message.interactive) {
        messageType = MessageType.TEXT;
        if (message.interactive.list_reply) {
          text = message.interactive.list_reply.title;
          messageMetadata.interactive = {
            type: 'list_reply',
            id: message.interactive.list_reply.id,
            description: message.interactive.list_reply.description,
          };
        } else if (message.interactive.button_reply) {
          text = message.interactive.button_reply.title;
          messageMetadata.interactive = {
            type: 'button_reply',
            id: message.interactive.button_reply.id,
          };
        }
      } else if (message.image) {
        messageType = MessageType.IMAGE;
        text = message.image.caption || '';
        attachments = [{
          type: AttachmentType.PHOTO,
          file_id: message.image.id,
          mime_type: message.image.mime_type,
          // sha256: message.image.sha256, // Not part of Attachment interface
        }];
      } else if (message.video) {
        messageType = MessageType.VIDEO;
        text = message.video.caption || '';
        attachments = [{
          type: AttachmentType.VIDEO,
          file_id: message.video.id,
          mime_type: message.video.mime_type,
          // sha256: message.video.sha256, // Not part of Attachment interface
        }];
      } else if (message.audio) {
        messageType = MessageType.AUDIO;
        attachments = [{
          type: AttachmentType.AUDIO,
          file_id: message.audio.id,
          mime_type: message.audio.mime_type,
          // sha256: message.audio.sha256, // Not part of Attachment interface
        }];
      } else if (message.document) {
        messageType = MessageType.DOCUMENT;
        text = message.document.caption || '';
        attachments = [{
          type: AttachmentType.DOCUMENT,
          file_id: message.document.id,
          file_name: message.document.filename,
          mime_type: message.document.mime_type,
          // sha256: message.document.sha256, // Not part of Attachment interface
        }];
      } else if (message.location) {
        messageType = MessageType.LOCATION;
        messageMetadata.location = {
          latitude: message.location.latitude,
          longitude: message.location.longitude,
          name: message.location.name,
          address: message.location.address,
        };
      } else if (message.contacts && message.contacts.length > 0) {
        messageType = MessageType.CONTACT;
        const contact = message.contacts[0];
        messageMetadata.contact = {
          name: contact.name.formatted_name,
          first_name: contact.name.first_name,
          last_name: contact.name.last_name,
          phones: contact.phones,
          emails: contact.emails,
        };
      } else if (message.order) {
        // Handle catalog order
        messageType = MessageType.TEXT;
        text = message.order.text || 'New order received';
        messageMetadata.order = {
          catalog_id: message.order.catalog_id,
          products: message.order.product_items,
        };
      }

      // Handle button or quick reply context
      if (message.button) {
        messageMetadata.button = {
          text: message.button.text,
          payload: message.button.payload,
        };
      }

      // Check if this is a reply to another message
      const replyTo = message.context?.id || undefined;

      return {
        id: message.id,
        platform: Platform.WHATSAPP,
        sender,
        chat,
        content: {
          type: messageType,
          text,
        },
        attachments,
        replyTo,
        metadata: messageMetadata,
        timestamp: parseInt(message.timestamp) * 1000,
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to convert WhatsApp message', { error });
      }
      return null;
    }
  }

  /**
   * Send a WhatsApp template message
   */
  async sendTemplate(
    recipient: string,
    templateName: string,
    languageCode: string = 'en',
    components?: Array<{
      type: 'header' | 'body' | 'button';
      parameters: Array<{
        type: 'text' | 'image' | 'document' | 'video';
        text?: string;
        image?: { link: string };
        document?: { link: string; filename: string };
        video?: { link: string };
      }>;
    }>
  ): Promise<MessageResult> {
    if (!this.config) {
      throw new Error('Connector not initialized');
    }

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        components,
      },
    };

    try {
      const response = await fetch(
        `${this.apiUrl}/${this.apiVersion}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (response.ok) {
        const data = await response.json() as {
          messages: Array<{ id: string }>;
        };
        return {
          success: true,
          message_id: data.messages[0]?.id || 'unknown',
        };
      } else {
        const error = await response.text();
        return {
          success: false,
          error: new Error(`WhatsApp API error: ${error}`),
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to send template'),
      };
    }
  }

  /**
   * Send a catalog message
   */
  async sendCatalog(
    recipient: string,
    bodyText: string,
    catalogId: string,
    productRetailerIds: string[]
  ): Promise<MessageResult> {
    if (!this.config) {
      throw new Error('Connector not initialized');
    }

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'interactive',
      interactive: {
        type: 'product_list',
        header: {
          type: 'text',
          text: 'Our Products',
        },
        body: {
          text: bodyText,
        },
        footer: {
          text: 'Powered by Wireframe',
        },
        action: {
          catalog_id: catalogId,
          sections: [{
            title: 'Featured Products',
            product_items: productRetailerIds.map(id => ({
              product_retailer_id: id,
            })),
          }],
        },
      },
    };

    try {
      const response = await fetch(
        `${this.apiUrl}/${this.apiVersion}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (response.ok) {
        const data = await response.json() as {
          messages: Array<{ id: string }>;
        };
        return {
          success: true,
          message_id: data.messages[0]?.id || 'unknown',
        };
      } else {
        const error = await response.text();
        return {
          success: false,
          error: new Error(`WhatsApp API error: ${error}`),
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to send catalog'),
      };
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    if (!this.config) {
      throw new Error('Connector not initialized');
    }

    const body = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };

    try {
      await fetch(
        `${this.apiUrl}/${this.apiVersion}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to mark message as read', { error });
      }
    }
  }

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(recipient: string, isTyping: boolean = true): Promise<void> {
    // WhatsApp doesn't have a direct typing indicator API
    // This is a placeholder for future implementation
    if (this.logger) {
      this.logger.debug('Typing indicator requested', { recipient, isTyping });
    }
  }

  /**
   * Download media from WhatsApp
   */
  async downloadMedia(mediaId: string): Promise<{ url: string; mimeType: string } | null> {
    if (!this.config) {
      throw new Error('Connector not initialized');
    }

    try {
      // First, get the media URL
      const mediaResponse = await fetch(
        `${this.apiUrl}/${this.apiVersion}/${mediaId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
          },
        }
      );

      if (!mediaResponse.ok) {
        throw new Error('Failed to get media URL');
      }

      const mediaData = await mediaResponse.json() as {
        url: string;
        mime_type: string;
      };

      return {
        url: mediaData.url,
        mimeType: mediaData.mime_type,
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to download media', { error, mediaId });
      }
      return null;
    }
  }
}