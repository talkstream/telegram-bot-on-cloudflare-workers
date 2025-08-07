/**
 * Type declarations for @cloudflare/ai
 */

declare module '@cloudflare/ai' {
  export class Ai {
    constructor(binding: unknown)
    run(model: string, input: unknown): Promise<{ response: string }>
  }
}
