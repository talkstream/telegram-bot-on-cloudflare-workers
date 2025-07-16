type LanguageCode = 'en' | 'ru'; // Add more languages as needed

const messages = {
  en: {
    welcome: 'Welcome! Up and running.',
    welcome_session: (step: string) => `Welcome! Your current step is: ${step}`,
    got_message: 'Got another message!',
    got_message_session: 'Got another message! I\'ve saved it to your session.',
    no_session: 'Got another message! (No session found)',
    gemini_prompt_needed: 'Please provide a prompt after the command, e.g., /askgemini What is the capital of France?',
    gemini_thinking: 'Thinking...',
    gemini_error: 'Sorry, I could not generate a response at this time.',
    health_ok: 'ok',
    health_degraded: 'degraded',
    health_error: 'error',
    health_not_configured: 'not_configured',
  },
  ru: {
    welcome: 'Добро пожаловать! Бот запущен.',
    welcome_session: (step: string) => `Добро пожаловать! Ваш текущий шаг: ${step}`,
    got_message: 'Получено новое сообщение!',
    got_message_session: 'Получено новое сообщение! Я сохранил его в вашей сессии.',
    no_session: 'Получено новое сообщение! (Сессия не найдена)',
    gemini_prompt_needed: 'Пожалуйста, укажите запрос после команды, например: /askgemini Какова столица Франции?',
    gemini_thinking: 'Думаю...',
    gemini_error: 'Извините, не удалось сгенерировать ответ в данный момент.',
    health_ok: 'ок',
    health_degraded: 'частично неисправен',
    health_error: 'ошибка',
    health_not_configured: 'не настроен',
  },
};

export function getMessage(lang: LanguageCode, key: keyof typeof messages['en'], ...args: any[]): string {
  const langMessages = messages[lang] || messages.en; // Fallback to English
  const message = langMessages[key];

  if (typeof message === 'function') {
    return message(...args);
  } else if (typeof message === 'string') {
    return message;
  } else {
    return `[Missing message for ${key} in ${lang}]`;
  }
}
