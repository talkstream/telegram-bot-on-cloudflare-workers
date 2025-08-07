/**
 * Payment Service integration through EventBus
 * Bridges the PaymentService with the new connector architecture
 */

import type { EventBus } from '../../core/events/event-bus'
import { logger } from '../../lib/logger'
import { PaymentService } from '../../services/payment-service'

import type { ResourceConstraints } from '@/core/interfaces/resource-constraints'
import type { IDatabaseStore } from '@/core/interfaces/storage'

export interface PaymentConnectorConfig {
  db: IDatabaseStore
  constraints?: ResourceConstraints
}

export class PaymentServiceConnector {
  private paymentService: PaymentService

  constructor(
    private eventBus: EventBus,
    config: PaymentConnectorConfig
  ) {
    // PaymentService now uses ResourceConstraints directly
    this.paymentService = new PaymentService({
      db: config.db,
      constraints: config.constraints
    })
    this.setupEventHandlers()
  }

  /**
   * Setup event handlers for payment requests
   */
  private setupEventHandlers(): void {
    // Handle invoice creation
    this.eventBus.on('payment:create_invoice', async event => {
      const { playerId, invoiceType, starsAmount, additionalData, requestId } = event.payload as {
        playerId: number
        invoiceType: 'faction_change' | 'direct_message'
        starsAmount: number
        additionalData?: {
          targetMaskedId?: string
          targetFaction?: string
        }
        requestId: string
      }

      try {
        // Check if payments are allowed
        if (!this.paymentService.isPaymentAllowed()) {
          throw new Error('Payments are not allowed on free tier')
        }

        // Validate amount
        if (!this.paymentService.validateAmount(starsAmount)) {
          throw new Error('Invalid payment amount')
        }

        const invoice = await this.paymentService.createInvoice(
          playerId,
          invoiceType,
          starsAmount,
          additionalData
        )

        // Emit success event
        this.eventBus.emit(
          'payment:invoice_created',
          {
            requestId,
            invoice
          },
          'PaymentServiceConnector'
        )
      } catch (error) {
        // Emit error event
        this.eventBus.emit(
          'payment:invoice_error',
          {
            requestId,
            error: error instanceof Error ? error.message : 'Failed to create invoice'
          },
          'PaymentServiceConnector'
        )

        logger.error('Failed to create invoice', { error, playerId, invoiceType, requestId })
      }
    })

    // Handle payment processing
    this.eventBus.on('payment:process', async event => {
      const {
        playerId,
        chargeId,
        invoicePayload,
        paymentType,
        starsAmount,
        relatedEntityId,
        requestId
      } = event.payload as {
        playerId: number
        chargeId: string
        invoicePayload: string
        paymentType: 'faction_change' | 'direct_message'
        starsAmount: number
        relatedEntityId?: string
        requestId: string
      }

      try {
        const result = await this.paymentService.processPayment(
          playerId,
          chargeId,
          invoicePayload,
          paymentType,
          starsAmount,
          relatedEntityId
        )

        if (result.success) {
          // Emit success event
          this.eventBus.emit(
            'payment:process_success',
            {
              requestId,
              paymentId: result.paymentId,
              playerId,
              starsAmount
            },
            'PaymentServiceConnector'
          )
        } else {
          throw new Error(result.error || 'Payment processing failed')
        }
      } catch (error) {
        // Emit error event
        this.eventBus.emit(
          'payment:process_error',
          {
            requestId,
            error: error instanceof Error ? error.message : 'Failed to process payment'
          },
          'PaymentServiceConnector'
        )

        logger.error('Failed to process payment', { error, playerId, chargeId, requestId })
      }
    })

    // Handle pending invoice retrieval
    this.eventBus.on('payment:get_invoice', async event => {
      const { playerId, invoiceType, requestId } = event.payload as {
        playerId: number
        invoiceType: string
        requestId: string
      }

      try {
        const invoice = await this.paymentService.getPendingInvoice(playerId, invoiceType)

        // Emit response event
        this.eventBus.emit(
          'payment:invoice_retrieved',
          {
            requestId,
            invoice
          },
          'PaymentServiceConnector'
        )
      } catch (error) {
        // Emit error event
        this.eventBus.emit(
          'payment:invoice_retrieval_error',
          {
            requestId,
            error: error instanceof Error ? error.message : 'Failed to get invoice'
          },
          'PaymentServiceConnector'
        )

        logger.error('Failed to get invoice', { error, playerId, invoiceType, requestId })
      }
    })

    // Handle invoice cancellation
    this.eventBus.on('payment:cancel_invoice', async event => {
      const { playerId, invoiceType, requestId } = event.payload as {
        playerId: number
        invoiceType: string
        requestId: string
      }

      try {
        await this.paymentService.cancelInvoice(playerId, invoiceType)

        // Emit success event
        this.eventBus.emit(
          'payment:invoice_cancelled',
          {
            requestId,
            playerId,
            invoiceType
          },
          'PaymentServiceConnector'
        )
      } catch (error) {
        // Emit error event
        this.eventBus.emit(
          'payment:cancellation_error',
          {
            requestId,
            error: error instanceof Error ? error.message : 'Failed to cancel invoice'
          },
          'PaymentServiceConnector'
        )

        logger.error('Failed to cancel invoice', { error, playerId, invoiceType, requestId })
      }
    })

    // Handle payment stats request
    this.eventBus.on('payment:get_stats', async event => {
      const { playerId, requestId } = event.payload as {
        playerId: number
        requestId: string
      }

      try {
        const stats = await this.paymentService.getPaymentStats(playerId)

        // Emit response event
        this.eventBus.emit(
          'payment:stats_retrieved',
          {
            requestId,
            stats
          },
          'PaymentServiceConnector'
        )
      } catch (error) {
        // Emit error event
        this.eventBus.emit(
          'payment:stats_error',
          {
            requestId,
            error: error instanceof Error ? error.message : 'Failed to get payment stats'
          },
          'PaymentServiceConnector'
        )

        logger.error('Failed to get payment stats', { error, playerId, requestId })
      }
    })
  }

  /**
   * Get the underlying payment service instance
   */
  getService(): PaymentService {
    return this.paymentService
  }
}
