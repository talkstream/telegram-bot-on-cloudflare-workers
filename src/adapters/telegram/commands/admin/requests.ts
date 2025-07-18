import { InlineKeyboard } from 'grammy';

import type { CommandHandler } from '@/types';
import { logger } from '@/lib/logger';

/**
 * Access requests management command for administrators.
 * Shows pending access requests with approve/reject options.
 */
export const requestsCommand: CommandHandler = async (ctx) => {
  try {
    // Get pending requests
    const requests = await ctx.env.DB.prepare(
      `
      SELECT 
        r.id,
        r.user_id,
        r.username,
        r.first_name,
        r.created_at,
        u.telegram_id
      FROM access_requests r
      LEFT JOIN users u ON r.user_id = u.telegram_id
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
      telegram_id: number | null;
    }>();

    if (!requests) {
      await ctx.reply(ctx.i18n('no_pending_requests'));
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
    const requestDate = new Date(requests.created_at).toLocaleString();

    const requestInfo = ctx.i18n('request_info', {
      name: requests.first_name,
      username: requests.username || '',
      userId: requests.user_id,
      date: requestDate,
    });

    let message = `📋 <b>${ctx.i18n('access_request')} #${requests.id}</b>\n\n${requestInfo}`;
    message += `\n\n📊 ${ctx.i18n('request_count')}: 1/${totalPending}`;

    // Create inline keyboard
    const keyboard = new InlineKeyboard()
      .text(ctx.i18n('approve'), `access:approve:${requests.id}`)
      .text(ctx.i18n('reject'), `access:reject:${requests.id}`);

    if (totalPending > 1) {
      keyboard.row().text(ctx.i18n('next'), `access:next:${requests.id}`);
    }

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });

    logger.info('Admin viewing access requests', {
      adminId: ctx.from?.id,
      requestId: requests.id,
      totalPending,
    });
  } catch (error) {
    logger.error('Failed to get access requests', { error });
    await ctx.reply(ctx.i18n('requests_error'));
  }
};
