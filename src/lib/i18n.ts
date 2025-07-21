type LanguageCode = 'en' | 'ru'; // Add more languages as needed

const messages = {
  en: {
    welcome: 'Welcome! Up and running.',
    welcome_session: (step: string) => `Welcome! Your current step is: ${step}`,
    got_message: 'Got another message!',
    got_message_session: "Got another message! I've saved it to your session.",
    no_session: 'Got another message! (No session found)',
    gemini_prompt_needed:
      'Please provide a prompt after the command, e.g., /askgemini What is the capital of France?',
    gemini_thinking: 'Thinking...',
    gemini_error: 'Sorry, I could not generate a response at this time.',
    gemini_not_available: 'AI features are not available in free tier mode.',
    health_ok: 'ok',
    health_degraded: 'degraded',
    health_error: 'error',
    health_not_configured: 'not_configured',
    // Access control messages
    access_denied: '⚠️ You do not have access to this bot.',
    access_pending: 'Your access request is pending approval.',
    access_request_sent:
      '✅ Your access request has been sent! An administrator will review it soon.',
    access_request_exists: 'You already have a pending access request.',
    access_approved: '🎉 Your access request has been approved!',
    access_rejected: '❌ Your access request has been rejected.',
    request_access: 'Request Access',
    cancel_request: 'Cancel Request',
    access_request_cancelled: '🚫 Your access request has been cancelled.',
    view_next_request: 'Next Request',
    access_request_approved: '✅ Access granted to user {userId} (@{username})',
    no_username: 'No username',
    access_granted_notification:
      '🎉 Your access request has been approved! You can now use the bot.',
    access_request_rejected: '❌ Access denied to user {userId} (@{username})',
    access_denied_notification: 'Your access request has been rejected.',
    access_request_details:
      '📋 <b>Access Request #{id}</b>\n\nName: {firstName}\nUsername: @{username}\nUser ID: {userId}\nRequested: {date}',
    review_request: 'Review Request',
    new_access_request:
      '🆕 <b>New Access Request</b>\n\nUser: {firstName} (@{username})\nID: {userId}\n\nUse /requests to review.',
    // Owner commands
    info_command_header: '📊 <b>Bot Technical Information</b>',
    info_system_status: '⏱ <b>System Status</b>',
    info_uptime: 'Uptime: {hours}h {minutes}m',
    info_environment: 'Environment: {environment}',
    info_tier: 'Tier: {tier}',
    info_user_statistics: '👥 <b>User Statistics</b>',
    info_total_users: 'Total Users: {count}',
    info_active_users: 'Active Users: {count}',
    info_active_sessions: 'Active Sessions: {count}',
    info_access_requests: '🔐 <b>Access Requests</b>',
    info_pending: 'Pending: {count}',
    info_approved: 'Approved: {count}',
    info_rejected: 'Rejected: {count}',
    info_role_distribution: '👮 <b>Role Distribution</b>',
    info_no_roles: 'No roles assigned yet',
    info_ai_provider: '🤖 <b>AI Provider</b>',
    info_ai_not_configured: 'AI Service: Not configured',
    info_ai_status: 'AI Service: {provider} ({count} providers available)',
    info_total_cost: 'Total Cost: ${cost} USD',
    info_error: '❌ Failed to retrieve bot information. Check logs for details.',
    admin_added: '✅ User {userId} is now an admin',
    admin_removed: '✅ User {userId} is no longer an admin',
    admin_already: 'User is already an admin',
    admin_not_found: 'User is not an admin',
    admin_list: 'Current admins:\n{admins}',
    admin_list_empty: 'No admins configured',
    admin_usage: 'Usage:\n/admin add <user_id>\n/admin remove <user_id>\n/admin list',
    debug_enabled: '🐛 Debug mode enabled (Level {level})',
    debug_disabled: '🐛 Debug mode disabled',
    debug_status: '🐛 Debug mode: {status}',
    debug_usage:
      '<b>🐛 Debug Mode Management</b>\n\nAvailable commands:\n/debug on [level] - Enable debug mode\n/debug off - Disable debug mode\n/debug status - Show current status\n\n<b>Debug levels:</b>\n1 - Only owners see debug messages\n2 - Owners and admins see debug messages\n3 - Everyone sees debug messages\n\n<i>Debug mode shows error messages and access attempts that are normally hidden.</i>',
    debug_invalid_level: '❌ Invalid debug level. Please use 1, 2, or 3.',
    debug_enable_error: '❌ Failed to enable debug mode. Please try again.',
    debug_disable_error: '❌ Failed to disable debug mode. Please try again.',
    debug_status_error: '❌ Failed to retrieve debug status. Please try again.',
    debug_status_disabled: '<b>Disabled</b>\nDebug messages are hidden for all users.',
    debug_status_enabled: '<b>Enabled</b> (Level {level})',
    // Admin commands
    no_pending_requests: 'No pending access requests',
    pending_requests: '📋 Pending Access Requests:\n\n{requests}',
    request_info: '👤 {name} (@{username})\nID: {userId}\n📅 {date}',
    approve: 'Approve',
    reject: 'Reject',
    request_approved: '✅ Request approved for user {userId}',
    request_rejected: '❌ Request rejected for user {userId}',
    request_not_found: 'Request not found',
    // Command access messages
    owner_only: '⚠️ This command is only available to the bot owner.',
    admin_only: '⚠️ This command is only available to administrators.',
    unauthorized_access: 'Unauthorized access attempt',
    // Help messages
    help_user:
      '📚 Available Commands:\n\n' +
      '/start - Start the bot\n' +
      '/help - Show this help\n' +
      '/ask - Ask AI a question\n' +
      '/batch - Batch processing demo',
    help_admin: '\n\n👮 Admin Commands:\n' + '/requests - Review access requests',
    help_owner:
      '\n\n👑 Owner Commands:\n' +
      '/info - Bot information\n' +
      '/admin - Manage admins\n' +
      '/debug - Toggle debug mode',
    // Additional messages
    access_request: 'Access Request',
    request_count: 'Request',
    next: '➡️ Next',
    requests_error: '❌ Failed to retrieve access requests. Please try again.',
    use_start_to_request: 'Use /start to request access.',
    // AI commands
    ai_not_configured: '🚫 AI service is not configured.\n\nPlease contact the bot administrator.',
    ai_not_available_free_tier:
      '🚫 AI features are not available in the free tier.\n\n' +
      'Upgrade to the paid tier to access:\n' +
      '• AI-powered responses\n' +
      '• Advanced text generation\n' +
      '• Smart assistance',
    ask_prompt_needed:
      '💭 Please provide a question or prompt after the command.\n\n' +
      'Example: /ask What is the weather like today?',
    powered_by: 'Powered by {provider}',
    ai_error:
      '❌ Sorry, I encountered an error while processing your request.\nPlease try again later.',
    // Batch command
    batch_info:
      '⚡ <b>Request batching is automatically enabled!</b>\n\n' +
      'The bot optimizes Telegram API calls by:\n' +
      '• Batching multiple requests together\n' +
      '• Reducing API overhead\n' +
      '• Improving response times\n\n' +
      'This happens transparently in the background.',
    // Access callbacks
    request_cancelled: '🚫 Your access request has been cancelled.',
    new_access_request_notification:
      '🆕 <b>New Access Request</b>\n\nUser: {userInfo}\nID: {userId}\n\nUse /requests to review.',
    view_requests: '👀 View Requests',
    use_requests_command: '📋 Use /requests command to view pending requests.',
    // General messages
    user_identification_error: '❌ Unable to identify user',
    general_error: '❌ An error occurred. Please try again later.',
    invalid_user_id: '❌ Please provide a valid user ID or forward a message from the user.',
    user_not_found: '❌ User not found. They must have used the bot at least once.',
    added_date: 'Added',
    // Admin notifications
    admin_granted_notification: '🎉 You have been granted administrator privileges in this bot!',
    admin_revoked_notification: 'ℹ️ Your administrator privileges have been revoked.',
    admin_add_error: '❌ Failed to add administrator. Please try again.',
    admin_remove_error: '❌ Failed to remove administrator. Please try again.',
    admin_list_error: '❌ Failed to retrieve admin list. Please try again.',
  },
  ru: {
    welcome: 'Добро пожаловать! Бот запущен.',
    welcome_session: (step: string) => `Добро пожаловать! Ваш текущий шаг: ${step}`,
    got_message: 'Получено новое сообщение!',
    got_message_session: 'Получено новое сообщение! Я сохранил его в вашей сессии.',
    no_session: 'Получено новое сообщение! (Сессия не найдена)',
    gemini_prompt_needed:
      'Пожалуйста, укажите запрос после команды, например: /askgemini Какова столица Франции?',
    gemini_thinking: 'Думаю...',
    gemini_error: 'Извините, не удалось сгенерировать ответ в данный момент.',
    gemini_not_available: 'AI функции недоступны в бесплатном режиме.',
    health_ok: 'ок',
    health_degraded: 'частично неисправен',
    health_error: 'ошибка',
    health_not_configured: 'не настроен',
    // Access control messages
    access_denied: '⚠️ У вас нет доступа к этому боту.',
    access_pending: 'Ваша заявка на доступ ожидает одобрения.',
    access_request_sent:
      '✅ Ваша заявка на доступ отправлена! Администратор рассмотрит её в ближайшее время.',
    access_request_exists: 'У вас уже есть заявка на доступ, ожидающая рассмотрения.',
    access_approved: '🎉 Ваша заявка на доступ одобрена!',
    access_rejected: '❌ Ваша заявка на доступ отклонена.',
    request_access: 'Запросить доступ',
    cancel_request: 'Отменить заявку',
    access_request_cancelled: '🚫 Ваша заявка на доступ была отменена.',
    view_next_request: 'Следующая заявка',
    access_request_approved: '✅ Доступ предоставлен пользователю {userId} (@{username})',
    no_username: 'Без имени пользователя',
    access_granted_notification:
      '🎉 Ваша заявка на доступ одобрена! Теперь вы можете использовать бота.',
    access_request_rejected: '❌ Доступ отклонён для пользователя {userId} (@{username})',
    access_denied_notification: 'Ваша заявка на доступ была отклонена.',
    access_request_details:
      '📋 <b>Заявка на доступ #{id}</b>\n\nИмя: {firstName}\nИмя пользователя: @{username}\nID пользователя: {userId}\nЗапрошено: {date}',
    review_request: 'Рассмотреть заявку',
    new_access_request:
      '🆕 <b>Новая заявка на доступ</b>\n\nПользователь: {firstName} (@{username})\nID: {userId}\n\nИспользуйте /requests для просмотра.',
    // Owner commands
    info_command_header: '📊 <b>Техническая информация о боте</b>',
    info_system_status: '⏱ <b>Статус системы</b>',
    info_uptime: 'Время работы: {hours}ч {minutes}м',
    info_environment: 'Окружение: {environment}',
    info_tier: 'Тариф: {tier}',
    info_user_statistics: '👥 <b>Статистика пользователей</b>',
    info_total_users: 'Всего пользователей: {count}',
    info_active_users: 'Активные пользователи: {count}',
    info_active_sessions: 'Активные сессии: {count}',
    info_access_requests: '🔐 <b>Заявки на доступ</b>',
    info_pending: 'Ожидают: {count}',
    info_approved: 'Одобрено: {count}',
    info_rejected: 'Отклонено: {count}',
    info_role_distribution: '👮 <b>Распределение ролей</b>',
    info_no_roles: 'Роли ещё не назначены',
    info_ai_provider: '🤖 <b>AI провайдер</b>',
    info_ai_not_configured: 'AI сервис: Не настроен',
    info_ai_status: 'AI сервис: {provider} ({count} провайдеров доступно)',
    info_total_cost: 'Общая стоимость: ${cost} USD',
    info_error: '❌ Не удалось получить информацию о боте. Проверьте логи.',
    admin_added: '✅ Пользователь {userId} теперь администратор',
    admin_removed: '✅ Пользователь {userId} больше не администратор',
    admin_already: 'Пользователь уже является администратором',
    admin_not_found: 'Пользователь не является администратором',
    admin_list: 'Текущие администраторы:\n{admins}',
    admin_list_empty: 'Нет настроенных администраторов',
    admin_usage: 'Использование:\n/admin add <user_id>\n/admin remove <user_id>\n/admin list',
    debug_enabled: '🐛 Режим отладки включен (Уровень {level})',
    debug_disabled: '🐛 Режим отладки выключен',
    debug_status: '🐛 Режим отладки: {status}',
    debug_usage:
      '<b>🐛 Управление режимом отладки</b>\n\nДоступные команды:\n/debug on [уровень] - Включить режим отладки\n/debug off - Выключить режим отладки\n/debug status - Показать текущий статус\n\n<b>Уровни отладки:</b>\n1 - Только владельцы видят отладочные сообщения\n2 - Владельцы и администраторы видят отладочные сообщения\n3 - Все видят отладочные сообщения\n\n<i>Режим отладки показывает сообщения об ошибках и попытках несанкционированного доступа, которые обычно скрыты.</i>',
    debug_invalid_level: '❌ Неверный уровень отладки. Используйте 1, 2 или 3.',
    debug_enable_error: '❌ Не удалось включить режим отладки. Пожалуйста, попробуйте ещё раз.',
    debug_disable_error: '❌ Не удалось выключить режим отладки. Пожалуйста, попробуйте ещё раз.',
    debug_status_error: '❌ Не удалось получить статус отладки. Пожалуйста, попробуйте ещё раз.',
    debug_status_disabled: '<b>Выключен</b>\nОтладочные сообщения скрыты для всех пользователей.',
    debug_status_enabled: '<b>Включен</b> (Уровень {level})',
    // Admin commands
    no_pending_requests: 'Нет заявок на доступ, ожидающих рассмотрения',
    pending_requests: '📋 Заявки на доступ:\n\n{requests}',
    request_info: '👤 {name} (@{username})\nID: {userId}\n📅 {date}',
    approve: 'Одобрить',
    reject: 'Отклонить',
    request_approved: '✅ Заявка одобрена для пользователя {userId}',
    request_rejected: '❌ Заявка отклонена для пользователя {userId}',
    request_not_found: 'Заявка не найдена',
    // Command access messages
    owner_only: '⚠️ Эта команда доступна только владельцу бота.',
    admin_only: '⚠️ Эта команда доступна только администраторам.',
    unauthorized_access: 'Попытка несанкционированного доступа',
    // Help messages
    help_user:
      '📚 Доступные команды:\n\n' +
      '/start - Запустить бота\n' +
      '/help - Показать эту справку\n' +
      '/ask - Задать вопрос AI\n' +
      '/batch - Демо пакетной обработки',
    help_admin: '\n\n👮 Команды администратора:\n' + '/requests - Просмотр заявок на доступ',
    help_owner:
      '\n\n👑 Команды владельца:\n' +
      '/info - Информация о боте\n' +
      '/admin - Управление администраторами\n' +
      '/debug - Переключить режим отладки',
    // Additional messages
    access_request: 'Заявка на доступ',
    request_count: 'Заявка',
    next: '➡️ Далее',
    requests_error: '❌ Не удалось получить заявки на доступ. Пожалуйста, попробуйте ещё раз.',
    use_start_to_request: 'Используйте /start для запроса доступа.',
    // AI commands
    ai_not_configured: '🚫 Сервис AI не настроен.\n\nПожалуйста, свяжитесь с администратором бота.',
    ai_not_available_free_tier:
      '🚫 Функции AI недоступны в бесплатном тарифе.\n\n' +
      'Перейдите на платный тариф для доступа к:\n' +
      '• Ответам на основе AI\n' +
      '• Продвинутой генерации текста\n' +
      '• Умной помощи',
    ask_prompt_needed:
      '💭 Пожалуйста, укажите вопрос или запрос после команды.\n\n' +
      'Пример: /ask Какая сегодня погода?',
    powered_by: 'Работает на {provider}',
    ai_error:
      '❌ К сожалению, я столкнулся с ошибкой при обработке вашего запроса.\nПожалуйста, попробуйте позже.',
    // Batch command
    batch_info:
      '⚡ <b>Пакетирование запросов автоматически включено!</b>\n\n' +
      'Бот оптимизирует вызовы Telegram API:\n' +
      '• Объединяя несколько запросов вместе\n' +
      '• Снижая нагрузку на API\n' +
      '• Улучшая время отклика\n\n' +
      'Это происходит прозрачно в фоновом режиме.',
    // Access callbacks
    request_cancelled: '🚫 Ваша заявка на доступ была отменена.',
    new_access_request_notification:
      '🆕 <b>Новая заявка на доступ</b>\n\nПользователь: {userInfo}\nID: {userId}\n\nИспользуйте /requests для просмотра.',
    view_requests: '👀 Просмотреть заявки',
    use_requests_command: '📋 Используйте команду /requests для просмотра ожидающих заявок.',
    // General messages
    user_identification_error: '❌ Не удалось идентифицировать пользователя',
    general_error: '❌ Произошла ошибка. Пожалуйста, попробуйте позже.',
    invalid_user_id:
      '❌ Пожалуйста, укажите правильный ID пользователя или перешлите сообщение от пользователя.',
    user_not_found: '❌ Пользователь не найден. Он должен хотя бы раз использовать бота.',
    added_date: 'Добавлен',
    // Admin notifications
    admin_granted_notification: '🎉 Вам предоставлены права администратора в этом боте!',
    admin_revoked_notification: 'ℹ️ Ваши права администратора были отозваны.',
    admin_add_error: '❌ Не удалось добавить администратора. Пожалуйста, попробуйте ещё раз.',
    admin_remove_error: '❌ Не удалось удалить администратора. Пожалуйста, попробуйте ещё раз.',
    admin_list_error:
      '❌ Не удалось получить список администраторов. Пожалуйста, попробуйте ещё раз.',
  },
};

export function getMessage(
  lang: LanguageCode,
  key: keyof (typeof messages)['en'],
  ...args: unknown[]
): string {
  const langMessages = messages[lang] || messages.en; // Fallback to English
  const message = langMessages[key];

  if (typeof message === 'function') {
    return (message as (...args: unknown[]) => string)(...args);
  } else if (typeof message === 'string') {
    // Handle template replacements
    if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
      const replacements = args[0] as Record<string, unknown>;
      return message.replace(/\{(\w+)\}/g, (match, key) => {
        return replacements[key]?.toString() || match;
      });
    }
    return message;
  } else {
    return `[Missing message for ${key} in ${lang}]`;
  }
}
