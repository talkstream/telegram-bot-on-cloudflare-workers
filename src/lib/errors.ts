export class BotError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'BotError'
  }
}

export class ValidationError extends BotError {
  constructor(message: string) {
    super(message, 400)
    this.name = 'ValidationError'
  }
}

export class UnauthorizedError extends BotError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401)
    this.name = 'UnauthorizedError'
  }
}
