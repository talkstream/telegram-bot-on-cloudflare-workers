/**
 * Unified Message Format 2.0 - Extended for all platforms
 * 
 * Supports advanced features from:
 * - WhatsApp (catalogs, business features)
 * - Discord (threads, forums, embeds)
 * - Slack (blocks, workflows)
 * - LINE (rich messages, flex messages)
 * - Telegram (inline keyboards, payments)
 */

import type { Platform } from './messaging.js';

/**
 * Extended message types for all platforms
 */
export enum MessageTypeV2 {
  // Basic types (from v1)
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  STICKER = 'sticker',
  LOCATION = 'location',
  CONTACT = 'contact',
  POLL = 'poll',
  
  // WhatsApp specific
  CATALOG = 'catalog',
  PRODUCT = 'product',
  ORDER = 'order',
  TEMPLATE = 'template',
  INTERACTIVE_LIST = 'interactive_list',
  INTERACTIVE_BUTTON = 'interactive_button',
  
  // Discord specific
  EMBED = 'embed',
  THREAD_STARTER = 'thread_starter',
  FORUM_POST = 'forum_post',
  SLASH_COMMAND = 'slash_command',
  
  // Slack specific
  BLOCKS = 'blocks',
  WORKFLOW = 'workflow',
  MODAL = 'modal',
  HOME_TAB = 'home_tab',
  
  // LINE specific
  FLEX = 'flex',
  RICH_MENU = 'rich_menu',
  QUICK_REPLY = 'quick_reply',
  
  // Universal
  CARD = 'card',
  CAROUSEL = 'carousel',
  FORM = 'form',
  PAYMENT = 'payment',
}

/**
 * Extended user information
 */
export interface UserV2 {
  id: string;
  username?: string;
  displayName?: string;
  avatar?: string;
  locale?: string;
  timezone?: string;
  isPremium?: boolean;
  isVerified?: boolean;
  
  // Platform-specific fields
  platformData?: {
    // WhatsApp
    phoneNumber?: string;
    businessAccount?: boolean;
    
    // Discord
    discriminator?: string;
    roles?: string[];
    
    // Slack
    teamId?: string;
    isAdmin?: boolean;
    
    // Telegram
    firstName?: string;
    lastName?: string;
  };
}

/**
 * Extended chat/channel information
 */
export interface ChatV2 {
  id: string;
  type: 'private' | 'group' | 'channel' | 'thread' | 'forum';
  title?: string;
  description?: string;
  memberCount?: number;
  
  // Platform-specific
  platformData?: {
    // Discord
    guildId?: string;
    parentId?: string; // For threads
    
    // Slack
    workspaceId?: string;
    isPrivate?: boolean;
    
    // WhatsApp
    isBusinessChat?: boolean;
    labels?: string[];
  };
}

/**
 * Rich media attachments
 */
export interface AttachmentV2 {
  type: 'photo' | 'video' | 'audio' | 'file' | 'sticker' | 'gif';
  url?: string;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  thumbnail?: string;
  duration?: number; // For audio/video
  width?: number; // For images/video
  height?: number; // For images/video
  
  // Platform-specific
  platformData?: Record<string, unknown>;
}

/**
 * Interactive components
 */
export interface InteractiveComponent {
  type: 'button' | 'select' | 'text_input' | 'date_picker' | 'time_picker';
  id: string;
  label?: string;
  placeholder?: string;
  options?: Array<{
    label: string;
    value: string;
    description?: string;
    emoji?: string;
  }>;
  style?: 'primary' | 'secondary' | 'danger' | 'success' | 'link';
  url?: string;
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}

/**
 * Rich card component
 */
export interface RichCard {
  title?: string;
  subtitle?: string;
  description?: string;
  image?: AttachmentV2;
  thumbnail?: AttachmentV2;
  buttons?: InteractiveComponent[];
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
    icon?: string;
  };
  timestamp?: number;
  color?: string;
}

/**
 * Platform-specific content types
 */
export interface PlatformContent {
  // WhatsApp Business
  whatsapp?: {
    catalog?: {
      businessId: string;
      items: Array<{
        id: string;
        name: string;
        price: string;
        currency: string;
        image?: string;
      }>;
    };
    template?: {
      name: string;
      language: string;
      components: unknown[];
    };
  };
  
  // Discord
  discord?: {
    embed?: {
      title?: string;
      description?: string;
      url?: string;
      color?: number;
      fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
      }>;
      author?: {
        name: string;
        url?: string;
        iconUrl?: string;
      };
      footer?: {
        text: string;
        iconUrl?: string;
      };
      image?: { url: string };
      thumbnail?: { url: string };
    };
    components?: unknown[]; // Discord components
  };
  
  // Slack
  slack?: {
    blocks?: unknown[]; // Slack Block Kit
    attachments?: unknown[]; // Legacy attachments
  };
  
  // LINE
  line?: {
    flexMessage?: unknown; // LINE Flex Message
    quickReply?: {
      items: Array<{
        type: string;
        action: unknown;
      }>;
    };
  };
}

/**
 * Universal message content
 */
export interface MessageContentV2 {
  type: MessageTypeV2;
  
  // Basic content
  text?: string;
  caption?: string;
  
  // Rich content
  attachments?: AttachmentV2[];
  cards?: RichCard[];
  components?: InteractiveComponent[];
  
  // Platform-specific content
  platformContent?: PlatformContent;
  
  // Formatting and entities
  entities?: Array<{
    type: string;
    offset: number;
    length: number;
    url?: string;
    user?: UserV2;
    emoji?: string;
  }>;
  
  // Reply/thread context
  replyTo?: string;
  threadId?: string;
  
  // Payment
  payment?: {
    currency: string;
    amount: number;
    title: string;
    description?: string;
    payload?: string;
    providerToken?: string;
  };
}

/**
 * Unified Message Format 2.0
 */
export interface UnifiedMessageV2 {
  // Core fields
  id: string;
  platform: Platform;
  timestamp: number;
  
  // Actors
  sender: UserV2;
  chat: ChatV2;
  
  // Content
  content: MessageContentV2;
  
  // Metadata
  metadata: {
    // Routing
    isForwarded?: boolean;
    forwardedFrom?: UserV2;
    isEdited?: boolean;
    editedAt?: number;
    
    // Threading
    threadId?: string;
    threadPosition?: number;
    
    // Delivery
    deliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed';
    readBy?: string[];
    
    // Platform-specific
    platformMetadata?: Record<string, unknown>;
  };
  
  // Actions
  availableActions?: Array<'reply' | 'edit' | 'delete' | 'react' | 'forward' | 'pin'>;
}

/**
 * Channel-specific optimization hints
 */
export interface ChannelOptimization {
  platform: Platform;
  preferredMessageType: MessageTypeV2;
  fallbackType?: MessageTypeV2;
  transformHints?: {
    // Telegram: inline keyboard
    // WhatsApp: interactive list
    // Discord: select menu
    // Slack: block kit
    convertTo: string;
    preserveFeatures: string[];
  };
}

/**
 * Message transformation result
 */
export interface TransformationResult {
  success: boolean;
  message?: UnifiedMessageV2;
  warnings?: string[];
  platformOptimizations?: ChannelOptimization[];
}

/**
 * Platform capabilities extended
 */
export interface PlatformCapabilitiesV2 {
  // Basic capabilities (from v1)
  maxMessageLength: number;
  maxAttachments: number;
  supportsEditing: boolean;
  supportsDeleting: boolean;
  supportsReactions: boolean;
  supportsThreads: boolean;
  
  // Rich content
  supportsCards: boolean;
  supportsCarousels: boolean;
  supportsInteractiveComponents: boolean;
  supportsForms: boolean;
  
  // Business features
  supportsPayments: boolean;
  supportsCatalogs: boolean;
  supportsTemplates: boolean;
  supportsWorkflows: boolean;
  
  // Media
  maxImageSize: number;
  maxVideoSize: number;
  maxFileSize: number;
  supportedImageFormats: string[];
  supportedVideoFormats: string[];
  
  // Interactivity
  maxButtonsPerMessage: number;
  maxSelectOptions: number;
  supportsModalDialogs: boolean;
  supportsQuickReplies: boolean;
  
  // Platform-specific
  customCapabilities: Record<string, unknown>;
}