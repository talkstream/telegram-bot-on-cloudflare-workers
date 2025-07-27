/**
 * WhatsApp Business API Types
 */

/**
 * WhatsApp message types
 */
export type WhatsAppMessageType = 
  | 'text'
  | 'image'
  | 'document'
  | 'audio'
  | 'video'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'interactive'
  | 'button'
  | 'template'
  | 'order';

/**
 * WhatsApp interactive message types
 */
export type WhatsAppInteractiveType = 
  | 'list'
  | 'button'
  | 'product'
  | 'product_list';

/**
 * WhatsApp button types
 */
export interface WhatsAppButton {
  type: 'reply';
  reply: {
    id: string;
    title: string;
  };
}

/**
 * WhatsApp list section
 */
export interface WhatsAppListSection {
  title?: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

/**
 * WhatsApp interactive message
 */
export interface WhatsAppInteractiveMessage {
  type: WhatsAppInteractiveType;
  header?: {
    type: 'text' | 'video' | 'image' | 'document';
    text?: string;
    video?: { id: string } | { link: string };
    image?: { id: string } | { link: string };
    document?: { id: string } | { link: string };
  };
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: {
    buttons?: WhatsAppButton[];
    button?: string;
    sections?: WhatsAppListSection[];
    catalog_id?: string;
    product_retailer_id?: string;
  };
}

/**
 * WhatsApp template component
 */
export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'footer' | 'button';
  format?: 'text' | 'image' | 'video' | 'document';
  text?: string;
  parameters?: Array<{
    type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
    text?: string;
    currency?: {
      fallback_value: string;
      code: string;
      amount_1000: number;
    };
    date_time?: {
      fallback_value: string;
    };
    image?: { link: string };
    document?: { link: string; filename?: string };
    video?: { link: string };
  }>;
  buttons?: Array<{
    type: 'quick_reply' | 'url';
    text: string;
    url?: string;
    payload?: string;
  }>;
}

/**
 * WhatsApp template message
 */
export interface WhatsAppTemplateMessage {
  name: string;
  language: {
    code: string;
  };
  components?: WhatsAppTemplateComponent[];
}

/**
 * WhatsApp catalog product
 */
export interface WhatsAppCatalogProduct {
  product_retailer_id: string;
}

/**
 * WhatsApp order item
 */
export interface WhatsAppOrderItem {
  product_retailer_id: string;
  quantity: number;
  item_price: string;
  currency: string;
}

/**
 * WhatsApp contact
 */
export interface WhatsAppContact {
  addresses?: Array<{
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    country_code?: string;
    type?: 'HOME' | 'WORK';
  }>;
  birthday?: string;
  emails?: Array<{
    email?: string;
    type?: 'HOME' | 'WORK';
  }>;
  name: {
    formatted_name: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    suffix?: string;
    prefix?: string;
  };
  org?: {
    company?: string;
    department?: string;
    title?: string;
  };
  phones?: Array<{
    phone?: string;
    type?: 'CELL' | 'MAIN' | 'IPHONE' | 'HOME' | 'WORK';
    wa_id?: string;
  }>;
  urls?: Array<{
    url?: string;
    type?: 'HOME' | 'WORK';
  }>;
}

/**
 * WhatsApp location
 */
export interface WhatsAppLocation {
  longitude: number;
  latitude: number;
  name?: string;
  address?: string;
}

/**
 * WhatsApp media object
 */
export interface WhatsAppMedia {
  id?: string;
  link?: string;
  caption?: string;
  filename?: string;
}

/**
 * WhatsApp message status
 */
export type WhatsAppMessageStatus = 
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

/**
 * WhatsApp pricing model
 */
export type WhatsAppPricingModel = 
  | 'CBP' // Conversation-Based Pricing
  | 'NBP'; // Notification-Based Pricing

/**
 * WhatsApp conversation type
 */
export type WhatsAppConversationType = 
  | 'business_initiated'
  | 'user_initiated'
  | 'referral_conversion';

/**
 * WhatsApp conversation category
 */
export type WhatsAppConversationCategory = 
  | 'authentication'
  | 'marketing'
  | 'utility'
  | 'service';

/**
 * WhatsApp quality rating
 */
export type WhatsAppQualityRating = 
  | 'GREEN'
  | 'YELLOW'
  | 'RED'
  | 'NA';