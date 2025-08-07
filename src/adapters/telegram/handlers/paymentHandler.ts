import { PaymentRepository } from '../../../domain/payments/repository'
import { TelegramStarsService } from '../../../domain/services/telegram-stars.service'
import { logger } from '../../../lib/logger'
import type { BotContext } from '../../../types'

export async function handlePreCheckoutQuery(ctx: BotContext): Promise<void> {
  const query = ctx.preCheckoutQuery
  const paymentRepo = new PaymentRepository(ctx.cloudConnector.getDatabaseStore('DB'))
  const starsService = new TelegramStarsService(ctx.api.raw, paymentRepo)

  try {
    if (!query) {
      throw new Error('No pre-checkout query in context')
    }
    await starsService.handlePreCheckoutQuery(query)
  } catch (error) {
    logger.error('Error handling pre-checkout query:', error)
    await ctx.answerPreCheckoutQuery(false, {
      error_message: 'An error occurred while processing your payment. Please try again later.'
    })
  }
}

export async function handleSuccessfulPayment(ctx: BotContext): Promise<void> {
  const payment = ctx.message?.successful_payment
  if (!payment) {
    logger.error('No successful payment in message', { message: ctx.message })
    return
  }

  const telegramId = ctx.from?.id
  if (!telegramId) {
    logger.error('No telegram ID in successful payment', { payment })
    return
  }

  const payload = JSON.parse(payment.invoice_payload)
  const chargeId = payment.telegram_payment_charge_id
  const paymentRepo = new PaymentRepository(ctx.cloudConnector.getDatabaseStore('DB'))

  try {
    // Record payment
    await paymentRepo.recordPayment({
      player_id: telegramId,
      telegram_payment_charge_id: chargeId,
      invoice_payload: payment.invoice_payload,
      payment_type: payload.type,
      stars_amount: payment.total_amount / 100, // Convert from smallest units to Stars
      status: 'completed'
    })

    // Award stars to the player (if applicable, e.g., for earning stars)
    // For this example, we assume payment is for spending stars, so no award here.
    // If your bot awards stars for certain actions, this is where you'd call starsService.awardStars

    // Delete pending invoice
    await paymentRepo.deletePendingInvoice(telegramId, payload.type)

    logger.info('Successful payment processed', {
      telegramId,
      type: payload.type,
      stars: payment.total_amount / 100,
      chargeId
    })

    // You can add specific logic based on payment type here
    if (payload.type === 'direct_message') {
      // Example: Mark direct message as paid and ready for delivery
      await ctx.reply('Your direct message has been paid for and will be delivered!')
    } else if (payload.type === 'faction_change') {
      await ctx.reply('Your faction change payment was successful!')
    }
  } catch (error) {
    logger.error('Failed to handle successful payment', { error, payment })
    await ctx.reply('An error occurred while processing your payment. Please contact support.')
  }
}
