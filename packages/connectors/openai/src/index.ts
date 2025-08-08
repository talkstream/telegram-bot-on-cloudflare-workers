/**
 * @wireframe/connector-openai
 *
 * OpenAI API connector for Wireframe
 */

import OpenAI from 'openai'
import type { Connector } from '@wireframe/core'
import { ConnectorType } from '@wireframe/core'

export interface OpenAIConfig {
  apiKey: string
  model?: string
  maxTokens?: number
  temperature?: number
  organizationId?: string
  baseURL?: string
}

export class OpenAIConnector implements Connector {
  name = '@wireframe/connector-openai'
  version = '2.0.0-alpha.1'
  type = ConnectorType.AI as ConnectorType

  private client?: OpenAI
  private config: OpenAIConfig = {
    apiKey: '',
    model: 'gpt-4-turbo-preview',
    maxTokens: 1000,
    temperature: 0.7
  }

  async initialize(config: unknown): Promise<void> {
    this.config = { ...this.config, ...(config as OpenAIConfig) }

    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required')
    }

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      organization: this.config.organizationId,
      baseURL: this.config.baseURL
    })
  }

  async dispose(): Promise<void> {
    this.client = undefined
  }

  /**
   * Complete a text prompt
   */
  async complete(prompt: string, options?: Partial<OpenAIConfig>): Promise<string> {
    if (!this.client) {
      throw new Error('Connector not initialized')
    }

    const completion = await this.client.chat.completions.create({
      model: options?.model || this.config.model || 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options?.maxTokens || this.config.maxTokens,
      temperature: options?.temperature || this.config.temperature
    })

    return completion.choices[0]?.message?.content || ''
  }

  /**
   * Chat with conversation history
   */
  async chat(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options?: Partial<OpenAIConfig>
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Connector not initialized')
    }

    const completion = await this.client.chat.completions.create({
      model: options?.model || this.config.model || 'gpt-4-turbo-preview',
      messages,
      max_tokens: options?.maxTokens || this.config.maxTokens,
      temperature: options?.temperature || this.config.temperature
    })

    return completion.choices[0]?.message?.content || ''
  }

  /**
   * Generate embeddings
   */
  async embed(text: string | string[]): Promise<number[][]> {
    if (!this.client) {
      throw new Error('Connector not initialized')
    }

    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    })

    return response.data.map(item => item.embedding)
  }

  /**
   * Generate image
   */
  async generateImage(
    prompt: string,
    options?: { size?: '256x256' | '512x512' | '1024x1024'; n?: number }
  ): Promise<string[]> {
    if (!this.client) {
      throw new Error('Connector not initialized')
    }

    const response = await this.client.images.generate({
      prompt,
      n: options?.n || 1,
      size: options?.size || '1024x1024'
    })

    return response.data?.map(item => item.url).filter((url): url is string => url !== undefined) || []
  }

  /**
   * Moderate content
   */
  async moderate(
    text: string
  ): Promise<{ flagged: boolean; categories: Record<string, boolean | null> }> {
    if (!this.client) {
      throw new Error('Connector not initialized')
    }

    const response = await this.client.moderations.create({
      input: text
    })

    const result = response.results[0]
    if (!result) {
      throw new Error('No moderation result received')
    }
    return {
      flagged: result.flagged,
      categories: { ...result.categories }
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    if (!this.client) {
      throw new Error('Connector not initialized')
    }

    const response = await this.client.models.list()
    return response.data.map(model => model.id)
  }
}

// Default export for easy registration
export default new OpenAIConnector()
