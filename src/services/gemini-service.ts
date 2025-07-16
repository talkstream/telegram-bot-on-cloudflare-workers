import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { logger } from '../lib/logger';

export class GeminiService {
  private model: GenerativeModel;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Ensure we always use the 'gemini-pro' model
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  async generateText(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      logger.info('Gemini API call successful.');
      return text;
    } catch (error) {
      logger.error('Error calling Gemini API:', error);
      throw new Error('Failed to generate text from Gemini API.');
    }
  }
}
