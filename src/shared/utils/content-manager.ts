import { logger } from '@/lib/logger'

export interface ContentItem {
  id: string
  content: string
  metadata?: Record<string, unknown>
}

export interface LocalizedContent {
  [locale: string]: string | ContentItem
}

export class ContentManager {
  private readonly content: Map<string, LocalizedContent> = new Map()
  private defaultLocale = 'en'

  /**
   * Load content from a structured object
   */
  loadContent(data: Record<string, LocalizedContent>): void {
    Object.entries(data).forEach(([key, value]) => {
      this.content.set(key, value)
    })

    logger.info('Content loaded', { keys: Object.keys(data).length })
  }

  /**
   * Get content by key and locale
   */
  get(key: string, locale?: string): string | null {
    const content = this.content.get(key)

    if (!content) {
      logger.warn('Content key not found', { key })
      return null
    }

    const selectedLocale = locale || this.defaultLocale
    const localizedContent = content[selectedLocale] || content[this.defaultLocale]

    if (!localizedContent) {
      logger.warn('Content not found for locale', {
        key,
        locale: selectedLocale
      })
      return null
    }

    if (typeof localizedContent === 'string') {
      return localizedContent
    }

    return localizedContent.content
  }

  /**
   * Get content with variable replacement
   */
  format(key: string, variables: Record<string, string | number>, locale?: string): string | null {
    const template = this.get(key, locale)

    if (!template) {
      return null
    }

    return this.replaceVariables(template, variables)
  }

  /**
   * Get all content for a locale
   */
  getAllForLocale(locale: string): Record<string, string> {
    const result: Record<string, string> = {}

    this.content.forEach((value, key) => {
      const content = value[locale] || value[this.defaultLocale]

      if (content) {
        result[key] = typeof content === 'string' ? content : content.content
      }
    })

    return result
  }

  /**
   * Set default locale
   */
  setDefaultLocale(locale: string): void {
    this.defaultLocale = locale
  }

  /**
   * Check if content exists
   */
  has(key: string, locale?: string): boolean {
    const content = this.content.get(key)

    if (!content) {
      return false
    }

    const selectedLocale = locale || this.defaultLocale
    return !!(content[selectedLocale] || content[this.defaultLocale])
  }

  /**
   * Replace variables in template
   */
  private replaceVariables(template: string, variables: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      const value = variables[key]

      if (value === undefined) {
        logger.warn('Variable not found in template', { key, template })
        return match
      }

      return String(value)
    })
  }
}

// Example content structure
export const exampleContent = {
  welcome_message: {
    en: 'Welcome, {name}!',
    es: '¡Bienvenido, {name}!',
    ru: 'Добро пожаловать, {name}!'
  },
  error_generic: {
    en: 'An error occurred. Please try again later.',
    es: 'Ocurrió un error. Por favor, inténtalo más tarde.',
    ru: 'Произошла ошибка. Пожалуйста, попробуйте позже.'
  },
  button_yes: {
    en: 'Yes',
    es: 'Sí',
    ru: 'Да'
  },
  button_no: {
    en: 'No',
    es: 'No',
    ru: 'Нет'
  }
}

// Factory function
export function createContentManager(content?: Record<string, LocalizedContent>): ContentManager {
  const manager = new ContentManager()

  if (content) {
    manager.loadContent(content)
  }

  return manager
}

// Helper function to load content from JSON files
export async function loadContentFromJSON(
  _paths: string[]
): Promise<Record<string, LocalizedContent>> {
  const content: Record<string, LocalizedContent> = {}

  // In a real implementation, this would load from actual JSON files
  // For Cloudflare Workers, you would import JSON files statically

  return content
}
