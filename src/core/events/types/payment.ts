/**
 * Payment-related event types
 */

export enum PaymentEventType {
  // Payment lifecycle
  PAYMENT_INITIATED = 'payment:initiated',
  PAYMENT_PROCESSING = 'payment:processing',
  PAYMENT_COMPLETED = 'payment:completed',
  PAYMENT_FAILED = 'payment:failed',
  PAYMENT_CANCELLED = 'payment:cancelled',

  // Refund events
  REFUND_INITIATED = 'payment:refund:initiated',
  REFUND_PROCESSED = 'payment:refund:processed',
  REFUND_FAILED = 'payment:refund:failed',

  // Invoice events
  INVOICE_CREATED = 'payment:invoice:created',
  INVOICE_SENT = 'payment:invoice:sent',
  INVOICE_PAID = 'payment:invoice:paid',
  INVOICE_OVERDUE = 'payment:invoice:overdue',
  INVOICE_CANCELLED = 'payment:invoice:cancelled',

  // Subscription events
  SUBSCRIPTION_CREATED = 'payment:subscription:created',
  SUBSCRIPTION_UPDATED = 'payment:subscription:updated',
  SUBSCRIPTION_CANCELLED = 'payment:subscription:cancelled',
  SUBSCRIPTION_RENEWED = 'payment:subscription:renewed',
  SUBSCRIPTION_EXPIRED = 'payment:subscription:expired',

  // Balance events
  BALANCE_UPDATED = 'payment:balance:updated',
  BALANCE_LOW = 'payment:balance:low',
  BALANCE_TOPPED_UP = 'payment:balance:topped_up'
}
