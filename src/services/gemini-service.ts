import { GoogleGenAI } from '@google/genai'

import { logger } from '../lib/logger'
import { getTimeoutConfig, retryWithTimeout, withTimeout } from '../lib/timeout-wrapper'

export class GeminiService {
  private genAI: GoogleGenAI
  private modelName: string = 'gemini-2.5-flash'
  private tier: 'free' | 'paid'

  constructor(apiKey: string, tier: 'free' | 'paid' = 'free') {
    this.genAI = new GoogleGenAI({ apiKey })
    this.tier = tier
  }

  async generateText(prompt: string): Promise<string> {
    const timeouts = getTimeoutConfig(this.tier)

    return retryWithTimeout(
      async () => {
        try {
          const result = await withTimeout(
            this.genAI.models.generateContent({
              model: this.modelName,
              contents: prompt,
              config: {
                maxOutputTokens: 1000,
                temperature: 0.7
              }
            }),
            {
              timeoutMs: timeouts.api,
              operation: 'Gemini generateContent',
              errorMessage: `Gemini API timed out after ${timeouts.api}ms`
            }
          )

          const text = result.text || ''
          logger.info('Gemini API call successful.')
          return text
        } catch (error) {
          logger.error('Error calling Gemini API:', error)
          throw new Error('Failed to generate text from Gemini API.')
        }
      },
      {
        maxRetries: this.tier === 'free' ? 1 : 3,
        retryDelayMs: 100,
        timeoutMs: timeouts.api,
        operation: 'Gemini generateText'
      }
    )
  }
}
