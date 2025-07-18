import { InlineKeyboard } from 'grammy';

import type { BotContext } from '@/types';
import { logger } from '@/lib/logger';

/**
 * Handle access request callback
 */
export async function handleAccessRequest(ctx: BotContext) {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.answerCallbackQuery(ctx.i18n('user_identification_error'));
    return;
  }

  try {
    // Check if user already has a pending request
    const existingRequest = await ctx.env.DB.prepare(
      `
      SELECT id FROM access_requests 
      WHERE user_id = ? AND status = 'pending'
      LIMIT 1
    `,
    )
      .bind(userId)
      .first<{ id: number }>();

    if (existingRequest) {
      await ctx.answerCallbackQuery(ctx.i18n('access_request_exists'));
      return;
    }

    // Create new access request
    await ctx.env.DB.prepare(
      `
      INSERT INTO access_requests (user_id, username, first_name, status, created_at)
      VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)
    `,
    )
      .bind(userId, ctx.from.username ?? null, ctx.from.first_name)
      .run();

    // Update message
    await ctx.editMessageText(ctx.i18n('access_request_sent'), { parse_mode: 'HTML' });

    logger.info('Access request created', {
      userId,
      username: ctx.from.username,
    });

    // Notify admins
    await notifyAdmins(ctx, userId, ctx.from.username ?? null, ctx.from.first_name);
  } catch (error) {
    logger.error('Failed to create access request', { error, userId });
    await ctx.answerCallbackQuery(ctx.i18n('general_error'));
  }
}

/**
 * Handle access request status check
 */
export async function handleAccessStatus(ctx: BotContext) {
  await ctx.answerCallbackQuery(ctx.i18n('access_pending'));
}

/**
 * Handle access request cancellation
 */
export async function handleAccessCancel(ctx: BotContext, requestId: string) {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.answerCallbackQuery(ctx.i18n('user_identification_error'));
    return;
  }

  try {
    // Verify request belongs to user
    const request = await ctx.env.DB.prepare(
      `
      SELECT id FROM access_requests 
      WHERE id = ? AND user_id = ? AND status = 'pending'
    `,
    )
      .bind(parseInt(requestId), userId)
      .first();

    if (!request) {
      await ctx.answerCallbackQuery(ctx.i18n('request_not_found'));
      return;
    }

    // Cancel the request
    await ctx.env.DB.prepare(
      `
      UPDATE access_requests 
      SET status = 'cancelled', processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    )
      .bind(parseInt(requestId))
      .run();

    // Update message
    await ctx.editMessageText(ctx.i18n('request_cancelled'), { parse_mode: 'HTML' });

    logger.info('Access request cancelled', { requestId, userId });
  } catch (error) {
    logger.error('Failed to cancel access request', { error, requestId, userId });
    await ctx.answerCallbackQuery(ctx.i18n('general_error'));
  }
}

/**
 * Handle access request approval
 */
export async function handleAccessApprove(ctx: BotContext, requestId: string) {
  const adminId = ctx.from?.id;
  if (!adminId) return;

  try {
    // Get request details
    const request = await ctx.env.DB.prepare(
      `
      SELECT user_id, username, first_name 
      FROM access_requests 
      WHERE id = ? AND status = 'pending'
    `,
    )
      .bind(parseInt(requestId))
      .first<{
        user_id: number;
        username: string | null;
        first_name: string;
      }>();

    if (!request) {
      await ctx.answerCallbackQuery(ctx.i18n('request_not_found'));
      return;
    }

    // Approve the request
    await ctx.env.DB.prepare(
      `
      UPDATE access_requests 
      SET status = 'approved', processed_by = ?, processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    )
      .bind(adminId, parseInt(requestId))
      .run();

    // Grant access to user
    await ctx.env.DB.prepare(
      `
      UPDATE users SET has_access = true WHERE telegram_id = ?
    `,
    )
      .bind(request.user_id)
      .run();

    // Update message
    await ctx.editMessageText(ctx.i18n('request_approved', { userId: request.user_id }), {
      parse_mode: 'HTML',
    });

    logger.info('Access request approved', {
      requestId,
      userId: request.user_id,
      approvedBy: adminId,
    });

    // Notify the user
    try {
      await ctx.api.sendMessage(request.user_id, ctx.i18n('access_approved'));
    } catch (error) {
      logger.info('Could not notify user about approval', {
        userId: request.user_id,
        error,
      });
    }

    // Show next request if any
    await showNextRequest(ctx);
  } catch (error) {
    logger.error('Failed to approve access request', { error, requestId });
    await ctx.answerCallbackQuery(ctx.i18n('general_error'));
  }
}

/**
 * Handle access request rejection
 */
export async function handleAccessReject(ctx: BotContext, requestId: string) {
  const adminId = ctx.from?.id;
  if (!adminId) return;

  try {
    // Get request details
    const request = await ctx.env.DB.prepare(
      `
      SELECT user_id, username, first_name 
      FROM access_requests 
      WHERE id = ? AND status = 'pending'
    `,
    )
      .bind(parseInt(requestId))
      .first<{
        user_id: number;
        username: string | null;
        first_name: string;
      }>();

    if (!request) {
      await ctx.answerCallbackQuery(ctx.i18n('request_not_found'));
      return;
    }

    // Reject the request
    await ctx.env.DB.prepare(
      `
      UPDATE access_requests 
      SET status = 'rejected', processed_by = ?, processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    )
      .bind(adminId, parseInt(requestId))
      .run();

    // Update message
    await ctx.editMessageText(ctx.i18n('request_rejected', { userId: request.user_id }), {
      parse_mode: 'HTML',
    });

    logger.info('Access request rejected', {
      requestId,
      userId: request.user_id,
      rejectedBy: adminId,
    });

    // Notify the user
    try {
      await ctx.api.sendMessage(request.user_id, ctx.i18n('access_rejected'));
    } catch (error) {
      logger.info('Could not notify user about rejection', {
        userId: request.user_id,
        error,
      });
    }

    // Show next request if any
    await showNextRequest(ctx);
  } catch (error) {
    logger.error('Failed to reject access request', { error, requestId });
    await ctx.answerCallbackQuery(ctx.i18n('general_error'));
  }
}

/**
 * Handle next request navigation
 */
export async function handleAccessNext(ctx: BotContext, _currentRequestId: string) {
  await showNextRequest(ctx);
}

/**
 * Helper function to show next pending request
 */
async function showNextRequest(ctx: BotContext) {
  try {
    // Get next pending request
    const nextRequest = await ctx.env.DB.prepare(
      `
      SELECT 
        r.id,
        r.user_id,
        r.username,
        r.first_name,
        r.created_at
      FROM access_requests r
      WHERE r.status = 'pending'
      ORDER BY r.created_at ASC
      LIMIT 1
    `,
    ).first<{
      id: number;
      user_id: number;
      username: string | null;
      first_name: string;
      created_at: string;
    }>();

    if (!nextRequest) {
      await ctx.editMessageText(ctx.i18n('no_pending_requests'), { parse_mode: 'HTML' });
      return;
    }

    // Get total pending count
    const countResult = await ctx.env.DB.prepare(
      'SELECT COUNT(*) as count FROM access_requests WHERE status = ?',
    )
      .bind('pending')
      .first<{ count: number }>();

    const totalPending = countResult?.count || 0;

    // Build request info message
    const requestDate = new Date(nextRequest.created_at).toLocaleString();

    const requestInfo = ctx.i18n('request_info', {
      name: nextRequest.first_name,
      username: nextRequest.username || '',
      userId: nextRequest.user_id,
      date: requestDate,
    });

    let message = `📋 <b>${ctx.i18n('access_request')} #${nextRequest.id}</b>\n\n${requestInfo}`;
    message += `\n\n📊 ${ctx.i18n('request_count')}: 1/${totalPending}`;

    // Create inline keyboard
    const keyboard = new InlineKeyboard()
      .text(ctx.i18n('approve'), `access:approve:${nextRequest.id}`)
      .text(ctx.i18n('reject'), `access:reject:${nextRequest.id}`);

    if (totalPending > 1) {
      keyboard.row().text(ctx.i18n('next'), `access:next:${nextRequest.id}`);
    }

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error('Failed to show next request', { error });
    await ctx.editMessageText(ctx.i18n('requests_error'), { parse_mode: 'HTML' });
  }
}

/**
 * Notify admins about new access request
 */
async function notifyAdmins(
  ctx: BotContext,
  userId: number,
  username: string | null,
  firstName: string,
) {
  try {
    // Get all admins
    const admins = await ctx.env.DB.prepare(
      `
      SELECT user_id FROM user_roles WHERE role = 'admin'
    `,
    ).all<{ user_id: number }>();

    // Get owner IDs
    const ownerIds =
      ctx.env.BOT_OWNER_IDS?.split(',').map((id: string) => parseInt(id.trim())) || [];

    // Combine admin and owner IDs
    const notifyIds = new Set([...admins.results.map((a) => a.user_id), ...ownerIds]);

    // Prepare notification message
    const userInfo = username ? `@${username}` : firstName;
    const message = ctx.i18n('new_access_request_notification', {
      userInfo,
      userId,
    });

    // Send notifications
    for (const adminId of notifyIds) {
      try {
        await ctx.api.sendMessage(adminId, message, {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text(ctx.i18n('view_requests'), 'view_requests'),
        });
      } catch (error) {
        // Admin might have blocked the bot
        logger.info('Could not notify admin', { adminId, error });
      }
    }
  } catch (error) {
    logger.error('Failed to notify admins', { error });
  }
}
