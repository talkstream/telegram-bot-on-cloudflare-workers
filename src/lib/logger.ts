type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function log(level: LogLevel, message: string, ...args: unknown[]) {
  const timestamp = new Date().toISOString()
  const consoleMethod = level === 'debug' ? 'log' : level
  console[consoleMethod](`[${timestamp}] [${level.toUpperCase()}] ${message}`, ...args)
}

export const logger = {
  debug: (message: string, ...args: unknown[]) => log('debug', message, ...args),
  info: (message: string, ...args: unknown[]) => log('info', message, ...args),
  warn: (message: string, ...args: unknown[]) => log('warn', message, ...args),
  error: (message: string, ...args: unknown[]) => log('error', message, ...args)
}
