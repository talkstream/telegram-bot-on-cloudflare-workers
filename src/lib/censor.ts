/**
 * Utility for censoring obscene language according to Russian standards
 * Keeps the first and last letters, replacing the middle with asterisks
 */

export class Censor {
  private static obscenePatterns: Map<RegExp, string> = new Map([
    // Основные корни с вариациями
    [/\b(х)[уУ]([йЙиИяЯеЕёЁюЮ])\b/gi, '$1*$2'],
    [/\b(п)[иИ](з)[дД]/gi, '$1*$2*'],
    [/\b(б)[лЛ](я)[дД]/gi, '$1**$2*'],
    [/\b(е|ё)[бБ]([аАуУиИлЛ])/gi, '$1**$2'],
    [/\b(с)[уУ](к)[аАиИуУ]/gi, '$1*$2*'],
    [/\b(м)[уУ](д)[аАоОиИ]/gi, '$1*$2*'],
    [/\b(г)[оО](в)[нН]/gi, '$1*$2*'],
    [/\b(ж)[оО](п)[аАыЫуУеЕ]/gi, '$1*$2*'],

    // Полные формы для точного совпадения
    [/\bхуй\b/gi, 'х*й'],
    [/\bхуя\b/gi, 'х*я'],
    [/\bхуи\b/gi, 'х*и'],
    [/\bхуе\b/gi, 'х*е'],
    [/\bхуё\b/gi, 'х*ё'],
    [/\bхую\b/gi, 'х*ю'],

    [/\bпизд/gi, 'п***'],
    [/\bпизж/gi, 'п***'],

    [/\bблядь\b/gi, 'б***ь'],
    [/\bбляди\b/gi, 'б***и'],
    [/\bблядей\b/gi, 'б****й'],
    [/\bблядям\b/gi, 'б****м'],

    [/\bебать\b/gi, 'е***ь'],
    [/\bебал\b/gi, 'е**л'],
    [/\bебали\b/gi, 'е***и'],
    [/\bебаный\b/gi, 'е****й'],
    [/\bебанный\b/gi, 'е*****й'],
    [/\bебанутый\b/gi, 'е******й'],
    [/\bёбаный\b/gi, 'ё****й'],
    [/\bёбанный\b/gi, 'ё*****й'],

    [/\bсука\b/gi, 'с**а'],
    [/\bсуки\b/gi, 'с**и'],
    [/\bсукам\b/gi, 'с***м'],

    [/\bмудак\b/gi, 'м***к'],
    [/\bмудаки\b/gi, 'м****и'],
    [/\bмудачок\b/gi, 'м*****к'],

    [/\bговно\b/gi, 'г***о'],
    [/\bговна\b/gi, 'г***а'],

    [/\bжопа\b/gi, 'ж**а'],
    [/\bжопу\b/gi, 'ж**у'],
    [/\bжопе\b/gi, 'ж**е'],
    [/\bжопы\b/gi, 'ж**ы'],

    // Дополнительные формы
    [/\bзаебал/gi, 'з****л'],
    [/\bзаебали/gi, 'з*****и'],
    [/\bдолбоеб/gi, 'д*****б'],
    [/\bпиздец\b/gi, 'п****ц'],
    [/\bхуета\b/gi, 'х***а'],
    [/\bхуйня\b/gi, 'х***я'],
    [/\bохуеть\b/gi, 'о****ь'],
    [/\bохуел\b/gi, 'о***л'],
    [/\bохуенно\b/gi, 'о*****о'],
    [/\bнахуй\b/gi, 'н***й'],
    [/\bнахуя\b/gi, 'н***я'],
    [/\bпохуй\b/gi, 'п***й'],
    [/\bпохую\b/gi, 'п***ю']
  ])

  /**
   * Цензурирует текст, заменяя обсценную лексику звездочками
   * @param text - исходный текст
   * @returns цензурированный текст
   */
  static censor(text: string): string {
    let result = text

    // Применяем все паттерны
    for (const [pattern, replacement] of this.obscenePatterns) {
      result = result.replace(pattern, replacement)
    }

    return result
  }

  /**
   * Проверяет, содержит ли текст обсценную лексику
   * @param text - текст для проверки
   * @returns true если содержит обсценную лексику
   */
  static containsObscene(text: string): boolean {
    for (const [pattern] of this.obscenePatterns) {
      if (pattern.test(text)) {
        return true
      }
    }
    return false
  }

  /**
   * Получает список найденных обсценных слов (для логирования)
   * @param text - текст для анализа
   * @returns массив найденных слов
   */
  static findObsceneWords(text: string): string[] {
    const found: string[] = []

    for (const [pattern] of this.obscenePatterns) {
      const matches = text.match(pattern)
      if (matches) {
        found.push(...matches)
      }
    }

    return [...new Set(found)] // Убираем дубликаты
  }
}

// Экспорт функции для удобства использования
export const censorText = (text: string): string => Censor.censor(text)
export const containsObscene = (text: string): boolean => Censor.containsObscene(text)
export const findObsceneWords = (text: string): string[] => Censor.findObsceneWords(text)
