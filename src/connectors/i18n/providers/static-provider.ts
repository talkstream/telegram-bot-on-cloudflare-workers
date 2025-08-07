/**
 * Static translation provider that loads translations from memory
 * This is used for migrating existing translations from lib/i18n.ts
 */

import type {
  LanguageCode,
  Namespace,
  TranslationDictionary,
  TranslationProvider
} from '../../../core/interfaces/i18n'

export class StaticTranslationProvider implements TranslationProvider {
  name = 'static-provider'

  private translations: Map<string, TranslationDictionary> = new Map()
  private languages: Set<LanguageCode> = new Set()
  private namespaces: Set<Namespace> = new Set()

  /**
   * Add static translations
   */
  addTranslations(
    language: LanguageCode,
    namespace: Namespace,
    translations: TranslationDictionary
  ): void {
    const key = `${language}:${namespace}`
    this.translations.set(key, translations)
    this.languages.add(language)
    this.namespaces.add(namespace)
  }

  /**
   * Load translations for a language and namespace
   */
  async loadTranslations(
    language: LanguageCode,
    namespace: Namespace
  ): Promise<TranslationDictionary | null> {
    const key = `${language}:${namespace}`
    return this.translations.get(key) || null
  }

  /**
   * Check if translations exist
   */
  async hasTranslations(language: LanguageCode, namespace: Namespace): Promise<boolean> {
    const key = `${language}:${namespace}`
    return this.translations.has(key)
  }

  /**
   * Get available languages
   */
  async getAvailableLanguages(): Promise<LanguageCode[]> {
    return Array.from(this.languages)
  }

  /**
   * Get available namespaces
   */
  async getAvailableNamespaces(): Promise<Namespace[]> {
    return Array.from(this.namespaces)
  }

  /**
   * Clear all translations
   */
  clear(): void {
    this.translations.clear()
    this.languages.clear()
    this.namespaces.clear()
  }

  /**
   * Get translation count
   */
  getTranslationCount(): number {
    return this.translations.size
  }
}
