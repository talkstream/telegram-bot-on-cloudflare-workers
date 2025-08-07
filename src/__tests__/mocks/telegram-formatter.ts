import { vi } from 'vitest'

export const escapeMarkdown = vi.fn((text: string) => text)
export const formatCode = vi.fn(
  (text: string, lang?: string) => `\`\`\`${lang || ''}\n${text}\n\`\`\``
)
export const formatBold = vi.fn((text: string) => `*${text}*`)
export const formatItalic = vi.fn((text: string) => `_${text}_`)

// Mock the module
vi.mock('@/lib/telegram-formatter', () => ({
  escapeMarkdown,
  formatCode,
  formatBold,
  formatItalic
}))
