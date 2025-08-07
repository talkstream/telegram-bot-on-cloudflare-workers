import type { RawApi } from 'grammy'
import type { PreCheckoutQuery } from 'grammy/types'

import { logger } from '../../lib/logger'
import { getTimeoutConfig, withTimeout } from '../../lib/timeout-wrapper'
import { PaymentRepository } from '../payments/repository'

export class TelegramStarsService {
  private api: RawApi
  private paymentRepository: PaymentRepository
  private tier: 'free' | 'paid'

  constructor(api: RawApi, paymentRepository: PaymentRepository, tier: 'free' | 'paid' = 'free') {
    this.api = api
    this.paymentRepository = paymentRepository
    this.tier = tier
  }

  async createDirectMessageInvoice(
    telegramId: number,
    playerId: number,
    targetMaskedId: string,
    starsAmount: number
  ): Promise<string> {
    const invoicePayload = JSON.stringify({
      type: 'direct_message',
      playerId: playerId,
      targetMaskedId: targetMaskedId
    })

    const timeouts = getTimeoutConfig(this.tier)

    const invoiceLink = await withTimeout(
      this.api.sendInvoice({
        chat_id: telegramId,
        title: 'Direct Message',
        description: `Send a direct message for ${starsAmount} Stars`,
        payload: invoicePayload,
        provider_token: '', // Telegram Stars does not require a provider token; for other providers, configure here
        currency: 'XTR', // Telegram Stars currency
        prices: [{ label: 'Direct Message', amount: starsAmount * 100 }], // amount in smallest units (cents)
        max_tip_amount: 0,
        suggested_tip_amounts: [],
        start_parameter: 'direct_message',
        provider_data: ''
      }),
      {
        timeoutMs: timeouts.api,
        operation: 'Telegram sendInvoice'
      }
    )

    // For now, assume the result is the invoice link
    const linkUrl = typeof invoiceLink === 'string' ? invoiceLink : ''

    if (!linkUrl) {
      throw new Error('Failed to create invoice link')
    }

    await this.paymentRepository.savePendingInvoice({
      player_id: playerId,
      invoice_type: 'direct_message',
      target_masked_id: targetMaskedId,
      stars_amount: starsAmount,
      invoice_link: linkUrl,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString() // Expires in 1 hour
    })

    logger.info('Direct message invoice created', {
      telegramId,
      playerId,
      starsAmount
    })
    return linkUrl
  }

  async handlePreCheckoutQuery(query: PreCheckoutQuery): Promise<void> {
    const payload = JSON.parse(query.invoice_payload)

    // In a real application, you would validate the payload and check inventory/availability
    // For this wireframe, we'll just check if a pending invoice exists
    const pendingInvoice = await this.paymentRepository.getPendingInvoice(
      query.from.id,
      payload.type
    )

    if (!pendingInvoice || pendingInvoice.stars_amount * 100 !== query.total_amount) {
      await this.api.answerPreCheckoutQuery({
        pre_checkout_query_id: query.id,
        ok: false,
        error_message: 'Invoice not found or amount mismatch.'
      })
      logger.warn('Pre-checkout query failed: Invoice not found or amount mismatch', { query })
      return
    }

    await this.api.answerPreCheckoutQuery({
      pre_checkout_query_id: query.id,
      ok: true
    })
    logger.info('Pre-checkout query answered successfully', {
      queryId: query.id
    })
  }
}
