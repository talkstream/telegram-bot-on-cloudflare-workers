/**
 * Base implementation of I18n Connector
 */

import type {
  ConnectorCapabilities,
  ConnectorConfig,
  HealthStatus,
  ValidationResult
} from '../../core/interfaces/connector'
import { ConnectorType } from '../../core/interfaces/connector'
import type {
  I18nConfig,
  I18nConnector as I18nConnectorInterface,
  LanguageChangedEvent,
  LanguageCode,
  MessageFormatter,
  Namespace,
  NamespaceLoadedEvent,
  PluralizationRule,
  TranslationDictionary,
  TranslationKey,
  TranslationMissingEvent,
  TranslationOptions,
  TranslationProvider
} from '../../core/interfaces/i18n'
import { I18nEventType } from '../../core/interfaces/i18n'
import { BaseConnector } from '../base/base-connector'

export class I18nConnector extends BaseConnector implements I18nConnectorInterface {
  id = 'i18n-connector'
  name = 'I18n Connector'
  version = '1.0.0'
  type = ConnectorType.I18N

  private i18nConfig!: I18nConfig
  private currentLanguage!: LanguageCode
  private translations: Map<string, TranslationDictionary> = new Map()
  private providers: Map<string, TranslationProvider> = new Map()
  private formatters: Map<string, MessageFormatter> = new Map()
  private missingTranslationHandlers: Array<
    (key: TranslationKey, language: LanguageCode, namespace: Namespace) => void
  > = []
  private loadedNamespaces: Set<string> = new Set()

  /**
   * Initialize the i18n connector
   */
  protected async doInitialize(config: ConnectorConfig): Promise<void> {
    this.i18nConfig = config as unknown as I18nConfig
    this.currentLanguage = this.i18nConfig.defaultLanguage

    // Register default providers
    if (this.i18nConfig.providers) {
      for (const provider of this.i18nConfig.providers) {
        this.registerProvider(provider)
      }
    }

    // Register default formatters
    if (this.i18nConfig.formatters) {
      for (const formatter of this.i18nConfig.formatters) {
        this.registerFormatter(formatter)
      }
    }

    // Preload namespaces and languages
    if (this.i18nConfig.preloadNamespaces && this.i18nConfig.preloadLanguages) {
      const loadPromises: Promise<void>[] = []

      for (const language of this.i18nConfig.preloadLanguages) {
        for (const namespace of this.i18nConfig.preloadNamespaces) {
          loadPromises.push(this.loadNamespace(namespace, language))
        }
      }

      await Promise.all(loadPromises)
    }
  }

  /**
   * Validate configuration
   */
  protected doValidateConfig(config: ConnectorConfig): ValidationResult['errors'] {
    const errors: ValidationResult['errors'] = []
    const i18nConfig = config as unknown as I18nConfig

    if (!i18nConfig.defaultLanguage) {
      errors.push({
        field: 'defaultLanguage',
        message: 'Default language is required'
      })
    }

    return errors
  }

  /**
   * Check if connector is ready
   */
  protected checkReadiness(): boolean {
    return this.i18nConfig != null && this.currentLanguage != null
  }

  /**
   * Check health status
   */
  protected async checkHealth(): Promise<Partial<HealthStatus>> {
    const loadedLanguages = new Set<LanguageCode>()
    const loadedNamespaceCount = this.loadedNamespaces.size

    // Extract unique languages from loaded translations
    for (const key of this.translations.keys()) {
      const [language] = key.split(':')
      if (language) {
        loadedLanguages.add(language)
      }
    }

    return {
      status: loadedNamespaceCount > 0 ? 'healthy' : 'degraded',
      message: loadedNamespaceCount > 0 ? 'I18n system operational' : 'No translations loaded',
      details: {
        currentLanguage: this.currentLanguage,
        loadedLanguages: Array.from(loadedLanguages),
        loadedNamespaces: Array.from(this.loadedNamespaces),
        providerCount: this.providers.size,
        formatterCount: this.formatters.size
      }
    }
  }

  /**
   * Destroy the connector
   */
  protected async doDestroy(): Promise<void> {
    this.translations.clear()
    this.providers.clear()
    this.formatters.clear()
    this.missingTranslationHandlers = []
    this.loadedNamespaces.clear()
  }

  /**
   * Get connector capabilities
   */
  getCapabilities(): ConnectorCapabilities {
    return {
      features: [
        'translation',
        'pluralization',
        'interpolation',
        'namespaces',
        'lazy-loading',
        'platform-formatting',
        'fallback-language',
        'missing-translation-handling'
      ]
    }
  }

  /**
   * Translate a key with optional parameters
   */
  t(key: TranslationKey, options?: TranslationOptions): string {
    const language = options?.language || this.currentLanguage
    const namespace = options?.namespace || this.i18nConfig.defaultNamespace || 'core'
    const cacheKey = `${language}:${namespace}`

    // Get translations for the namespace
    const translations = this.translations.get(cacheKey)
    if (!translations) {
      return this.handleMissingTranslation(key, language, namespace, options?.defaultValue)
    }

    // Navigate through the key path
    const keyParts = key.split('.')
    let value: unknown = translations

    for (const part of keyParts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part]
      } else {
        return this.handleMissingTranslation(key, language, namespace, options?.defaultValue)
      }
    }

    // Handle translation value
    if (typeof value === 'string') {
      return this.interpolate(value, options?.params || {})
    } else if (typeof value === 'function') {
      return value(options?.params || {})
    } else if (typeof value === 'object' && options?.params?.count !== undefined) {
      // Handle pluralization
      const count = options.params.count as number
      const pluralKey = this.getPluralKey(language, count)

      if (value && typeof value === 'object' && pluralKey in value) {
        const pluralValue = (value as Record<string, unknown>)[pluralKey]
        if (typeof pluralValue === 'string') {
          return this.interpolate(pluralValue, options.params)
        } else if (typeof pluralValue === 'function') {
          return pluralValue(options.params)
        }
      }
    }

    return this.handleMissingTranslation(key, language, namespace, options?.defaultValue)
  }

  /**
   * Set the current language
   */
  async setLanguage(language: LanguageCode): Promise<void> {
    const previousLanguage = this.currentLanguage
    this.currentLanguage = language

    // Emit language changed event
    this.emitEvent(I18nEventType.LANGUAGE_CHANGED, {
      previousLanguage,
      currentLanguage: language
    } as LanguageChangedEvent)
  }

  /**
   * Get the current language
   */
  getLanguage(): LanguageCode {
    return this.currentLanguage
  }

  /**
   * Get all supported languages
   */
  async getSupportedLanguages(): Promise<LanguageCode[]> {
    const languages = new Set<LanguageCode>()

    // Add languages from all providers
    for (const provider of this.providers.values()) {
      const providerLanguages = await provider.getAvailableLanguages()
      for (const lang of providerLanguages) {
        languages.add(lang)
      }
    }

    return Array.from(languages)
  }

  /**
   * Load a namespace
   */
  async loadNamespace(namespace: Namespace, language?: LanguageCode): Promise<void> {
    const targetLanguage = language || this.currentLanguage
    const cacheKey = `${targetLanguage}:${namespace}`

    // Check if already loaded
    if (this.translations.has(cacheKey)) {
      return
    }

    // Try loading from providers
    for (const provider of this.providers.values()) {
      try {
        const translations = await provider.loadTranslations(targetLanguage, namespace)
        if (translations) {
          this.translations.set(cacheKey, translations)
          this.loadedNamespaces.add(namespace)

          // Count translations
          const count = this.countTranslations(translations)

          // Emit namespace loaded event
          this.emitEvent(I18nEventType.NAMESPACE_LOADED, {
            namespace,
            language: targetLanguage,
            translationCount: count
          } as NamespaceLoadedEvent)

          return
        }
      } catch (error) {
        console.error(`Error loading translations from provider ${provider.name}:`, error)
      }
    }

    // If no translations found, set empty dictionary
    this.translations.set(cacheKey, {})
  }

  /**
   * Unload a namespace to free memory
   */
  unloadNamespace(namespace: Namespace, language?: LanguageCode): void {
    if (language) {
      const cacheKey = `${language}:${namespace}`
      this.translations.delete(cacheKey)
    } else {
      // Unload namespace for all languages
      for (const key of this.translations.keys()) {
        if (key.endsWith(`:${namespace}`)) {
          this.translations.delete(key)
        }
      }
    }

    this.loadedNamespaces.delete(namespace)
    this.emitEvent(I18nEventType.NAMESPACE_UNLOADED, { namespace, language })
  }

  /**
   * Check if a translation exists
   */
  hasTranslation(key: TranslationKey, options?: TranslationOptions): boolean {
    const language = options?.language || this.currentLanguage
    const namespace = options?.namespace || this.i18nConfig.defaultNamespace || 'core'
    const cacheKey = `${language}:${namespace}`

    const translations = this.translations.get(cacheKey)
    if (!translations) {
      return false
    }

    // Navigate through the key path
    const keyParts = key.split('.')
    let value: unknown = translations

    for (const part of keyParts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part]
      } else {
        return false
      }
    }

    return true
  }

  /**
   * Get all translations for a namespace
   */
  getTranslations(namespace?: Namespace, language?: LanguageCode): TranslationDictionary {
    const targetLanguage = language || this.currentLanguage
    const targetNamespace = namespace || this.i18nConfig.defaultNamespace || 'core'
    const cacheKey = `${targetLanguage}:${targetNamespace}`

    return this.translations.get(cacheKey) || {}
  }

  /**
   * Format a message for a specific platform
   */
  formatMessage(message: string, platform?: string, options?: Record<string, unknown>): string {
    if (!platform) {
      return message
    }

    const formatter = this.formatters.get(platform)
    if (formatter) {
      return formatter.format(message, options)
    }

    return message
  }

  /**
   * Register a message formatter
   */
  registerFormatter(formatter: MessageFormatter): void {
    this.formatters.set(formatter.platform, formatter)
    this.emitEvent(I18nEventType.FORMATTER_REGISTERED, { formatter: formatter.platform })
  }

  /**
   * Register a translation provider
   */
  registerProvider(provider: TranslationProvider): void {
    this.providers.set(provider.name, provider)
    this.emitEvent(I18nEventType.PROVIDER_REGISTERED, { provider: provider.name })
  }

  /**
   * Add translations dynamically
   */
  addTranslations(
    language: LanguageCode,
    namespace: Namespace,
    translations: TranslationDictionary
  ): void {
    const cacheKey = `${language}:${namespace}`
    const existing = this.translations.get(cacheKey) || {}

    // Deep merge translations
    this.translations.set(cacheKey, this.deepMerge(existing, translations))
    this.loadedNamespaces.add(namespace)
  }

  /**
   * Get pluralization rules for a language
   */
  getPluralizationRules(language: LanguageCode): PluralizationRule[] {
    // Import at runtime to avoid circular dependency
    const rules = require('../../core/interfaces/i18n').STANDARD_PLURALIZATION_RULES
    return rules[language] || rules.en
  }

  /**
   * Handle missing translation
   */
  onMissingTranslation(
    handler: (key: TranslationKey, language: LanguageCode, namespace: Namespace) => void
  ): void {
    this.missingTranslationHandlers.push(handler)
  }

  /**
   * Handle missing translation internally
   */
  private handleMissingTranslation(
    key: TranslationKey,
    language: LanguageCode,
    namespace: Namespace,
    defaultValue?: string
  ): string {
    // Emit missing translation event
    this.emitEvent(I18nEventType.TRANSLATION_MISSING, {
      key,
      language,
      namespace,
      defaultValue
    } as TranslationMissingEvent)

    // Call handlers
    for (const handler of this.missingTranslationHandlers) {
      handler(key, language, namespace)
    }

    // Log in debug mode
    if (this.i18nConfig.debug) {
      console.warn(`Missing translation: ${key} [${language}:${namespace}]`)
    }

    // Try fallback language
    if (this.i18nConfig.fallbackLanguage && language !== this.i18nConfig.fallbackLanguage) {
      return this.t(key, {
        language: this.i18nConfig.fallbackLanguage,
        namespace,
        defaultValue
      })
    }

    // Return default value or key
    return defaultValue || `[${key}]`
  }

  /**
   * Interpolate parameters in a string
   */
  private interpolate(str: string, params: Record<string, unknown>): string {
    return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key]?.toString() || match
    })
  }

  /**
   * Get plural key for a count
   */
  private getPluralKey(language: LanguageCode, count: number): string {
    const rules = this.getPluralizationRules(language)

    for (const rule of rules) {
      if (rule.check(count)) {
        return rule.suffix
      }
    }

    return 'other'
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(
    target: TranslationDictionary,
    source: TranslationDictionary
  ): TranslationDictionary {
    const output = { ...target }

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key]
        const targetValue = output[key]

        if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
          output[key] = this.deepMerge(
            (targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)
              ? targetValue
              : {}) as TranslationDictionary,
            sourceValue as TranslationDictionary
          )
        } else if (sourceValue !== undefined) {
          output[key] = sourceValue
        }
      }
    }

    return output
  }

  /**
   * Count translations in a dictionary
   */
  private countTranslations(dict: TranslationDictionary): number {
    let count = 0

    for (const value of Object.values(dict)) {
      if (typeof value === 'string' || typeof value === 'function') {
        count++
      } else if (typeof value === 'object' && value !== null) {
        count += this.countTranslations(value as TranslationDictionary)
      }
    }

    return count
  }
}
