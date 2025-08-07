import type { CallbackQuery, Chat, Message, User } from 'grammy/types'
import { vi } from 'vitest'

import { createMockEnv } from './mock-env'

import type { BotContext } from '@/types'
import type { Env } from '@/types/env'

export interface MockContextOptions {
  from?: User
  chat?: Chat
  message?: Message
  callbackQuery?: CallbackQuery
  me?: User
  env?: Env
}

export function createMockContext(options: MockContextOptions = {}): BotContext {
  const mockSession = {
    userId: undefined,
    username: undefined,
    languageCode: undefined,
    lastCommand: undefined,
    lastActivity: undefined,
    customData: {}
  }

  // Mock i18n object with new interface
  const mockI18n = {
    t: vi.fn((key: string, options?: { namespace?: string; params?: Record<string, unknown> }) => {
      // Handle different namespaces
      if (options?.namespace === 'access') {
        // Access namespace keys
        const accessMessages: Record<string, string> = {
          'buttons.view_next': 'Next Request',
          'request.approved': '✅ Access granted to user {userId} (@{username})',
          'request.rejected': '❌ Access denied to user {userId} (@{username})',
          'request.no_pending': 'No pending access requests.',
          'messages.no_username': 'No username',
          'messages.user_identification_error': '❌ Unable to identify user',
          'messages.general_error': '❌ An error occurred. Please try again later.',
          'notifications.granted':
            '🎉 Your access request has been approved! You can now use the bot.',
          'buttons.request_access': 'Request Access',
          'buttons.cancel_request': 'Cancel Request',
          'request.pending': 'Your access request is pending approval.',
          'request.exists': 'You already have a pending access request.',
          'request.sent': 'Your access request has been sent to the administrators.',
          'request.not_found': 'Request not found.',
          'request.cancelled': 'Your access request has been cancelled.',
          'buttons.approve': 'Approve',
          'buttons.reject': 'Reject',
          'buttons.view_requests': 'View Requests',
          'request.details':
            '📋 <b>Access Request #{id}</b>\n\nName: {firstName}\nUsername: @{username}\nUser ID: {userId}\nRequested: {date}',
          'messages.user_not_found':
            '❌ User not found. They must have used the bot at least once.',
          'messages.invalid_user_id':
            '❌ Please provide a valid user ID or forward a message from the user.',
          'messages.added_date': 'Added',
          'notifications.denied': 'Your access request has been rejected.',
          'messages.request_count': 'Pending requests',
          'messages.next': 'Next',
          'messages.owner_only': 'This command is only available to bot owners.',
          'messages.admin_only': 'This command is only available to administrators.',
          'messages.access_only': 'You do not have access to this bot.',
          'messages.unauthorized': 'You do not have access to this bot.',
          'messages.use_start_to_request': 'Use /start to request access.'
        }
        if (key in accessMessages) {
          let message = accessMessages[key]
          if (message && options?.params) {
            for (const [placeholder, value] of Object.entries(options.params)) {
              message = message.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), String(value))
            }
          }
          return message || key
        }
      }

      // Return some default messages for common keys used in tests
      const messages: Record<string, string> = {
        // Messages namespace
        'messages.user_identification_error': '❌ Unable to identify user',
        'messages.general_error': '❌ An error occurred. Please try again later.',

        // Telegram namespace - commands
        'commands.admin.usage':
          '📋 Admin Management\n\nUsage:\n/admin add <user_id>\n/admin remove <user_id>\n/admin list',
        'commands.admin.added': '✅ User {userId} is now an admin',
        'commands.admin.removed': '✅ User {userId} is no longer an admin',
        'commands.admin.already': '❌ User is already an admin',
        'commands.admin.not_found': '❌ User is not an admin',
        'commands.admin.list': 'Current admins:\n{admins}',
        'commands.admin.list_empty': 'No admins configured yet.',
        'commands.admin.user_not_found': '❌ User not found',
        'commands.admin.owners_are_admins': '❌ Owners already have admin privileges',
        'commands.admin.granted_notification': '🎉 You have been granted admin rights',
        'commands.admin.revoked_notification': 'Your admin rights have been revoked',
        'commands.admin.invalid_user_id': 'Invalid user ID',
        'commands.admin.added_date': 'Added',
        'commands.admin.add_error': '❌ Failed to add admin',
        'commands.admin.remove_error': '❌ Failed to remove admin',
        'commands.admin.list_error': '❌ Failed to list admins',

        'commands.debug.usage':
          '🐛 Debug Mode Control\n\nUsage:\n/debug on [level]\n/debug off\n/debug status',
        'commands.debug.enabled': '🐛 Debug mode enabled (Level {level})',
        'commands.debug.disabled': '🐛 Debug mode disabled',
        'commands.debug.status': '🐛 Debug mode: {status}',
        'commands.debug.invalid_level': '❌ Invalid debug level. Use 1-3 or omit for default (1).',
        'commands.debug.status_disabled': 'Status: Disabled',
        'commands.debug.status_enabled': 'Status: Enabled\nLevel: {level}',
        'commands.debug.enable_error': '❌ Failed to enable debug mode. Please try again.',
        'commands.debug.disable_error': '❌ Failed to disable debug mode. Please try again.',
        'commands.debug.status_error': '❌ Failed to retrieve debug status. Please try again.',

        'commands.info.header': '📊 System Information',
        'commands.info.system_status': 'System Status:',
        'commands.info.uptime': '• Uptime: {hours}h {minutes}m',
        'commands.info.environment': '• Environment: {environment}',
        'commands.info.tier': '• Tier: {tier}',
        'commands.info.user_statistics': 'User Statistics:',
        'commands.info.total_users': '• Total Users: {count}',
        'commands.info.active_users': '• Active Users: {count}',
        'commands.info.active_sessions': '• Active Sessions: {count}',
        'commands.info.access_requests': 'Access Requests:',
        'commands.info.pending': '• Pending: {count}',
        'commands.info.approved': '• Approved: {count}',
        'commands.info.rejected': '• Rejected: {count}',
        'commands.info.role_distribution': 'Role Distribution:',
        'commands.info.no_roles': '• No roles assigned',
        'commands.info.ai_provider': 'AI Provider:',
        'commands.info.ai_not_configured': '• Not configured',
        'commands.info.ai_status': '• {provider} ({count} providers available)',
        'commands.info.total_cost': '• Total Cost: ${cost}',
        'commands.info.error': '❌ Failed to retrieve system information',

        'commands.requests.no_pending': 'No pending access requests.',
        'commands.requests.info':
          'Name: {name}\nUsername: @{username}\nUser ID: {userId}\nRequested: {date}',
        'commands.requests.header': 'Access Request',
        'commands.requests.count': 'Pending requests',
        'commands.requests.error': '❌ Failed to retrieve access requests.',
        'commands.requests.approve': 'Approve',
        'commands.requests.reject': 'Reject',

        'commands.batch.info':
          '🚀 Request Batching Demo\n\nThis bot uses intelligent request batching to optimize API calls.\n\nFeatures:\n• Automatic grouping of similar requests\n• Reduced API calls and costs\n• Improved performance\n• Tier-aware batching (more aggressive on free tier)',

        // Telegram namespace - auth
        'auth.access_denied': '⚠️ You do not have access to this bot.',
        'auth.owner_only': '❌ This command is only available to bot owners',
        'auth.admin_only': '❌ This command is only available to administrators',

        // Telegram namespace - buttons
        'buttons.approve': 'Approve',
        'buttons.reject': 'Reject',
        'buttons.next': 'Next',
        'buttons.request_access': 'Request Access',
        'buttons.cancel_request': 'Cancel Request',
        'buttons.view_requests': 'View Requests',
        'buttons.view_next': 'Next Request',
        'buttons.review_request': 'Review Request',

        // Telegram namespace - request status
        'request.pending': 'Your access request is pending approval.',
        'request.exists': 'You already have a pending access request.',
        'request.sent': 'Your access request has been sent to the administrators.',
        'request.not_found': 'Request not found.',
        'request.cancelled': 'Your access request has been cancelled.',
        'request.approved': '✅ Access granted to user {userId}',
        'request.approved_full': '✅ Access granted to user {userId} (@{username})',
        'request.rejected': '❌ Access denied to user {userId}',
        'request.rejected_full': '❌ Access denied to user {userId} (@{username})',
        'request.details':
          '📋 <b>Access Request #{id}</b>\n\nName: {firstName}\nUsername: @{username}\nUser ID: {userId}\nRequested: {date}',

        // Telegram namespace - notifications
        'notification.access_approved':
          '🎉 Your access request has been approved! You can now use the bot.',
        'notification.access_rejected': 'Your access request has been rejected.',
        'notification.new_request':
          '🔔 New access request from {firstName} (@{username}, ID: {userId})',
        'notification.access_cancelled': 'Your access request has been cancelled.',

        // Telegram namespace - general
        'general.no_username': 'No username',

        // Add missing keys that tests expect
        'messages.user_not_found': '❌ User not found',
        'messages.added_date': 'Added',
        'request.no_pending': 'No pending access requests.',
        'status.denied': '⚠️ You do not have access to this bot.',
        'status.pending': 'Your access request is pending approval.',
        'system.errors.general': '❌ An error occurred. Please try again later.',

        // AI namespace
        'ai.general.not_configured': 'AI service is not configured',
        'ai.general.not_available_free_tier': 'AI service is not available on free tier',
        'ai.general.prompt_needed': 'Please provide a prompt',
        'ai.general.powered_by': 'Powered by {provider}',
        'ai.general.error': 'Error processing AI request'
      }

      // Handle template replacements
      let message = messages[key] || key
      if (options?.params) {
        for (const [placeholder, value] of Object.entries(options.params)) {
          message = message.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), String(value))
        }
      }

      return message
    }),
    setLanguage: vi.fn().mockResolvedValue(undefined),
    getLanguage: vi.fn().mockReturnValue('en'),
    getSupportedLanguages: vi.fn().mockResolvedValue(['en', 'ru']),
    hasTranslation: vi.fn().mockReturnValue(true),
    loadNamespace: vi.fn().mockResolvedValue(undefined),
    unloadNamespace: vi.fn(),
    getTranslations: vi.fn().mockReturnValue({}),
    formatMessage: vi.fn((message: string) => message),
    onMissingTranslation: vi.fn()
  }

  const mockContext = {
    // Basic context properties
    from:
      'from' in options
        ? options.from
        : {
            id: 123456,
            is_bot: false,
            first_name: 'Test',
            username: 'testuser'
          },

    chat: options.chat || {
      id: 123456,
      type: 'private'
    },

    message: options.message || {
      message_id: 1,
      date: Date.now(),
      chat: options.chat || { id: 123456, type: 'private' },
      from: 'from' in options ? options.from : { id: 123456, is_bot: false },
      text: '/start'
    },

    callbackQuery: options.callbackQuery,

    me: options.me || {
      id: 987654,
      is_bot: true,
      first_name: 'Test Bot',
      username: 'testbot'
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
      json: vi.fn()
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
        { command: 'balance', description: 'Check balance' }
      ]),
      sendMessage: vi.fn().mockResolvedValue({ ok: true }),
      sendInvoice: vi.fn().mockResolvedValue({ ok: true })
    },

    // Response
    res: {
      status: 200
    },

    // Services
    services: {
      ai: null
    }
  } as unknown as BotContext

  return mockContext
}

export function createMockCallbackContext(
  data: string,
  options: MockContextOptions = {}
): BotContext {
  return createMockContext({
    ...options,
    callbackQuery: {
      id: '123456789',
      from: options.from || {
        id: 123456,
        is_bot: false,
        first_name: 'Test',
        username: 'testuser'
      },
      data,
      message: options.message || {
        message_id: 1,
        date: Date.now(),
        chat: { id: 123456, type: 'private' as const, first_name: 'Test' }
      },
      chat_instance: '1234567890'
    }
  })
}
