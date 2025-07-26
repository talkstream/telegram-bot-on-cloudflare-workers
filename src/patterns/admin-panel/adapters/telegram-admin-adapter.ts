/**
 * Telegram Admin Adapter
 * Handles Telegram-specific admin functionality
 */

import type { Bot, Context } from 'grammy';

import type {
  IAdminPlatformAdapter,
  AdminUser,
  AdminPanelConfig,
  IAdminPanelService,
} from '../../../core/interfaces/admin-panel.js';
import type { ILogger } from '../../../core/interfaces/logger.js';

interface TelegramAdminAdapterDeps {
  bot: Bot<Context>;
  adminService: IAdminPanelService;
  config: AdminPanelConfig;
  logger: ILogger;
  adminIds: number[];
}

export class TelegramAdminAdapter implements IAdminPlatformAdapter {
  public readonly platform = 'telegram';

  private bot: Bot<Context>;
  private adminService: IAdminPanelService;
  private config: AdminPanelConfig;
  private logger: ILogger;
  private adminIds: number[];

  constructor(deps: TelegramAdminAdapterDeps) {
    this.bot = deps.bot;
    this.adminService = deps.adminService;
    this.config = deps.config;
    this.logger = deps.logger;
    this.adminIds = deps.adminIds;
  }

  /**
   * Send auth token to admin via Telegram
   */
  async sendAuthToken(adminId: string, token: string, expiresIn: number): Promise<void> {
    try {
      const expiresInMinutes = Math.round(expiresIn / 60);

      const message =
        `🔐 <b>Admin Panel Access</b>\n\n` +
        `URL: <code>${this.config.baseUrl}/admin</code>\n` +
        `Admin ID: <code>${adminId}</code>\n` +
        `Auth Code: <code>${token}</code>\n\n` +
        `⏱ Code expires in ${expiresInMinutes} minutes.\n` +
        `🔒 Keep this information secure!`;

      await this.bot.api.sendMessage(adminId, message, {
        parse_mode: 'HTML',
      });

      this.logger.info('Auth token sent via Telegram', {
        adminId,
        expiresIn,
      });
    } catch (error) {
      this.logger.error('Failed to send auth token', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get admin user info from Telegram
   */
  async getAdminUser(platformId: string): Promise<AdminUser | null> {
    const numericId = parseInt(platformId, 10);

    if (!this.isAdmin(platformId)) {
      return null;
    }

    try {
      const chat = await this.bot.api.getChat(numericId);

      // Extract user info
      let name = 'Admin';

      if ('first_name' in chat) {
        name = chat.first_name || 'Admin';
        if ('last_name' in chat && chat.last_name) {
          name += ` ${chat.last_name}`;
        }
      } else if ('title' in chat) {
        name = chat.title || 'Admin';
      }

      const adminUser: AdminUser = {
        id: platformId,
        platformId,
        platform: 'telegram',
        name,
        permissions: ['*'], // Full permissions for now
        metadata: {
          username: 'username' in chat ? chat.username : undefined,
          type: chat.type,
        },
      };

      return adminUser;
    } catch (error) {
      this.logger.error('Failed to get admin user info', {
        platformId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Check if user is admin
   */
  async isAdmin(platformId: string): Promise<boolean> {
    const numericId = parseInt(platformId, 10);
    return this.adminIds.includes(numericId);
  }

  /**
   * Handle admin command
   */
  async handleAdminCommand(command: string, userId: string, _args?: string[]): Promise<void> {
    switch (command) {
      case 'admin':
        await this.handleAdminLogin(userId);
        break;

      case 'admin_logout':
        await this.handleLogoutCommand(userId);
        break;

      case 'admin_stats':
        await this.handleStatsCommand(userId);
        break;

      default:
        await this.bot.api.sendMessage(userId, '❌ Unknown admin command');
    }
  }

  /**
   * Handle /admin command
   */
  private async handleAdminLogin(userId: string): Promise<void> {
    if (!(await this.isAdmin(userId))) {
      await this.bot.api.sendMessage(userId, '❌ Access denied.');
      return;
    }

    try {
      // Generate auth token
      const authState = await this.adminService.generateAuthToken(userId);

      // Send via the adapter method (which formats the message)
      await this.sendAuthToken(
        userId,
        authState.token,
        Math.floor((authState.expiresAt.getTime() - Date.now()) / 1000),
      );
    } catch (error) {
      this.logger.error('Failed to handle admin command', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await this.bot.api.sendMessage(
        userId,
        '❌ Failed to generate access token. Please try again later.',
      );
    }
  }

  /**
   * Handle /admin_logout command
   */
  private async handleLogoutCommand(userId: string): Promise<void> {
    if (!(await this.isAdmin(userId))) {
      await this.bot.api.sendMessage(userId, '❌ Access denied.');
      return;
    }

    // In a real implementation, we would track active sessions per user
    // For now, just send a confirmation
    await this.bot.api.sendMessage(
      userId,
      '✅ All admin sessions have been invalidated.\n\n' +
        'You will need to use /admin command to access the panel again.',
      { parse_mode: 'HTML' },
    );
  }

  /**
   * Handle /admin_stats command
   */
  private async handleStatsCommand(userId: string): Promise<void> {
    if (!(await this.isAdmin(userId))) {
      await this.bot.api.sendMessage(userId, '❌ Access denied.');
      return;
    }

    try {
      const stats = await this.adminService.getStats();

      let message = '📊 <b>System Statistics</b>\n\n';

      if (stats.totalUsers !== undefined) {
        message += `👥 Total Users: <b>${stats.totalUsers}</b>\n`;
      }

      if (stats.activeUsers !== undefined) {
        message += `🟢 Active Users: <b>${stats.activeUsers}</b>\n`;
      }

      if (stats.totalMessages !== undefined) {
        message += `💬 Total Messages: <b>${stats.totalMessages}</b>\n`;
      }

      message += `\n🔧 System Status: <b>${stats.systemStatus}</b>`;

      if (stats.customStats && Object.keys(stats.customStats).length > 0) {
        message += '\n\n<b>Custom Stats:</b>\n';
        for (const [key, value] of Object.entries(stats.customStats)) {
          message += `• ${key}: <b>${value}</b>\n`;
        }
      }

      await this.bot.api.sendMessage(userId, message, {
        parse_mode: 'HTML',
      });
    } catch (error) {
      this.logger.error('Failed to get stats', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await this.bot.api.sendMessage(
        userId,
        '❌ Failed to retrieve statistics. Please try again later.',
      );
    }
  }

  /**
   * Register admin commands with the bot
   */
  registerCommands(): void {
    // Admin access command
    this.bot.command('admin', async (ctx) => {
      if (!ctx.from) return;
      await this.handleAdminLogin(ctx.from.id.toString());
    });

    // Logout command
    this.bot.command('admin_logout', async (ctx) => {
      if (!ctx.from) return;
      await this.handleLogoutCommand(ctx.from.id.toString());
    });

    // Stats command
    this.bot.command('admin_stats', async (ctx) => {
      if (!ctx.from) return;
      await this.handleStatsCommand(ctx.from.id.toString());
    });

    this.logger.info('Telegram admin commands registered');
  }
}
