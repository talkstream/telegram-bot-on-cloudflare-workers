/**
 * Payment service for handling Telegram payments
 */

import type { PendingInvoice, TelegramPayment } from '../domain/payments/repository'
import { PaymentRepository } from '../domain/payments/repository'
import { logger } from '../lib/logger'

import type { ResourceConstraints } from '@/core/interfaces/resource-constraints'
import { hasFeature, isConstrainedEnvironment } from '@/core/interfaces/resource-constraints'
import type { IDatabaseStore } from '@/core/interfaces/storage'

export interface PaymentServiceConfig {
  db: IDatabaseStore
  constraints?: ResourceConstraints
}

export interface CreateInvoiceOptions {
  amount: number
  currency?: string
  title: string
  description: string
  payload: string
  providerToken?: string
  startParameter?: string
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

export interface PaymentResult {
  success: boolean
  paymentId?: number
  error?: string
}

export class PaymentService {
  private repository: PaymentRepository
  private paymentsEnabled: boolean
  private maxPaymentAmount: number
  private minPaymentAmount: number

  constructor(config: PaymentServiceConfig) {
    this.repository = new PaymentRepository(config.db)

    // Configure based on resource constraints
    if (config.constraints) {
      // Payments require database feature and sufficient write capacity
      this.paymentsEnabled =
        hasFeature(config.constraints, 'payments') ||
        (hasFeature(config.constraints, 'database') &&
          config.constraints.storage.maxDBWritesPerDay > 1000)

      // In constrained environments, limit payment amounts
      if (isConstrainedEnvironment(config.constraints)) {
        this.maxPaymentAmount = 100
        this.minPaymentAmount = 10
      } else {
        this.maxPaymentAmount = 10000
        this.minPaymentAmount = 1
      }
    } else {
      // Default values when no constraints provided
      this.paymentsEnabled = false
      this.maxPaymentAmount = 100
      this.minPaymentAmount = 10
    }
  }

  /**
   * Create a new payment invoice
   */
  async createInvoice(
    playerId: number,
    invoiceType: 'faction_change' | 'direct_message',
    starsAmount: number,
    additionalData?: {
      targetMaskedId?: string
      targetFaction?: string
    }
  ): Promise<PendingInvoice> {
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // 24 hour expiration

    const invoice: PendingInvoice = {
      player_id: playerId,
      invoice_type: invoiceType,
      stars_amount: starsAmount,
      expires_at: expiresAt.toISOString(),
      ...additionalData
    }

    const invoiceId = await this.repository.savePendingInvoice(invoice)

    logger.info('Created pending invoice', {
      invoiceId,
      playerId,
      invoiceType,
      starsAmount
    })

    return {
      ...invoice,
      id: invoiceId
    }
  }

  /**
   * Process a successful payment
   */
  async processPayment(
    playerId: number,
    chargeId: string,
    invoicePayload: string,
    paymentType: 'faction_change' | 'direct_message',
    starsAmount: number,
    relatedEntityId?: string
  ): Promise<PaymentResult> {
    try {
      const payment: TelegramPayment = {
        player_id: playerId,
        telegram_payment_charge_id: chargeId,
        invoice_payload: invoicePayload,
        payment_type: paymentType,
        stars_amount: starsAmount,
        status: 'completed',
        related_entity_id: relatedEntityId
      }

      const paymentId = await this.repository.recordPayment(payment)

      // Delete pending invoice if exists
      await this.repository.deletePendingInvoice(playerId, paymentType)

      logger.info('Payment processed successfully', {
        paymentId,
        playerId,
        chargeId,
        starsAmount
      })

      return {
        success: true,
        paymentId
      }
    } catch (error) {
      logger.error('Failed to process payment', {
        error,
        playerId,
        chargeId
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment processing failed'
      }
    }
  }

  /**
   * Get pending invoice for a player
   */
  async getPendingInvoice(playerId: number, invoiceType: string): Promise<PendingInvoice | null> {
    return this.repository.getPendingInvoice(playerId, invoiceType)
  }

  /**
   * Cancel a pending invoice
   */
  async cancelInvoice(playerId: number, invoiceType: string): Promise<void> {
    await this.repository.deletePendingInvoice(playerId, invoiceType)

    logger.info('Invoice cancelled', {
      playerId,
      invoiceType
    })
  }

  /**
   * Check if payment is allowed based on current configuration
   */
  isPaymentAllowed(): boolean {
    // Payments might be restricted based on configuration
    if (!this.paymentsEnabled) {
      logger.warn('Payment attempted but payments are disabled')
      return false
    }
    return true
  }

  /**
   * Validate payment amount
   */
  validateAmount(starsAmount: number): boolean {
    return starsAmount >= this.minPaymentAmount && starsAmount <= this.maxPaymentAmount
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(_playerId: number): Promise<{
    totalPayments: number
    totalStars: number
  }> {
    // This would require additional repository methods
    // For now, return placeholder
    return {
      totalPayments: 0,
      totalStars: 0
    }
  }
}
