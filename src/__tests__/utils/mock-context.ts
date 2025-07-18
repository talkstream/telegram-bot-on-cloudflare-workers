import { vi } from 'vitest';
import type { User, Chat, Message, CallbackQuery } from 'grammy/types';

import { createMockEnv } from './mock-env';

import type { BotContext } from '@/types';
import type { Env } from '@/types/env';

export interface MockContextOptions {
  from?: User;
  chat?: Chat;
  message?: Message;
  callbackQuery?: CallbackQuery;
  me?: User;
  env?: Env;
}

export function createMockContext(options: MockContextOptions = {}): BotContext {
  const mockSession = {
    userId: undefined,
    username: undefined,
    languageCode: undefined,
    lastCommand: undefined,
    lastActivity: undefined,
    customData: {},
  };

  // Mock i18n function
  const mockI18n = vi.fn((key: string, ...args: unknown[]) => {
    // Return some default messages for common keys used in tests
    const messages: Record<string, string> = {
      user_identification_error: '❌ Unable to identify user',
      general_error: '❌ An error occurred. Please try again later.',
      access_denied: '⚠️ You do not have access to this bot.',
      access_pending: 'Your access request is pending approval.',
      request_access: 'Request Access',
      cancel_request: 'Cancel Request',
      // Owner command messages
      admin_usage:
        '📋 Admin Management\n\nUsage:\n/admin add <user_id>\n/admin remove <user_id>\n/admin list',
      debug_usage: '🐛 Debug Mode Control\n\nUsage:\n/debug on [level]\n/debug off\n/debug status',
      info_command: '📊 System Information',
      admin_added: '✅ User {userId} is now an admin',
      admin_removed: '✅ User {userId} is no longer an admin',
      admin_already: '❌ User is already an admin',
      admin_not_found: '❌ User is not an admin',
      admin_list: 'Current admins:\n{admins}',
      admin_list_empty: 'No admins configured yet.',
      user_not_found: '❌ User not found',
      owners_are_admins: '❌ Owners already have admin privileges',
      debug_enabled: '🐛 Debug mode enabled (Level {level})',
      debug_disabled: '🐛 Debug mode disabled',
      debug_status: '🐛 Debug mode: {status}',
      debug_invalid_level: '❌ Invalid debug level. Use 1-3 or omit for default (1).',
      debug_status_disabled: 'Status: Disabled',
      debug_status_enabled: 'Status: Enabled\nLevel: {level}',
      debug_enable_error: '❌ Failed to enable debug mode. Please try again.',
      debug_disable_error: '❌ Failed to disable debug mode. Please try again.',
      debug_status_error: '❌ Failed to retrieve debug status. Please try again.',
      owner_only: '❌ This command is only available to bot owners',
      admin_only: '❌ This command is only available to administrators',
      admin_granted_notification: '🎉 You have been granted admin rights',
      admin_revoked_notification: 'Your admin rights have been revoked',
      invalid_user_id: 'Invalid user ID',
      added_date: 'Added',
      admin_add_error: '❌ Failed to add admin',
      admin_remove_error: '❌ Failed to remove admin',
      admin_list_error: '❌ Failed to list admins',
      // Info command messages
      info_command_header: '📊 System Information',
      info_system_status: 'System Status:',
      info_uptime: '• Uptime: {hours}h {minutes}m',
      info_environment: '• Environment: {environment}',
      info_tier: '• Tier: {tier}',
      info_user_statistics: 'User Statistics:',
      info_total_users: '• Total Users: {count}',
      info_active_users: '• Active Users: {count}',
      info_active_sessions: '• Active Sessions: {count}',
      info_access_requests: 'Access Requests:',
      info_pending: '• Pending: {count}',
      info_approved: '• Approved: {count}',
      info_rejected: '• Rejected: {count}',
      info_role_distribution: 'Role Distribution:',
      info_no_roles: '• No roles assigned',
      info_ai_provider: 'AI Provider:',
      info_ai_not_configured: '• Not configured',
      info_ai_status: '• {provider} ({count} providers available)',
      info_total_cost: '• Total Cost: ${cost}',
      info_error: '❌ Failed to retrieve system information',
      // Requests command messages
      no_pending_requests: 'No pending access requests.',
      request_info: 'Name: {name}\nUsername: @{username}\nUser ID: {userId}\nRequested: {date}',
      access_request: 'Access Request',
      request_count: 'Pending requests',
      approve: 'Approve',
      reject: 'Reject',
      next: 'Next',
      requests_error: '❌ Failed to retrieve access requests.',
      // Access callback messages
      access_request_exists: 'You already have a pending access request.',
      access_request_sent: 'Your access request has been sent to the administrators.',
      request_not_found: 'Request not found.',
      request_cancelled: 'Your access request has been cancelled.',
      request_approved: '✅ Access granted to user {userId}',
      access_approved: '🎉 Your access request has been approved! You can now use the bot.',
      request_rejected: '❌ Access denied to user {userId}',
      access_rejected: 'Your access request has been rejected.',
      new_access_request_notification: '🔔 New access request from {userInfo} (ID: {userId})',
      view_requests: 'View Requests',
      // Batch command
      batch_info:
        '🚀 Request Batching Demo\n\nThis bot uses intelligent request batching to optimize API calls.\n\nFeatures:\n• Automatic grouping of similar requests\n• Reduced API calls and costs\n• Improved performance\n• Tier-aware batching (more aggressive on free tier)',
    };

    // Handle template replacements
    let message = messages[key] || key;
    if (args.length > 0 && typeof args[0] === 'object') {
      const replacements = args[0] as Record<string, unknown>;
      for (const [placeholder, value] of Object.entries(replacements)) {
        message = message.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), String(value));
      }
    }

    return message;
  });

  const mockContext = {
    // Basic context properties
    from:
      'from' in options
        ? options.from
        : {
            id: 123456,
            is_bot: false,
            first_name: 'Test',
            username: 'testuser',
          },

    chat: options.chat || {
      id: 123456,
      type: 'private',
    },

    message: options.message || {
      message_id: 1,
      date: Date.now(),
      chat: options.chat || { id: 123456, type: 'private' },
      from: 'from' in options ? options.from : { id: 123456, is_bot: false },
      text: '/start',
    },

    callbackQuery: options.callbackQuery,

    me: options.me || {
      id: 987654,
      is_bot: true,
      first_name: 'Test Bot',
      username: 'testbot',
    },

    // Session
    session: mockSession,

    // Match for command arguments
    match: '',

    // Methods
    reply: vi.fn().mockResolvedValue({ ok: true }),
    replyWithInvoice: vi.fn().mockResolvedValue({ ok: true }),
    editMessageText: vi.fn().mockResolvedValue({ ok: true }),
    answerCallbackQuery: vi.fn().mockResolvedValue({ ok: true }),

    // Request object
    req: {
      param: vi.fn(),
      header: vi.fn(),
      query: vi.fn(),
      json: vi.fn(),
    },

    // Response helpers
    text: vi.fn(),
    json: vi.fn(),
    header: vi.fn(),

    // Environment
    env: options.env || createMockEnv(),

    // i18n
    i18n: mockI18n,

    // API
    api: {
      setMyCommands: vi.fn().mockResolvedValue({ ok: true }),
      getMyCommands: vi.fn().mockResolvedValue([
        { command: 'start', description: 'Start the bot' },
        { command: 'help', description: 'Show help' },
        { command: 'profile', description: 'View profile' },
        { command: 'settings', description: 'Bot settings' },
        { command: 'balance', description: 'Check balance' },
      ]),
      sendMessage: vi.fn().mockResolvedValue({ ok: true }),
      sendInvoice: vi.fn().mockResolvedValue({ ok: true }),
    },

    // Response
    res: {
      status: 200,
    },

    // Services
    services: {
      ai: null,
    },
  } as unknown as BotContext;

  return mockContext;
}

export function createMockCallbackContext(
  data: string,
  options: MockContextOptions = {},
): BotContext {
  return createMockContext({
    ...options,
    callbackQuery: {
      id: '123456789',
      from: options.from || {
        id: 123456,
        is_bot: false,
        first_name: 'Test',
        username: 'testuser',
      },
      data,
      message: options.message || {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123456, type: 'private' as const, first_name: 'Test' },
      },
      chat_instance: '1234567890',
    },
  });
}
