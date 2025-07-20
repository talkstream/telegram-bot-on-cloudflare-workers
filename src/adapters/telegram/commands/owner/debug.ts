import type { CommandHandler } from '@/types';
import { logger } from '@/lib/logger';

/**
 * Debug mode management command for bot owners.
 * Controls visibility of error messages and unauthorized access attempts.
 */
export const debugCommand: CommandHandler = async (ctx) => {
  const args = ctx.match?.toString().trim().split(/\s+/) || [];
  const subCommand = args[0]?.toLowerCase();

  switch (subCommand) {
    case 'on':
      await handleDebugOn(ctx, args[1]);
      break;

    case 'off':
      await handleDebugOff(ctx);
      break;

    case 'status':
      await handleDebugStatus(ctx);
      break;

    default:
      await showDebugHelp(ctx);
  }
};

/**
 * Shows debug command help.
 */
async function showDebugHelp(ctx: Parameters<CommandHandler>[0]) {
  await ctx.reply(ctx.i18n('debug_usage'), { parse_mode: 'HTML' });
}

/**
 * Enables debug mode with specified level.
 */
async function handleDebugOn(ctx: Parameters<CommandHandler>[0], levelStr?: string) {
  try {
    // Check if DB is available (demo mode check)
    if (!ctx.env.DB) {
      await ctx.reply(
        '🎯 Demo Mode: This feature requires a database.\nConfigure D1 database to enable this functionality.',
      );
      return;
    }

    const level = levelStr ? parseInt(levelStr) : 1;

    if (isNaN(level) || level < 1 || level > 3) {
      await ctx.reply(ctx.i18n('debug_invalid_level'));
      return;
    }

    // Update debug level in bot settings
    await ctx.env.DB.prepare(
      `
      INSERT INTO bot_settings (key, value, updated_at)
      VALUES ('debug_level', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET 
        value = excluded.value,
        updated_at = excluded.updated_at
    `,
    )
      .bind(level.toString())
      .run();

    // Level description is no longer needed here since we use i18n

    await ctx.reply(ctx.i18n('debug_enabled', { level }), { parse_mode: 'HTML' });

    logger.info('Debug mode enabled', {
      level,
      enabledBy: ctx.from?.id,
    });
  } catch (error) {
    logger.error('Failed to enable debug mode', { error });
    await ctx.reply(ctx.i18n('debug_enable_error'));
  }
}

/**
 * Disables debug mode.
 */
async function handleDebugOff(ctx: Parameters<CommandHandler>[0]) {
  try {
    // Set debug level to 0 (off)
    await ctx.env.DB.prepare(
      `
      INSERT INTO bot_settings (key, value, updated_at)
      VALUES ('debug_level', '0', CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET 
        value = excluded.value,
        updated_at = excluded.updated_at
    `,
    ).run();

    await ctx.reply(ctx.i18n('debug_disabled'));

    logger.info('Debug mode disabled', {
      disabledBy: ctx.from?.id,
    });
  } catch (error) {
    logger.error('Failed to disable debug mode', { error });
    await ctx.reply(ctx.i18n('debug_disable_error'));
  }
}

/**
 * Shows current debug status.
 */
async function handleDebugStatus(ctx: Parameters<CommandHandler>[0]) {
  try {
    const setting = (await ctx.env.DB.prepare(
      'SELECT value, updated_at FROM bot_settings WHERE key = ?',
    )
      .bind('debug_level')
      .first()) as { value: string; updated_at: string } | null;

    const level = parseInt(setting?.value || '0');

    let statusText;
    if (level === 0) {
      statusText = ctx.i18n('debug_status_disabled');
    } else {
      statusText = ctx.i18n('debug_status_enabled', { level });
    }

    const message = ctx.i18n('debug_status', { status: statusText });

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    logger.error('Failed to get debug status', { error });
    await ctx.reply(ctx.i18n('debug_status_error'));
  }
}
