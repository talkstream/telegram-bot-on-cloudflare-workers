/**
 * Utilities for safe Telegram message formatting
 */

/**
 * Escapes special characters for Telegram Markdown v2
 * @param text Text to escape
 * @returns Escaped text
 */
export function escapeMarkdown(text: string): string {
  // Символы, которые нужно экранировать в Markdown v2
  const specialChars = [
    '_',
    '*',
    '[',
    ']',
    '(',
    ')',
    '~',
    '`',
    '>',
    '#',
    '+',
    '-',
    '=',
    '|',
    '{',
    '}',
    '.',
    '!'
  ]

  let escaped = text
  for (const char of specialChars) {
    escaped = escaped.replace(new RegExp(`\\${char}`, 'g'), `\\${char}`)
  }

  return escaped
}

/**
 * Экранирует текст для использования в коде (между ` `)
 * @param text Текст для экранирования
 * @returns Экранированный текст
 */
export function escapeCode(text: string): string {
  return text.replace(/`/g, '\\`')
}

/**
 * Форматирует текст как жирный (bold)
 * @param text Текст для форматирования
 * @returns Форматированный текст
 */
export function bold(text: string): string {
  return `*${escapeMarkdown(text)}*`
}

/**
 * Форматирует текст как курсив (italic)
 * @param text Текст для форматирования
 * @returns Форматированный текст
 */
export function italic(text: string): string {
  return `_${escapeMarkdown(text)}_`
}

/**
 * Форматирует текст как код
 * @param text Текст для форматирования
 * @returns Форматированный текст
 */
export function code(text: string): string {
  return `\`${escapeCode(text)}\``
}

/**
 * Форматирует многострочный текст как блок кода
 * @param text Текст для форматирования
 * @param language Язык для подсветки синтаксиса (опционально)
 * @returns Форматированный текст
 */
export function codeBlock(text: string, language?: string): string {
  const escaped = text.replace(/```/g, '\\`\\`\\`')
  return language ? `\`\`\`${language}\n${escaped}\n\`\`\`` : `\`\`\`\n${escaped}\n\`\`\``
}

/**
 * Создает ссылку в Markdown формате
 * @param text Текст ссылки
 * @param url URL
 * @returns Форматированная ссылка
 */
export function link(text: string, url: string): string {
  return `[${escapeMarkdown(text)}](${url})`
}

/**
 * Форматирует цитату
 * @param text Текст цитаты
 * @returns Форматированная цитата
 */
export function quote(text: string): string {
  // Простой текст без форматирования для лучшей читаемости
  return text
}

/**
 * Создает безопасное сообщение об ошибке
 * @param error Объект ошибки или строка
 * @returns Форматированное сообщение об ошибке
 */
export function formatError(error: unknown): string {
  let errorMessage = '❌ Произошла ошибка'

  if (error instanceof Error) {
    errorMessage += `\n\n${escapeMarkdown(error.message)}`
  } else if (typeof error === 'string') {
    errorMessage += `\n\n${escapeMarkdown(error)}`
  }

  return errorMessage
}

/**
 * Обрезает текст до максимальной длины с добавлением многоточия
 * @param text Текст для обрезки
 * @param maxLength Максимальная длина
 * @returns Обрезанный текст
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }

  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Создает горизонтальную линию-разделитель
 * @param length Длина линии (по умолчанию 16)
 * @returns Линия из символов
 */
export function divider(length: number = 16): string {
  return '─'.repeat(length)
}

/**
 * Форматирует сообщение для отображения в списке
 * @param message Объект сообщения
 * @returns Форматированное сообщение
 */
export function formatMessage(message: {
  content: string
  sender_masked_id: string
  sender_faction: string
  created_at: string
  is_read: boolean
}): string {
  const faction = message.sender_faction === 'keepers' ? '🔵' : '🔴'
  const readStatus = message.is_read ? '' : '🔴 '
  const date = new Date(message.created_at).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })

  // Примечание: escapeMarkdown применяется к content. Если content уже содержит
  // форматирование, которое должно быть сохранено, используйте другую функцию
  // или не применяйте escapeMarkdown здесь.
  return (
    `${readStatus}${faction} *От: ${message.sender_masked_id}*\n` +
    `📅 ${date}\n\n` +
    `${escapeMarkdown(message.content)}`
  )
}

/**
 * Обрезает текст для сообщения
 * @param text Текст для обрезки
 * @param maxLength Максимальная длина
 * @returns Обрезанный текст
 */
export function truncateMessage(text: string, maxLength: number = 1000): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.substring(0, maxLength - 3) + '...'
}
