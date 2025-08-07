/**
 * Factory for creating i18n connectors
 */

import { EventBus } from '../../core/events/event-bus'
import type { I18nConfig, LanguageCode, TranslationDictionary } from '../../core/interfaces/i18n'
import type { Env } from '../../types/env'

import { TelegramMessageFormatter } from './formatters/telegram-formatter'
import { I18nConnector } from './i18n-connector'
import { StaticTranslationProvider } from './providers/static-provider'

export class I18nFactory {
  /**
   * Create i18n connector from environment
   */
  static async createFromEnv(env: Env, eventBus?: EventBus): Promise<I18nConnector> {
    // Determine default language
    const defaultLanguage = env.DEFAULT_LANGUAGE || 'en'
    const fallbackLanguage = env.FALLBACK_LANGUAGE || 'en'

    // Create static provider with existing translations
    const staticProvider = new StaticTranslationProvider()

    // Load existing translations (will be migrated in separate step)
    await this.loadExistingTranslations(staticProvider)

    // Create configuration
    const config: I18nConfig = {
      defaultLanguage: defaultLanguage as LanguageCode,
      fallbackLanguage: fallbackLanguage as LanguageCode,
      defaultNamespace: 'core',
      providers: [staticProvider],
      formatters: [new TelegramMessageFormatter()],
      preloadNamespaces: ['core', 'telegram'],
      preloadLanguages: ['en', 'ru'],
      debug: env.ENVIRONMENT === 'development',
      cache: true,
      cacheTTL: 3600000 // 1 hour
    }

    // Create and initialize connector
    const connector = new I18nConnector()
    await connector.initialize({
      ...config,
      eventBus
    })

    return connector
  }

  /**
   * Load existing translations from JSON files
   */
  private static async loadExistingTranslations(
    provider: StaticTranslationProvider
  ): Promise<void> {
    // In Cloudflare Workers environment, we need to import JSON files directly
    // This is a build-time import, not runtime file system access

    // Core namespace
    const coreEn = await import('../../i18n/namespaces/core/en.json')
    const coreRu = await import('../../i18n/namespaces/core/ru.json')
    provider.addTranslations('en', 'core', (coreEn.default || coreEn) as TranslationDictionary)
    provider.addTranslations('ru', 'core', (coreRu.default || coreRu) as TranslationDictionary)

    // Telegram adapter namespace
    const telegramEn = await import('../../i18n/namespaces/adapters/telegram/en.json')
    const telegramRu = await import('../../i18n/namespaces/adapters/telegram/ru.json')
    provider.addTranslations(
      'en',
      'telegram',
      (telegramEn.default || telegramEn) as TranslationDictionary
    )
    provider.addTranslations(
      'ru',
      'telegram',
      (telegramRu.default || telegramRu) as TranslationDictionary
    )

    // Access domain namespace
    const accessEn = await import('../../i18n/namespaces/domain/access/en.json')
    const accessRu = await import('../../i18n/namespaces/domain/access/ru.json')
    provider.addTranslations(
      'en',
      'access',
      (accessEn.default || accessEn) as TranslationDictionary
    )
    provider.addTranslations(
      'ru',
      'access',
      (accessRu.default || accessRu) as TranslationDictionary
    )
  }
}
