/**
 * KV-based translation provider for Cloudflare Workers
 * Loads translations from KV storage
 */

import type {
  LanguageCode,
  Namespace,
  TranslationDictionary,
  TranslationProvider
} from '../../../core/interfaces/i18n'
import type { IKeyValueStore } from '../../../core/interfaces/storage'

export class KVTranslationProvider implements TranslationProvider {
  name = 'kv-provider'

  constructor(
    private kvStore: IKeyValueStore,
    private prefix: string = 'i18n'
  ) {}

  /**
   * Generate KV key for translations
   */
  private getKey(language: LanguageCode, namespace: Namespace): string {
    return `${this.prefix}:${language}:${namespace}`
  }

  /**
   * Load translations for a language and namespace
   */
  async loadTranslations(
    language: LanguageCode,
    namespace: Namespace
  ): Promise<TranslationDictionary | null> {
    try {
      const key = this.getKey(language, namespace)
      const data = await this.kvStore.get<string>(key)

      if (!data) {
        return null
      }

      // Parse JSON translations
      return JSON.parse(data) as TranslationDictionary
    } catch (error) {
      console.error(`Error loading translations from KV for ${language}:${namespace}:`, error)
      return null
    }
  }

  /**
   * Check if translations exist
   */
  async hasTranslations(language: LanguageCode, namespace: Namespace): Promise<boolean> {
    const key = this.getKey(language, namespace)
    const data = await this.kvStore.get(key)
    return data !== null
  }

  /**
   * Get available languages
   */
  async getAvailableLanguages(): Promise<LanguageCode[]> {
    const languages = new Set<LanguageCode>()

    try {
      // List all i18n keys
      const result = await this.kvStore.list({
        prefix: `${this.prefix}:`,
        limit: 1000
      })

      // Extract languages from keys
      for (const { name } of result.keys) {
        const parts = name.split(':')
        if (parts.length >= 3 && parts[1]) {
          languages.add(parts[1])
        }
      }
    } catch (error) {
      console.error('Error listing languages from KV:', error)
    }

    return Array.from(languages)
  }

  /**
   * Get available namespaces
   */
  async getAvailableNamespaces(): Promise<Namespace[]> {
    const namespaces = new Set<Namespace>()

    try {
      // List all i18n keys
      const result = await this.kvStore.list({
        prefix: `${this.prefix}:`,
        limit: 1000
      })

      // Extract namespaces from keys
      for (const { name } of result.keys) {
        const parts = name.split(':')
        if (parts.length >= 3 && parts[2]) {
          namespaces.add(parts[2])
        }
      }
    } catch (error) {
      console.error('Error listing namespaces from KV:', error)
    }

    return Array.from(namespaces)
  }

  /**
   * Save translations to KV
   */
  async saveTranslations(
    language: LanguageCode,
    namespace: Namespace,
    translations: TranslationDictionary
  ): Promise<void> {
    try {
      const key = this.getKey(language, namespace)
      const data = JSON.stringify(translations)

      await this.kvStore.put(key, data, {
        metadata: {
          language,
          namespace,
          updatedAt: new Date().toISOString(),
          version: '1.0.0'
        }
      })
    } catch (error) {
      console.error(`Error saving translations to KV for ${language}:${namespace}:`, error)
      throw error
    }
  }

  /**
   * Delete translations from KV
   */
  async deleteTranslations(language: LanguageCode, namespace: Namespace): Promise<void> {
    try {
      const key = this.getKey(language, namespace)
      await this.kvStore.delete(key)
    } catch (error) {
      console.error(`Error deleting translations from KV for ${language}:${namespace}:`, error)
      throw error
    }
  }

  /**
   * Get metadata for translations
   */
  async getMetadata(
    language: LanguageCode,
    namespace: Namespace
  ): Promise<Record<string, unknown> | null> {
    try {
      const key = this.getKey(language, namespace)
      const result = await this.kvStore.getWithMetadata<string>(key)
      return result.metadata
    } catch (error) {
      console.error(`Error getting metadata from KV for ${language}:${namespace}:`, error)
      return null
    }
  }
}
