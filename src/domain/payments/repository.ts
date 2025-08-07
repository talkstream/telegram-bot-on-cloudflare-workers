import { logger } from '../../lib/logger'

import type { D1RunMeta, IDatabaseStore } from '@/core/interfaces/storage'

export interface TelegramPayment {
  id?: number
  player_id: number
  telegram_payment_charge_id: string
  invoice_payload: string
  payment_type: 'faction_change' | 'direct_message'
  related_entity_id?: string
  stars_amount: number
  status: 'pending' | 'completed' | 'refunded'
  created_at?: string
  updated_at?: string
}

export interface PendingInvoice {
  id?: number
  player_id: number
  invoice_type: 'faction_change' | 'direct_message'
  target_masked_id?: string
  target_faction?: string
  stars_amount: number
  invoice_link?: string
  expires_at: string
  created_at?: string
}

export class PaymentRepository {
  private db: IDatabaseStore

  constructor(db: IDatabaseStore) {
    this.db = db
  }

  async recordPayment(payment: TelegramPayment): Promise<number> {
    try {
      const result = await this.db
        .prepare(
          `INSERT INTO telegram_payments (
          player_id, telegram_payment_charge_id, invoice_payload,
          payment_type, related_entity_id, stars_amount, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          payment.player_id,
          payment.telegram_payment_charge_id,
          payment.invoice_payload,
          payment.payment_type,
          payment.related_entity_id || null,
          payment.stars_amount,
          payment.status
        )
        .run()
      const meta = result.meta as D1RunMeta
      if (!meta.last_row_id) {
        throw new Error('Failed to get last_row_id from database')
      }
      return meta.last_row_id
    } catch (error) {
      logger.error('Failed to record payment', { error, payment })
      throw new Error('Failed to record payment')
    }
  }

  async savePendingInvoice(invoice: PendingInvoice): Promise<number> {
    try {
      const result = await this.db
        .prepare(
          `INSERT INTO pending_invoices (
          player_id, invoice_type, target_masked_id, target_faction,
          stars_amount, invoice_link, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          invoice.player_id,
          invoice.invoice_type,
          invoice.target_masked_id || null,
          invoice.target_faction || null,
          invoice.stars_amount,
          invoice.invoice_link || null,
          invoice.expires_at
        )
        .run()
      const meta = result.meta as D1RunMeta
      if (!meta.last_row_id) {
        throw new Error('Failed to get last_row_id from database')
      }
      return meta.last_row_id
    } catch (error) {
      logger.error('Failed to save pending invoice', { error, invoice })
      throw new Error('Failed to save pending invoice')
    }
  }

  async getPendingInvoice(playerId: number, invoiceType: string): Promise<PendingInvoice | null> {
    try {
      const result = await this.db
        .prepare(
          `SELECT * FROM pending_invoices
         WHERE player_id = ? AND invoice_type = ?`
        )
        .bind(playerId, invoiceType)
        .first<PendingInvoice>()
      return result
    } catch (error) {
      logger.error('Failed to get pending invoice', {
        error,
        playerId,
        invoiceType
      })
      throw new Error('Failed to get pending invoice')
    }
  }

  async deletePendingInvoice(playerId: number, invoiceType: string): Promise<void> {
    try {
      await this.db
        .prepare(
          `DELETE FROM pending_invoices
         WHERE player_id = ? AND invoice_type = ?`
        )
        .bind(playerId, invoiceType)
        .run()
    } catch (error) {
      logger.error('Failed to delete pending invoice', {
        error,
        playerId,
        invoiceType
      })
      throw new Error('Failed to delete pending invoice')
    }
  }
}
