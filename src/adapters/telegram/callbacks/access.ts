import { InlineKeyboard } from 'grammy'

import { logger } from '@/lib/logger'
import type { BotContext } from '@/types'

// Type guard to ensure DB is available
function assertDB(db: unknown): asserts db is NonNullable<BotContext['env']['DB']> {
  if (!db) {
    throw new Error('Database is not available')
  }
}

/**
 * Handle access request callback
 */
export async function handleAccessRequest(ctx: BotContext) {
  const userId = ctx.from?.id
  if (!userId) {
    await ctx.answerCallbackQuery(
      ctx.i18n.t('messages.user_identification_error', { namespace: 'access' })
    )
    return
  }

  // Check if DB is available (demo mode check)
  if (!ctx.env.DB) {
    await ctx.answerCallbackQuery('Access control is disabled in demo mode')
    await ctx.editMessageText(
      '🎯 Demo Mode: Access control features require a database.\n' +
        'Configure D1 database to enable this functionality.',
      { parse_mode: 'HTML' }
    )
    return
  }

  const db = ctx.env.DB
  assertDB(db)

  try {
    // Check if user already has a pending request
    const existingRequest = await db
      .prepare(
        `
      SELECT id FROM access_requests 
      WHERE user_id = ? AND status = 'pending'
      LIMIT 1
    `
      )
      .bind(userId)
      .first<{ id: number }>()

    if (existingRequest) {
      await ctx.answerCallbackQuery(ctx.i18n.t('request.exists', { namespace: 'access' }))
      return
    }

    // Create new access request
    await db
      .prepare(
        `
      INSERT INTO access_requests (user_id, username, first_name, status, created_at)
      VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)
    `
      )
      .bind(userId, ctx.from.username ?? null, ctx.from.first_name)
      .run()

    // Update message
    await ctx.editMessageText(ctx.i18n.t('request.sent', { namespace: 'access' }), {
      parse_mode: 'HTML'
    })

    logger.info('Access request created', {
      userId,
      username: ctx.from.username
    })

    // Notify admins
    await notifyAdmins(ctx, userId, ctx.from.username ?? null, ctx.from.first_name)
  } catch (error) {
    logger.error('Failed to create access request', { error, userId })
    await ctx.answerCallbackQuery(ctx.i18n.t('messages.general_error', { namespace: 'access' }))
  }
}

/**
 * Handle access request status check
 */
export async function handleAccessStatus(ctx: BotContext) {
  await ctx.answerCallbackQuery(ctx.i18n.t('request.pending', { namespace: 'access' }))
}

/**
 * Handle access request cancellation
 */
export async function handleAccessCancel(ctx: BotContext, requestId: string) {
  const userId = ctx.from?.id
  if (!userId) {
    await ctx.answerCallbackQuery(
      ctx.i18n.t('messages.user_identification_error', { namespace: 'access' })
    )
    return
  }

  // Check if DB is available (demo mode check)
  if (!ctx.env.DB) {
    await ctx.answerCallbackQuery('Access control is disabled in demo mode')
    return
  }

  const db = ctx.env.DB
  assertDB(db)

  try {
    // Verify request belongs to user
    const request = await db
      .prepare(
        `
      SELECT id FROM access_requests 
      WHERE id = ? AND user_id = ? AND status = 'pending'
    `
      )
      .bind(parseInt(requestId), userId)
      .first()

    if (!request) {
      await ctx.answerCallbackQuery(ctx.i18n.t('request.not_found', { namespace: 'access' }))
      return
    }

    // Cancel the request
    await db
      .prepare(
        `
      UPDATE access_requests 
      SET status = 'cancelled', processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
      )
      .bind(parseInt(requestId))
      .run()

    await ctx.editMessageText(ctx.i18n.t('request.cancelled', { namespace: 'access' }), {
      parse_mode: 'HTML'
    })

    logger.info('Access request cancelled', { requestId, userId })
  } catch (error) {
    logger.error('Failed to cancel access request', { error, requestId, userId })
    await ctx.answerCallbackQuery(ctx.i18n.t('messages.general_error', { namespace: 'access' }))
  }
}

/**
 * Handle access request approval
 */
export async function handleAccessApprove(ctx: BotContext, requestId: string) {
  const adminId = ctx.from?.id
  if (!adminId) {
    await ctx.answerCallbackQuery(
      ctx.i18n.t('messages.user_identification_error', { namespace: 'access' })
    )
    return
  }

  // Check if DB is available (demo mode check)
  if (!ctx.env.DB) {
    await ctx.answerCallbackQuery('Access control is disabled in demo mode')
    return
  }

  const db = ctx.env.DB
  assertDB(db)

  try {
    // Get request details
    const request = await db
      .prepare(
        `
      SELECT * FROM access_requests 
      WHERE id = ? AND status = 'pending'
    `
      )
      .bind(parseInt(requestId))
      .first<{ id: number; user_id: number; username: string; first_name: string }>()

    if (!request) {
      await ctx.answerCallbackQuery(ctx.i18n.t('request.not_found', { namespace: 'access' }))
      return
    }

    // Update request status
    await db
      .prepare(
        `
      UPDATE access_requests 
      SET status = 'approved', processed_at = CURRENT_TIMESTAMP, processed_by = ?
      WHERE id = ?
    `
      )
      .bind(adminId, parseInt(requestId))
      .run()

    // Grant access to user
    await db
      .prepare(
        `
      INSERT OR REPLACE INTO users (telegram_id, username, first_name, role, created_at)
      VALUES (?, ?, ?, 'user', CURRENT_TIMESTAMP)
    `
      )
      .bind(request.user_id, request.username, request.first_name)
      .run()

    // Update admin's message
    const keyboard = new InlineKeyboard().text(
      ctx.i18n.t('buttons.view_next', { namespace: 'access' }),
      'request_next'
    )

    await ctx.editMessageText(
      ctx.i18n.t('request.approved', {
        params: {
          userId: request.user_id,
          username: request.username || ctx.i18n.t('messages.no_username', { namespace: 'access' })
        },
        namespace: 'access'
      }),
      {
        parse_mode: 'HTML',
        reply_markup: keyboard
      }
    )

    // Notify user
    try {
      await ctx.api.sendMessage(
        request.user_id,
        ctx.i18n.t('notifications.granted', { namespace: 'access' }),
        {
          parse_mode: 'HTML'
        }
      )
    } catch (error) {
      logger.error('Failed to notify user about access approval', {
        error,
        userId: request.user_id
      })
    }

    logger.info('Access request approved', {
      requestId,
      userId: request.user_id,
      adminId
    })
  } catch (error) {
    logger.error('Failed to approve access request', { error, requestId, adminId })
    await ctx.answerCallbackQuery(ctx.i18n.t('messages.general_error', { namespace: 'access' }))
  }
}

/**
 * Handle access request rejection
 */
export async function handleAccessReject(ctx: BotContext, requestId: string) {
  const adminId = ctx.from?.id
  if (!adminId) {
    await ctx.answerCallbackQuery(
      ctx.i18n.t('messages.user_identification_error', { namespace: 'access' })
    )
    return
  }

  // Check if DB is available (demo mode check)
  if (!ctx.env.DB) {
    await ctx.answerCallbackQuery('Access control is disabled in demo mode')
    return
  }

  const db = ctx.env.DB
  assertDB(db)

  try {
    // Get request details
    const request = await db
      .prepare(
        `
      SELECT * FROM access_requests 
      WHERE id = ? AND status = 'pending'
    `
      )
      .bind(parseInt(requestId))
      .first<{ id: number; user_id: number; username: string }>()

    if (!request) {
      await ctx.answerCallbackQuery(ctx.i18n.t('request.not_found', { namespace: 'access' }))
      return
    }

    // Update request status
    await db
      .prepare(
        `
      UPDATE access_requests 
      SET status = 'rejected', processed_at = CURRENT_TIMESTAMP, processed_by = ?
      WHERE id = ?
    `
      )
      .bind(adminId, parseInt(requestId))
      .run()

    // Update admin's message
    const keyboard = new InlineKeyboard().text(
      ctx.i18n.t('buttons.view_next', { namespace: 'access' }),
      'request_next'
    )

    await ctx.editMessageText(
      ctx.i18n.t('request.rejected', {
        params: {
          userId: request.user_id,
          username: request.username || ctx.i18n.t('messages.no_username', { namespace: 'access' })
        },
        namespace: 'access'
      }),
      {
        parse_mode: 'HTML',
        reply_markup: keyboard
      }
    )

    // Notify user
    try {
      await ctx.api.sendMessage(
        request.user_id,
        ctx.i18n.t('notifications.denied', { namespace: 'access' }),
        {
          parse_mode: 'HTML'
        }
      )
    } catch (error) {
      logger.error('Failed to notify user about access rejection', {
        error,
        userId: request.user_id
      })
    }

    logger.info('Access request rejected', {
      requestId,
      userId: request.user_id,
      adminId
    })
  } catch (error) {
    logger.error('Failed to reject access request', { error, requestId, adminId })
    await ctx.answerCallbackQuery(ctx.i18n.t('messages.general_error', { namespace: 'access' }))
  }
}

/**
 * Handle showing next pending request
 */
export async function handleNextRequest(ctx: BotContext) {
  const adminId = ctx.from?.id
  if (!adminId) {
    await ctx.answerCallbackQuery(
      ctx.i18n.t('messages.user_identification_error', { namespace: 'access' })
    )
    return
  }

  // Check if DB is available (demo mode check)
  if (!ctx.env.DB) {
    await ctx.editMessageText(
      '🎯 Demo Mode: Access control features require a database.\n' +
        'Configure D1 database to enable this functionality.',
      { parse_mode: 'HTML' }
    )
    return
  }

  const db = ctx.env.DB
  assertDB(db)

  try {
    // Get next pending request
    const request = await db
      .prepare(
        `
      SELECT * FROM access_requests 
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
    `
      )
      .first<{
        id: number
        user_id: number
        username: string
        first_name: string
        created_at: string
      }>()

    if (!request) {
      await ctx.editMessageText(ctx.i18n.t('request.no_pending', { namespace: 'access' }), {
        parse_mode: 'HTML'
      })
      return
    }

    // Show request details
    const keyboard = new InlineKeyboard()
      .text(ctx.i18n.t('buttons.approve', { namespace: 'access' }), `approve_${request.id}`)
      .text(ctx.i18n.t('buttons.reject', { namespace: 'access' }), `reject_${request.id}`)
      .row()
      .text(ctx.i18n.t('buttons.view_next', { namespace: 'access' }), 'request_next')

    await ctx.editMessageText(
      ctx.i18n.t('request.details', {
        params: {
          id: request.id,
          userId: request.user_id,
          username: request.username || ctx.i18n.t('messages.no_username', { namespace: 'access' }),
          firstName: request.first_name,
          date: new Date(request.created_at).toLocaleString()
        },
        namespace: 'access'
      }),
      {
        parse_mode: 'HTML',
        reply_markup: keyboard
      }
    )
  } catch (error) {
    logger.error('Failed to get next request', { error, adminId })
    await ctx.editMessageText(ctx.i18n.t('messages.general_error', { namespace: 'access' }), {
      parse_mode: 'HTML'
    })
  }
}

/**
 * Notify admins about new access request
 */
async function notifyAdmins(
  ctx: BotContext,
  userId: number,
  username: string | null,
  firstName: string
) {
  // Check if DB is available (demo mode check)
  if (!ctx.env.DB) {
    return
  }

  const db = ctx.env.DB
  assertDB(db)

  try {
    // Get all admins
    const admins = await db
      .prepare(
        `
      SELECT telegram_id FROM users 
      WHERE role IN ('admin', 'owner')
    `
      )
      .all<{ telegram_id: number }>()

    const keyboard = new InlineKeyboard().text(
      ctx.i18n.t('buttons.review_request', { namespace: 'access' }),
      'request_next'
    )

    const message = ctx.i18n.t('notifications.new_access_request', {
      params: {
        userId,
        username: username || ctx.i18n.t('messages.no_username', { namespace: 'access' }),
        firstName
      },
      namespace: 'access'
    })

    // Send notification to each admin
    for (const admin of admins.results) {
      try {
        await ctx.api.sendMessage(admin.telegram_id, message, {
          parse_mode: 'HTML',
          reply_markup: keyboard
        })
      } catch (error) {
        logger.error('Failed to notify admin', { error, adminId: admin.telegram_id })
      }
    }
  } catch (error) {
    logger.error('Failed to notify admins about access request', { error, userId })
  }
}
