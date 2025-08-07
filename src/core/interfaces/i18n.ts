/**
 * Internationalization (i18n) interfaces for multi-language support
 */

import type { Connector } from './connector'

/**
 * Language code following ISO 639-1 standard (e.g., 'en', 'ru', 'es')
 */
export type LanguageCode = string

/**
 * Translation key path (e.g., 'commands.start.description')
 */
export type TranslationKey = string

/**
 * Namespace for organizing translations (e.g., 'core', 'telegram', 'payments')
 */
export type Namespace = string

/**
 * Translation parameters for interpolation
 */
export type TranslationParams = Record<string, string | number | boolean>

/**
 * Translation value can be a string or a function for complex translations
 */
export type TranslationValue = string | ((params: TranslationParams) => string)

/**
 * Translation dictionary structure
 */
export interface TranslationDictionary {
  [key: string]: TranslationValue | TranslationDictionary
}

/**
 * Language pack containing translations for a specific language
 */
export interface LanguagePack {
  code: LanguageCode
  name: string
  nativeName: string
  translations: Record<Namespace, TranslationDictionary>
}

/**
 * Options for translation function
 */
export interface TranslationOptions {
  /**
   * Language to use (defaults to current language)
   */
  language?: LanguageCode

  /**
   * Namespace to look in (defaults to 'core')
   */
  namespace?: Namespace

  /**
   * Default value if translation is missing
   */
  defaultValue?: string

  /**
   * Parameters for interpolation
   */
  params?: TranslationParams

  /**
   * Platform-specific formatting
   */
  platform?: string
}

/**
 * Pluralization rules for a language
 */
export interface PluralizationRule {
  /**
   * Check if this rule applies to the given count
   */
  check(count: number): boolean

  /**
   * Key suffix for this rule (e.g., 'zero', 'one', 'few', 'many', 'other')
   */
  suffix: string
}

/**
 * Platform-specific message formatter
 */
export interface MessageFormatter {
  /**
   * Format a message for the specific platform
   */
  format(message: string, options?: Record<string, unknown>): string

  /**
   * Platform identifier
   */
  platform: string
}

/**
 * Translation provider interface for loading translations
 */
export interface TranslationProvider {
  /**
   * Provider name
   */
  name: string

  /**
   * Load translations for a language and namespace
   */
  loadTranslations(
    language: LanguageCode,
    namespace: Namespace
  ): Promise<TranslationDictionary | null>

  /**
   * Check if translations exist for a language and namespace
   */
  hasTranslations(language: LanguageCode, namespace: Namespace): Promise<boolean>

  /**
   * List available languages
   */
  getAvailableLanguages(): Promise<LanguageCode[]>

  /**
   * List available namespaces
   */
  getAvailableNamespaces(): Promise<Namespace[]>

  /**
   * Save translations (optional, for dynamic providers)
   */
  saveTranslations?(
    language: LanguageCode,
    namespace: Namespace,
    translations: TranslationDictionary
  ): Promise<void>
}

/**
 * Main i18n connector interface
 */
export interface I18nConnector extends Connector {
  /**
   * Translate a key with optional parameters
   */
  t(key: TranslationKey, options?: TranslationOptions): string

  /**
   * Set the current language
   */
  setLanguage(language: LanguageCode): Promise<void>

  /**
   * Get the current language
   */
  getLanguage(): LanguageCode

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): Promise<LanguageCode[]>

  /**
   * Load a namespace
   */
  loadNamespace(namespace: Namespace, language?: LanguageCode): Promise<void>

  /**
   * Unload a namespace to free memory
   */
  unloadNamespace(namespace: Namespace, language?: LanguageCode): void

  /**
   * Check if a translation exists
   */
  hasTranslation(key: TranslationKey, options?: TranslationOptions): boolean

  /**
   * Get all translations for a namespace
   */
  getTranslations(namespace?: Namespace, language?: LanguageCode): TranslationDictionary

  /**
   * Format a message for a specific platform
   */
  formatMessage(message: string, platform?: string, options?: Record<string, unknown>): string

  /**
   * Register a message formatter
   */
  registerFormatter(formatter: MessageFormatter): void

  /**
   * Register a translation provider
   */
  registerProvider(provider: TranslationProvider): void

  /**
   * Add translations dynamically
   */
  addTranslations(
    language: LanguageCode,
    namespace: Namespace,
    translations: TranslationDictionary
  ): void

  /**
   * Get pluralization rule for a language
   */
  getPluralizationRules(language: LanguageCode): PluralizationRule[]

  /**
   * Handle missing translation
   */
  onMissingTranslation(
    handler: (key: TranslationKey, language: LanguageCode, namespace: Namespace) => void
  ): void
}

/**
 * Configuration for i18n connector
 */
export interface I18nConfig {
  /**
   * Default language
   */
  defaultLanguage: LanguageCode

  /**
   * Fallback language when translation is missing
   */
  fallbackLanguage?: LanguageCode

  /**
   * Default namespace
   */
  defaultNamespace?: Namespace

  /**
   * Translation providers
   */
  providers?: TranslationProvider[]

  /**
   * Message formatters
   */
  formatters?: MessageFormatter[]

  /**
   * Preload these namespaces on initialization
   */
  preloadNamespaces?: Namespace[]

  /**
   * Preload these languages on initialization
   */
  preloadLanguages?: LanguageCode[]

  /**
   * Enable debug mode (log missing translations)
   */
  debug?: boolean

  /**
   * Cache translations in memory
   */
  cache?: boolean

  /**
   * Cache TTL in milliseconds
   */
  cacheTTL?: number
}

/**
 * Event types for i18n system
 */
export enum I18nEventType {
  LANGUAGE_CHANGED = 'i18n:language:changed',
  NAMESPACE_LOADED = 'i18n:namespace:loaded',
  NAMESPACE_UNLOADED = 'i18n:namespace:unloaded',
  TRANSLATION_MISSING = 'i18n:translation:missing',
  PROVIDER_REGISTERED = 'i18n:provider:registered',
  FORMATTER_REGISTERED = 'i18n:formatter:registered'
}

/**
 * Language changed event payload
 */
export interface LanguageChangedEvent {
  previousLanguage: LanguageCode
  currentLanguage: LanguageCode
}

/**
 * Namespace loaded event payload
 */
export interface NamespaceLoadedEvent {
  namespace: Namespace
  language: LanguageCode
  translationCount: number
}

/**
 * Translation missing event payload
 */
export interface TranslationMissingEvent {
  key: TranslationKey
  language: LanguageCode
  namespace: Namespace
  defaultValue?: string
}

/**
 * Helper type for typed translation keys
 * Usage: TranslationKeys<typeof translations>
 */
export type TranslationKeys<T> = T extends TranslationDictionary
  ? {
      [K in keyof T]: T[K] extends TranslationDictionary
        ? `${K & string}.${TranslationKeys<T[K]> & string}`
        : K
    }[keyof T]
  : never

/**
 * Standard pluralization rules for common languages
 */
export const STANDARD_PLURALIZATION_RULES: Record<string, PluralizationRule[]> = {
  en: [
    { check: n => n === 0, suffix: 'zero' },
    { check: n => n === 1, suffix: 'one' },
    { check: () => true, suffix: 'other' }
  ],
  ru: [
    { check: n => n === 0, suffix: 'zero' },
    { check: n => n % 10 === 1 && n % 100 !== 11, suffix: 'one' },
    {
      check: n => [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100),
      suffix: 'few'
    },
    { check: () => true, suffix: 'many' }
  ]
}
