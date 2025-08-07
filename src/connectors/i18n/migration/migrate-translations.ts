/**
 * Migration utility to convert old i18n structure to new namespace-based structure
 * This is a one-time migration script
 */

import * as fs from 'fs/promises'
import * as path from 'path'

import type { TranslationDictionary } from '../../../core/interfaces/i18n'
import { StaticTranslationProvider } from '../providers/static-provider'

export class TranslationMigrator {
  private namespaceRoot = path.join(process.cwd(), 'src/i18n/namespaces')

  /**
   * Load translations from JSON files and add to provider
   */
  async loadTranslationsFromFiles(provider: StaticTranslationProvider): Promise<void> {
    const namespaces = ['core', 'adapters/telegram', 'domain/access']

    for (const namespace of namespaces) {
      const namespacePath = path.join(this.namespaceRoot, namespace)

      try {
        const files = await fs.readdir(namespacePath)

        for (const file of files) {
          if (file.endsWith('.json')) {
            const language = file.replace('.json', '')
            const filePath = path.join(namespacePath, file)
            const content = await fs.readFile(filePath, 'utf-8')
            const translations = JSON.parse(content) as TranslationDictionary

            // Normalize namespace name (remove adapters/ prefix)
            const normalizedNamespace = namespace.replace('adapters/', '')

            provider.addTranslations(language, normalizedNamespace, translations)
            console.info(`Loaded ${language} translations for namespace ${normalizedNamespace}`)
          }
        }
      } catch (error) {
        console.error(`Error loading translations for namespace ${namespace}:`, error)
      }
    }
  }

  /**
   * Create a helper function to access nested translation keys
   */
  static createTranslationHelper(provider: StaticTranslationProvider) {
    return {
      /**
       * Get translation with old key mapping
       */
      getMessage: async (lang: string, key: string, ...args: unknown[]): Promise<string> => {
        // Map old keys to new structure
        const keyMap: Record<string, { namespace: string; newKey: string }> = {
          // Core
          health_ok: { namespace: 'core', newKey: 'system.health.ok' },
          health_degraded: { namespace: 'core', newKey: 'system.health.degraded' },
          health_error: { namespace: 'core', newKey: 'system.health.error' },
          health_not_configured: { namespace: 'core', newKey: 'system.health.not_configured' },
          general_error: { namespace: 'core', newKey: 'system.errors.general' },
          user_identification_error: {
            namespace: 'core',
            newKey: 'system.errors.user_identification'
          },

          // Telegram
          welcome: { namespace: 'telegram', newKey: 'welcome' },
          welcome_session: { namespace: 'telegram', newKey: 'welcome_session' },
          got_message: { namespace: 'telegram', newKey: 'messages.got_message' },
          got_message_session: { namespace: 'telegram', newKey: 'messages.got_message_session' },
          no_session: { namespace: 'telegram', newKey: 'messages.no_session' },

          // Help
          help_user: { namespace: 'telegram', newKey: 'commands.help.user' },
          help_admin: { namespace: 'telegram', newKey: 'commands.help.admin' },
          help_owner: { namespace: 'telegram', newKey: 'commands.help.owner' },

          // Info command
          info_command_header: { namespace: 'telegram', newKey: 'commands.info.header' },
          info_system_status: { namespace: 'telegram', newKey: 'commands.info.system_status' },
          info_uptime: { namespace: 'telegram', newKey: 'commands.info.uptime' },
          info_environment: { namespace: 'telegram', newKey: 'commands.info.environment' },
          info_tier: { namespace: 'telegram', newKey: 'commands.info.tier' },

          // Access control
          access_denied: { namespace: 'access', newKey: 'status.denied' },
          access_pending: { namespace: 'access', newKey: 'status.pending' },
          access_approved: { namespace: 'access', newKey: 'status.approved' },
          access_rejected: { namespace: 'access', newKey: 'status.rejected' },
          access_request_sent: { namespace: 'access', newKey: 'request.sent' },
          request_access: { namespace: 'access', newKey: 'buttons.request_access' },
          cancel_request: { namespace: 'access', newKey: 'buttons.cancel_request' },
          owner_only: { namespace: 'access', newKey: 'messages.owner_only' },
          admin_only: { namespace: 'access', newKey: 'messages.admin_only' },

          // Admin commands
          admin_added: { namespace: 'telegram', newKey: 'commands.admin.added' },
          admin_removed: { namespace: 'telegram', newKey: 'commands.admin.removed' },
          admin_already: { namespace: 'telegram', newKey: 'commands.admin.already' },
          admin_not_found: { namespace: 'telegram', newKey: 'commands.admin.not_found' },
          admin_list: { namespace: 'telegram', newKey: 'commands.admin.list' },
          admin_list_empty: { namespace: 'telegram', newKey: 'commands.admin.list_empty' },
          admin_usage: { namespace: 'telegram', newKey: 'commands.admin.usage' },

          // Debug commands
          debug_enabled: { namespace: 'telegram', newKey: 'commands.debug.enabled' },
          debug_disabled: { namespace: 'telegram', newKey: 'commands.debug.disabled' },
          debug_status: { namespace: 'telegram', newKey: 'commands.debug.status' },
          debug_usage: { namespace: 'telegram', newKey: 'commands.debug.usage' },

          // AI
          gemini_prompt_needed: { namespace: 'telegram', newKey: 'ai.gemini.prompt_needed' },
          gemini_thinking: { namespace: 'telegram', newKey: 'ai.gemini.thinking' },
          gemini_error: { namespace: 'telegram', newKey: 'ai.gemini.error' },
          gemini_not_available: { namespace: 'telegram', newKey: 'ai.gemini.not_available' },
          ai_not_configured: { namespace: 'telegram', newKey: 'ai.general.not_configured' },
          ai_not_available_free_tier: {
            namespace: 'telegram',
            newKey: 'ai.general.not_available_free_tier'
          },
          ask_prompt_needed: { namespace: 'telegram', newKey: 'ai.general.prompt_needed' },
          powered_by: { namespace: 'telegram', newKey: 'ai.general.powered_by' },
          ai_error: { namespace: 'telegram', newKey: 'ai.general.error' },

          // Batch
          batch_info: { namespace: 'telegram', newKey: 'commands.batch.info' }
        }

        const mapping = keyMap[key]
        if (!mapping) {
          console.warn(`No mapping found for key: ${key}`)
          return `[${key}]`
        }

        const translations = await provider.loadTranslations(lang, mapping.namespace)
        if (!translations) {
          return `[${key}]`
        }

        // Navigate to the translation value
        const keys = mapping.newKey.split('.')
        let value: unknown = translations

        for (const k of keys) {
          if (value && typeof value === 'object' && k in value) {
            value = (value as Record<string, unknown>)[k]
          } else {
            return `[${key}]`
          }
        }

        // Handle function values
        if (typeof value === 'function') {
          return value(...args)
        }

        // Handle string values with interpolation
        if (typeof value === 'string' && args.length > 0 && typeof args[0] === 'object') {
          const params = args[0] as Record<string, unknown>
          return value.replace(/\{\{(\w+)\}\}/g, (match, k) => {
            return params[k]?.toString() || match
          })
        }

        return value?.toString() || `[${key}]`
      }
    }
  }
}
