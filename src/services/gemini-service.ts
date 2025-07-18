import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

import { logger } from '../lib/logger';
import { withTimeout, getTimeoutConfig, retryWithTimeout } from '../lib/timeout-wrapper';

export class GeminiService {
  private model: GenerativeModel;
  private tier: 'free' | 'paid';

  constructor(apiKey: string, tier: 'free' | 'paid' = 'free') {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Ensure we always use the 'gemini-pro' model
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    this.tier = tier;
  }

  async generateText(prompt: string): Promise<string> {
    const timeouts = getTimeoutConfig(this.tier);
    
    return retryWithTimeout(
      async () => {
        try {
          const result = await withTimeout(
            this.model.generateContent(prompt),
            {
              timeoutMs: timeouts.api,
              operation: 'Gemini generateContent',
              errorMessage: `Gemini API timed out after ${timeouts.api}ms`,
            }
          );
          
          const response = await result.response;
          
          const text = response.text();
          logger.info('Gemini API call successful.');
          return text;
        } catch (error) {
          logger.error('Error calling Gemini API:', error);
          throw new Error('Failed to generate text from Gemini API.');
        }
      },
      {
        maxRetries: this.tier === 'free' ? 1 : 3,
        retryDelayMs: 100,
        timeoutMs: timeouts.api,
        operation: 'Gemini generateText',
      }
    );
  }
}
