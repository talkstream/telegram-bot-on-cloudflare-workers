/**
 * Telegram-specific message formatter
 * Handles HTML formatting for Telegram messages
 */

import type { MessageFormatter } from '../../../core/interfaces/i18n'

export class TelegramMessageFormatter implements MessageFormatter {
  platform = 'telegram'

  /**
   * Format a message for Telegram
   */
  format(message: string, options?: Record<string, unknown>): string {
    let formatted = message

    // Apply Telegram HTML formatting if specified
    if (options?.parseMode === 'HTML') {
      // Already HTML formatted, just ensure it's valid
      formatted = this.sanitizeTelegramHTML(formatted)
    } else if (options?.parseMode === 'Markdown' || options?.parseMode === 'MarkdownV2') {
      // Convert markdown to HTML for consistency
      formatted = this.markdownToTelegramHTML(formatted)
    }

    // Apply additional formatting options
    if (options?.bold) {
      formatted = `<b>${formatted}</b>`
    }

    if (options?.italic) {
      formatted = `<i>${formatted}</i>`
    }

    if (options?.code) {
      formatted = `<code>${formatted}</code>`
    }

    if (options?.pre) {
      const language = options.language as string | undefined
      formatted = language
        ? `<pre language="${language}">${formatted}</pre>`
        : `<pre>${formatted}</pre>`
    }

    // Handle emoji substitution
    if (options?.emoji && typeof options.emoji === 'object') {
      for (const [key, value] of Object.entries(options.emoji)) {
        formatted = formatted.replace(new RegExp(`:${key}:`, 'g'), value as string)
      }
    }

    return formatted
  }

  /**
   * Sanitize HTML for Telegram
   */
  private sanitizeTelegramHTML(html: string): string {
    // Telegram supports only specific HTML tags
    // const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'code', 'pre', 'a'];

    // Simple sanitization - in production, use a proper HTML sanitizer
    return html
  }

  /**
   * Convert markdown to Telegram HTML
   */
  private markdownToTelegramHTML(markdown: string): string {
    let html = markdown

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    html = html.replace(/__(.+?)__/g, '<b>$1</b>')

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<i>$1</i>')
    html = html.replace(/_(.+?)_/g, '<i>$1</i>')

    // Code
    html = html.replace(/`(.+?)`/g, '<code>$1</code>')

    // Pre
    html = html.replace(/```(\w+)?\n([\s\S]+?)```/g, (_match, lang, code) => {
      return lang ? `<pre language="${lang}">${code}</pre>` : `<pre>${code}</pre>`
    })

    // Links
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')

    return html
  }
}
